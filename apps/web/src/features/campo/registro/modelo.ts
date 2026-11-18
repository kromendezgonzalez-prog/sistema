/**
 * Lógica pura del formulario de registro (sin React). Usa las fórmulas de @merca/shared.
 */
import {
  alertasItem,
  evaluarGeo,
  nivelItem,
  peorNivel,
  riesgosItem,
  type Alerta,
  type EvaluacionGeo,
  type Item,
  type Lote,
  type NivelRiesgo,
  type Pdv,
  type Producto,
  type Registro,
  type RegistroInput,
  type RiesgoLote,
  type TipoDia,
  type Turno,
  type UltimoInventarioResponse,
  type UmbralesRiesgo,
} from '@merca/shared';
import { nanoid } from 'nanoid';
import { contarFotosLocales } from '@/lib/fotos';
import type { FormRegistro, MetaForm, ResumenCola } from '@/offline/db';
import { nombreProducto } from '../util';

export type Momento = 'ini' | 'fin';
export const campoLotes = (m: Momento): 'lotesIni' | 'lotesFin' => (m === 'ini' ? 'lotesIni' : 'lotesFin');

export const nuevoIdLote = () => nanoid(10);

export function formNuevo(p: { fecha: string; turno: Turno; tipoDia?: TipoDia; pdvId?: string }): FormRegistro {
  return {
    fecha: p.fecha,
    turno: p.turno,
    tipoDia: p.tipoDia ?? 'Laboral',
    pdvId: p.pdvId ?? '',
    items: {},
    ejec: {},
    comp: {},
    impulso: {},
    nov: [],
    obs: '',
    fotosGondola: [],
    geo: null,
  };
}

export const metaVacia = (): MetaForm => ({ precarga: null, sinConfirmar: [], existente: false });

/** ¿El producto tiene algo registrado? */
export function tieneDatos(it: Partial<Item> | undefined): boolean {
  if (!it) return false;
  return (
    it.lotesIni !== undefined ||
    it.lotesFin !== undefined ||
    (it.rec !== null && it.rec !== undefined) ||
    (it.ave !== null && it.ave !== undefined) ||
    !!it.agot
  );
}

function limpiarItem(it: Item): Item {
  const out: Item = { agot: !!it.agot };
  if (it.lotesIni !== undefined) out.lotesIni = it.lotesIni;
  if (it.lotesFin !== undefined) out.lotesFin = it.lotesFin;
  if (it.rec !== null && it.rec !== undefined) out.rec = it.rec;
  if (it.ave !== null && it.ave !== undefined) out.ave = it.ave;
  return out;
}

/** Arma lo que se envía a la API (`RegistroInput`). */
export function construirInput(f: FormRegistro): RegistroInput {
  const lab = f.tipoDia === 'Laboral';
  const items: RegistroInput['items'] = {};
  if (lab) for (const [cod, it] of Object.entries(f.items)) if (tieneDatos(it)) items[cod] = limpiarItem(it);
  return {
    fecha: f.fecha,
    turno: f.turno,
    tipoDia: f.tipoDia,
    pdvId: f.pdvId,
    items,
    ejec: lab ? f.ejec : {},
    comp: lab ? Object.fromEntries(Object.entries(f.comp).map(([k, v]) => [k, { precio: v.precio ?? null, act: v.act || 'Ninguna' }])) : {},
    impulso: lab ? f.impulso : {},
    nov: f.nov,
    obs: f.obs,
    fotosGondola: lab ? f.fotosGondola : [],
    geo: lab ? f.geo : null,
  };
}

/** Convierte un registro (servidor o cola) en el estado del formulario. */
export function formDesdeRegistro(r: Registro | RegistroInput): FormRegistro {
  const items: Record<string, Item> = {};
  for (const [cod, it] of Object.entries(r.items ?? {})) items[cod] = limpiarItem(it as Item);
  const g = r.geo;
  return {
    fecha: r.fecha,
    turno: r.turno,
    tipoDia: r.tipoDia,
    pdvId: r.pdvId,
    items,
    ejec: { ...(r.ejec ?? {}) },
    comp: Object.fromEntries(Object.entries(r.comp ?? {}).map(([k, v]) => [k, { precio: v.precio ?? null, act: v.act ?? 'Ninguna' }])),
    impulso: { ...(r.impulso ?? {}) },
    nov: [...(r.nov ?? [])],
    obs: r.obs ?? '',
    fotosGondola: [...(r.fotosGondola ?? [])],
    geo: g ? { lat: g.lat, lng: g.lng, precisionM: g.precisionM, capturadoEn: g.capturadoEn } : null,
  };
}

/**
 * Precarga los lotes iniciales con el último inventario del punto.
 * Solo toca productos que aún no tienen lotes de llegada.
 */
export function aplicarPrecarga(
  form: FormRegistro,
  previo: NonNullable<UltimoInventarioResponse['previo']>,
  existe: (cod: string) => boolean,
): { form: FormRegistro; precargados: string[] } {
  const items = { ...form.items };
  const precargados: string[] = [];
  for (const [cod, lotes] of Object.entries(previo.lotes ?? {})) {
    if (!existe(cod) || items[cod]?.lotesIni !== undefined) continue;
    const conCantidad = lotes.filter((l) => l.cantidad > 0);
    items[cod] = {
      ...(items[cod] ?? { agot: false }),
      lotesIni: conCantidad.map<Lote>((l) => ({ id: nuevoIdLote(), cantidad: l.cantidad, vto: l.vto, novedad: null })),
    };
    precargados.push(cod);
  }
  return { form: { ...form, items }, precargados };
}

/* ───────── Análisis para el resumen y la barra de guardar ───────── */

export interface AlertaProducto {
  cod: string;
  nombre: string;
  alertas: Alerta[];
}

export interface Analisis {
  nProductos: number;
  alertas: AlertaProducto[];
  totalAlertas: number;
  /** lotes vigentes con riesgo (≠ ok), ordenados por días */
  riesgos: (RiesgoLote & { nombre: string })[];
  /** lotes vencidos sin novedad reportada */
  vencidosSinNovedad: number;
  fotosLocales: number;
  peor: NivelRiesgo;
  geo: EvaluacionGeo | null;
  /** productos con lotes de llegada pero sin cierre */
  sinCierre: number;
}

export interface ContextoAnalisis {
  productos: Record<string, Producto>;
  hoy: string;
  umbrales?: UmbralesRiesgo;
  pdv?: Pdv;
}

export function analizar(f: FormRegistro, ctx: ContextoAnalisis): Analisis {
  const lab = f.tipoDia === 'Laboral';
  const alertas: AlertaProducto[] = [];
  const riesgos: Analisis['riesgos'] = [];
  let nProductos = 0;
  let vencidosSinNovedad = 0;
  let sinCierre = 0;
  if (lab) {
    for (const [cod, it] of Object.entries(f.items)) {
      if (!tieneDatos(it)) continue;
      nProductos++;
      const nombre = nombreProducto(ctx.productos[cod], cod);
      const a = alertasItem(it, f.fecha);
      if (a.length) alertas.push({ cod, nombre, alertas: a });
      const rs = riesgosItem(cod, it, ctx.hoy, ctx.umbrales);
      riesgos.push(...rs.map((r) => ({ ...r, nombre })));
      const vig = it.lotesFin ?? it.lotesIni ?? [];
      vencidosSinNovedad += rs.filter(
        (r) => r.nivel === 'vencido' && !vig.find((l) => l.id === r.loteId)?.novedad,
      ).length;
      if (it.lotesIni !== undefined && it.lotesFin === undefined) sinCierre++;
    }
  }
  riesgos.sort((a, b) => a.dias - b.dias);
  return {
    nProductos,
    alertas,
    totalAlertas: alertas.reduce((s, x) => s + x.alertas.length, 0),
    riesgos,
    vencidosSinNovedad,
    fotosLocales: lab ? contarFotosLocales(f) : 0,
    peor: peorNivel(riesgos.map((r) => r.nivel)),
    geo: lab && f.geo && ctx.pdv ? evaluarGeo(f.geo, ctx.pdv) : null,
    sinCierre,
  };
}

/** Errores que impiden guardar (no se pueden saltar). */
export function bloqueos(f: FormRegistro, a: Analisis): string[] {
  const out: string[] = [];
  if (!f.pdvId) out.push('Elige el punto de venta.');
  if (f.tipoDia === 'Laboral') {
    if (!f.geo) out.push('Falta tu ubicación (GPS). Es obligatoria para un día laboral.');
    if (a.nProductos === 0) out.push('Registra al menos un producto (o cambia el tipo de día).');
  }
  return out;
}

export function resumenCola(_f: FormRegistro, a: Analisis, pdvNombre: string): ResumenCola {
  return {
    pdvNombre,
    nProductos: a.nProductos,
    peorNivel: a.peor,
    fueraDeRango: a.geo ? (a.geo.dentroDeRango === null ? null : !a.geo.dentroDeRango) : null,
  };
}

/** Estado del turno: ¿falta registrar el cierre de algún producto? */
export function estadoCierre(r: {
  tipoDia: string;
  items?: Record<string, Partial<Item>>;
}): 'completo' | 'falta-cierre' | 'no-laboral' {
  if (r.tipoDia !== 'Laboral') return 'no-laboral';
  const its = Object.values(r.items ?? {}).filter(tieneDatos);
  return its.some((it) => it.lotesIni !== undefined && it.lotesFin === undefined) ? 'falta-cierre' : 'completo';
}

/** Peor nivel de un ítem (atajo para la tarjeta). */
export const nivelDeItem = (it: Partial<Item>, hoy: string, u?: UmbralesRiesgo) => nivelItem(it, hoy, u);
