import {
  diffDias,
  finOf,
  iniOf,
  kgEq,
  nivelPorFecha,
  nivelItem,
  INFO_NIVEL,
  ventaOf,
  vtoMinOf,
  type Config,
  type Foto,
  type Item,
  type Lote,
  type UmbralesRiesgo,
} from '@merca/shared';
import ExcelJS from 'exceljs';
import { fechaHoraBogota } from '../utils/varios.js';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface Columna {
  header: string;
  key: string;
  width?: number;
  /** formato numérico de Excel, p. ej. '0.000' */
  numFmt?: string;
}

type Fila = Record<string, unknown>;

/** Crea una hoja con encabezados en negrita, fila congelada, autofiltro y anchos razonables. */
export function agregarHoja(wb: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: Fila[]) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columnas.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.min(40, Math.max(10, c.header.length + 2)),
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  for (const f of filas) ws.addRow(f);
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8F1D2C' } };
  h.alignment = { vertical: 'middle' };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, columnas.length) } };
  return ws;
}

export async function aBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

export function nuevoLibro() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LOMUS · Mercaimpulso';
  wb.created = new Date();
  return wb;
}

/* ───────── Tipos mínimos ───────── */

export interface RegistroX {
  _id: string;
  fecha: string;
  turno: string;
  tipoDia: string;
  impulsadoraId: string;
  impulsadoraNombre: string;
  pdvId: string;
  pdvNombre: string;
  ciudad: string;
  items: Record<string, Partial<Item>>;
  ejec?: { exhib?: string | null; frentesL?: number | null; frentesC?: number | null; precioOk?: string | null; pop?: string | null; temp?: number | null };
  comp?: Record<string, { precio?: number | null; act?: string }>;
  impulso?: { abordados?: number | null; degust?: number | null; compras?: number | null };
  nov?: string[];
  obs?: string;
  fotosGondola?: Foto[];
  geo?: { lat: number; lng: number; precisionM?: number; distanciaPdvM: number | null; dentroDeRango: boolean | null; capturadoEn?: string } | null;
  creadoEn: Date | string;
  actualizadoEn: Date | string;
  creadoPor?: string;
  actualizadoPor?: string;
  mismoDia?: boolean;
  origen?: string;
}

export type ProductosMap = Record<string, { nombre: string; unidad: 'kg' | 'und'; pesoKg: number | null }>;

const siNo = (b: boolean | null | undefined) => (b === true ? 'Sí' : b === false ? 'No' : '');
const n = (v: number | null | undefined) => (v === null || v === undefined ? null : v);
const urls = (fotos: Foto[] | undefined) => (fotos ?? []).map((f) => f.url).join('\n');
const etiquetaNivel = (nivel: keyof typeof INFO_NIVEL) => INFO_NIVEL[nivel].etiqueta;

function riesgoLote(l: Lote, ref: string, u: UmbralesRiesgo) {
  if (!l.vto) return { dias: null as number | null, nivel: '' };
  const r = nivelPorFecha(l.vto, ref, u);
  return { dias: r.dias, nivel: etiquetaNivel(r.nivel) };
}

/* ───────── Export "Detalle" (una fila por lote por producto por registro) ───────── */

export const COLUMNAS_DETALLE: Columna[] = [
  { header: 'fecha', key: 'fecha', width: 12 },
  { header: 'turno', key: 'turno', width: 10 },
  { header: 'tipo_dia', key: 'tipo_dia', width: 12 },
  { header: 'mercaimpulsadora', key: 'mercaimpulsadora', width: 24 },
  { header: 'punto_venta', key: 'punto_venta', width: 22 },
  { header: 'ciudad', key: 'ciudad', width: 14 },
  { header: 'codigo', key: 'codigo', width: 9 },
  { header: 'producto', key: 'producto', width: 34 },
  { header: 'unidad', key: 'unidad', width: 8 },
  { header: 'momento', key: 'momento', width: 10 },
  { header: 'lote', key: 'lote', width: 14 },
  { header: 'cantidad', key: 'cantidad', width: 10, numFmt: '0.###' },
  { header: 'cantidad_kg_eq', key: 'cantidad_kg_eq', width: 14, numFmt: '0.###' },
  { header: 'vence', key: 'vence', width: 12 },
  { header: 'dias_a_vencer', key: 'dias_a_vencer', width: 13 },
  { header: 'nivel_riesgo', key: 'nivel_riesgo', width: 26 },
  { header: 'inv_inicial', key: 'inv_inicial', width: 11, numFmt: '0.###' },
  { header: 'recibido', key: 'recibido', width: 10, numFmt: '0.###' },
  { header: 'inv_final', key: 'inv_final', width: 10, numFmt: '0.###' },
  { header: 'averia', key: 'averia', width: 9, numFmt: '0.###' },
  { header: 'venta', key: 'venta', width: 9, numFmt: '0.###' },
  { header: 'venta_kg_eq', key: 'venta_kg_eq', width: 12, numFmt: '0.###' },
  { header: 'agotado', key: 'agotado', width: 9 },
  { header: 'novedad_tipo', key: 'novedad_tipo', width: 22 },
  { header: 'novedad_nota', key: 'novedad_nota', width: 30 },
  { header: 'novedad_fotos', key: 'novedad_fotos', width: 40 },
  { header: 'exhibicion', key: 'exhibicion', width: 11 },
  { header: 'frentes_lomus', key: 'frentes_lomus', width: 13 },
  { header: 'frentes_comp', key: 'frentes_comp', width: 13 },
  { header: 'precio_ok', key: 'precio_ok', width: 10 },
  { header: 'temp_c', key: 'temp_c', width: 8 },
  { header: 'abordados', key: 'abordados', width: 10 },
  { header: 'compras', key: 'compras', width: 9 },
  { header: 'novedades', key: 'novedades', width: 30 },
  { header: 'observaciones', key: 'observaciones', width: 36 },
  { header: 'gps_distancia_m', key: 'gps_distancia_m', width: 15 },
  { header: 'gps_en_rango', key: 'gps_en_rango', width: 12 },
  { header: 'registrado_mismo_dia', key: 'registrado_mismo_dia', width: 19 },
  { header: 'actualizado', key: 'actualizado', width: 19 },
];

/**
 * Filas del export. Los valores del producto (inv_inicial, recibido, inv_final, averia, venta)
 * van solo en la primera fila de cada producto para que las sumas en Excel no se dupliquen.
 * `dias_a_vencer` y `nivel_riesgo` se calculan respecto a la fecha del conteo.
 */
export function filasDetalle(regs: RegistroX[], P: ProductosMap, u: UmbralesRiesgo): Fila[] {
  const out: Fila[] = [];
  for (const r of regs) {
    const e = r.ejec ?? {};
    const imp = r.impulso ?? {};
    const base: Fila = {
      fecha: r.fecha,
      turno: r.turno,
      tipo_dia: r.tipoDia,
      mercaimpulsadora: r.impulsadoraNombre,
      punto_venta: r.pdvNombre,
      ciudad: r.ciudad,
      exhibicion: e.exhib ?? '',
      frentes_lomus: n(e.frentesL),
      frentes_comp: n(e.frentesC),
      precio_ok: e.precioOk ?? '',
      temp_c: n(e.temp),
      abordados: n(imp.abordados),
      compras: n(imp.compras),
      novedades: (r.nov ?? []).join('; '),
      observaciones: r.obs ?? '',
      gps_distancia_m: n(r.geo?.distanciaPdvM),
      gps_en_rango: siNo(r.geo?.dentroDeRango),
      registrado_mismo_dia: siNo(r.mismoDia),
      actualizado: fechaHoraBogota(r.actualizadoEn),
    };
    const cods = Object.keys(r.items ?? {}).sort();
    if (!cods.length) {
      out.push(base);
      continue;
    }
    for (const cod of cods) {
      const it = r.items[cod];
      const prod = P[cod];
      const venta = ventaOf(it);
      const datosProd: Fila = {
        codigo: cod,
        producto: prod?.nombre ?? cod,
        unidad: prod?.unidad ?? '',
      };
      const totales: Fila = {
        inv_inicial: iniOf(it),
        recibido: n(it.rec),
        inv_final: finOf(it),
        averia: n(it.ave),
        venta,
        venta_kg_eq: kgEq(prod, venta),
        agotado: it.agot ? 'Sí' : 'No',
      };
      const lotes: { momento: string; l: Lote }[] = [
        ...(it.lotesIni ?? []).map((l) => ({ momento: 'llegada', l })),
        ...(it.lotesFin ?? []).map((l) => ({ momento: 'cierre', l })),
      ];
      if (!lotes.length) {
        out.push({ ...base, ...datosProd, ...totales });
        continue;
      }
      lotes.forEach(({ momento, l }, i) => {
        const rl = riesgoLote(l, r.fecha, u);
        out.push({
          ...base,
          ...datosProd,
          ...(i === 0 ? totales : { agotado: totales.agotado }),
          momento,
          lote: l.id,
          cantidad: l.cantidad,
          cantidad_kg_eq: kgEq(prod, l.cantidad),
          vence: l.vto ?? '',
          dias_a_vencer: rl.dias,
          nivel_riesgo: rl.nivel,
          novedad_tipo: l.novedad?.tipo ?? '',
          novedad_nota: l.novedad?.nota ?? '',
          novedad_fotos: urls(l.novedad?.fotos),
        });
      });
    }
  }
  return out;
}

export async function libroExport(regs: RegistroX[], P: ProductosMap, u: UmbralesRiesgo) {
  const wb = nuevoLibro();
  agregarHoja(wb, 'Detalle', COLUMNAS_DETALLE, filasDetalle(regs, P, u));
  return aBuffer(wb);
}

/* ───────── Backup completo ───────── */

export interface DatosBackup {
  registros: RegistroX[];
  productos: { _id: string; nombre: string; unidad: string; pesoKg: number | null; activo: boolean }[];
  pdvs: {
    _id: string;
    nombre: string;
    cadena: string;
    ciudad: string;
    portafolio: string[];
    ubicacion: { lat: number; lng: number } | null;
    radioM: number;
    activo: boolean;
  }[];
  usuarios: {
    _id: string;
    nombre: string;
    usuario: string;
    rol: string;
    ciudad: string;
    pdvIds: string[];
    activo: boolean;
    debeCambiarPassword: boolean;
    ultimoAcceso: Date | null;
    bloqueadoHasta: Date | null;
    creadoEn: Date | null;
  }[];
  config: Config;
  auditoria: {
    en: Date;
    usuarioId: string | null;
    usuarioNombre: string;
    rol: string | null;
    accion: string;
    entidad: string | null;
    entidadId: string | null;
    resumen: string;
    cambios: unknown;
    ip: string | null;
    dispositivo: string | null;
    geo: { lat: number; lng: number } | null;
  }[];
  hoy: string;
}

export async function libroBackup(d: DatosBackup) {
  const wb = nuevoLibro();
  const P: ProductosMap = {};
  for (const p of d.productos) P[p._id] = { nombre: p.nombre, unidad: p.unidad as 'kg' | 'und', pesoKg: p.pesoKg };
  const u = d.config.riesgoVto;

  // Registros
  agregarHoja(
    wb,
    'Registros',
    [
      { header: 'id', key: 'id', width: 46 },
      { header: 'fecha', key: 'fecha', width: 12 },
      { header: 'turno', key: 'turno', width: 10 },
      { header: 'tipo_dia', key: 'tipoDia', width: 12 },
      { header: 'mercaimpulsadora', key: 'imp', width: 24 },
      { header: 'punto_venta', key: 'pdv', width: 22 },
      { header: 'ciudad', key: 'ciudad', width: 14 },
      { header: 'productos', key: 'productos', width: 10 },
      { header: 'exhibicion', key: 'exhib', width: 11 },
      { header: 'frentes_lomus', key: 'fl', width: 13 },
      { header: 'frentes_comp', key: 'fc', width: 13 },
      { header: 'precio_ok', key: 'precioOk', width: 10 },
      { header: 'pop', key: 'pop', width: 6 },
      { header: 'temp_c', key: 'temp', width: 8 },
      { header: 'abordados', key: 'ab', width: 10 },
      { header: 'degustaciones', key: 'deg', width: 13 },
      { header: 'compras', key: 'co', width: 9 },
      { header: 'competencia', key: 'comp', width: 40 },
      { header: 'novedades', key: 'nov', width: 30 },
      { header: 'observaciones', key: 'obs', width: 36 },
      { header: 'fotos_gondola', key: 'fotos', width: 40 },
      { header: 'gps_lat', key: 'lat', width: 11 },
      { header: 'gps_lng', key: 'lng', width: 11 },
      { header: 'gps_precision_m', key: 'prec', width: 15 },
      { header: 'gps_distancia_m', key: 'dist', width: 15 },
      { header: 'gps_en_rango', key: 'rango', width: 12 },
      { header: 'registrado_mismo_dia', key: 'mismoDia', width: 19 },
      { header: 'origen', key: 'origen', width: 12 },
      { header: 'creado', key: 'creado', width: 19 },
      { header: 'actualizado', key: 'actualizado', width: 19 },
    ],
    d.registros.map((r) => ({
      id: r._id,
      fecha: r.fecha,
      turno: r.turno,
      tipoDia: r.tipoDia,
      imp: r.impulsadoraNombre,
      pdv: r.pdvNombre,
      ciudad: r.ciudad,
      productos: Object.keys(r.items ?? {}).length,
      exhib: r.ejec?.exhib ?? '',
      fl: n(r.ejec?.frentesL),
      fc: n(r.ejec?.frentesC),
      precioOk: r.ejec?.precioOk ?? '',
      pop: r.ejec?.pop ?? '',
      temp: n(r.ejec?.temp),
      ab: n(r.impulso?.abordados),
      deg: n(r.impulso?.degust),
      co: n(r.impulso?.compras),
      comp: Object.entries(r.comp ?? {})
        .map(([m, c]) => `${m}: ${c.precio ?? '—'} (${c.act ?? 'Ninguna'})`)
        .join('; '),
      nov: (r.nov ?? []).join('; '),
      obs: r.obs ?? '',
      fotos: urls(r.fotosGondola),
      lat: r.geo?.lat ?? null,
      lng: r.geo?.lng ?? null,
      prec: r.geo?.precisionM ?? null,
      dist: n(r.geo?.distanciaPdvM),
      rango: siNo(r.geo?.dentroDeRango),
      mismoDia: siNo(r.mismoDia),
      origen: r.origen ?? '',
      creado: fechaHoraBogota(r.creadoEn),
      actualizado: fechaHoraBogota(r.actualizadoEn),
    })),
  );

  // Detalle productos (una fila por producto por registro)
  const detalle: Fila[] = [];
  const lotesF: Fila[] = [];
  const novedades: Fila[] = [];
  for (const r of d.registros) {
    for (const [cod, it] of Object.entries(r.items ?? {})) {
      const prod = P[cod];
      const venta = ventaOf(it);
      const vtoMin = vtoMinOf(it);
      detalle.push({
        id: r._id,
        fecha: r.fecha,
        turno: r.turno,
        imp: r.impulsadoraNombre,
        pdv: r.pdvNombre,
        cod,
        producto: prod?.nombre ?? cod,
        unidad: prod?.unidad ?? '',
        ini: iniOf(it),
        rec: n(it.rec),
        fin: finOf(it),
        ave: n(it.ave),
        venta,
        ventaKg: kgEq(prod, venta),
        agot: it.agot ? 'Sí' : 'No',
        vtoMin: vtoMin ?? '',
        dias: vtoMin ? diffDias(vtoMin, r.fecha) : null,
        nivel: etiquetaNivel(nivelItem(it, r.fecha, u)),
      });
      const todos: { momento: 'llegada' | 'cierre'; l: Lote }[] = [
        ...(it.lotesIni ?? []).map((l) => ({ momento: 'llegada' as const, l })),
        ...(it.lotesFin ?? []).map((l) => ({ momento: 'cierre' as const, l })),
      ];
      for (const { momento, l } of todos) {
        const rl = riesgoLote(l, r.fecha, u);
        lotesF.push({
          id: r._id,
          fecha: r.fecha,
          turno: r.turno,
          imp: r.impulsadoraNombre,
          pdv: r.pdvNombre,
          cod,
          producto: prod?.nombre ?? cod,
          momento,
          lote: l.id,
          cantidad: l.cantidad,
          kg: kgEq(prod, l.cantidad),
          vto: l.vto ?? '',
          dias: rl.dias,
          nivel: rl.nivel,
          novedad: l.novedad?.tipo ?? '',
        });
        if (l.novedad) {
          const fotos = l.novedad.fotos ?? [];
          novedades.push({
            id: r._id,
            fecha: r.fecha,
            turno: r.turno,
            imp: r.impulsadoraNombre,
            pdv: r.pdvNombre,
            cod,
            producto: prod?.nombre ?? cod,
            momento,
            lote: l.id,
            cantidad: l.cantidad,
            vto: l.vto ?? '',
            tipo: l.novedad.tipo,
            nota: l.novedad.nota ?? '',
            foto1: fotos[0] ? { text: 'Ver foto 1', hyperlink: fotos[0].url } : '',
            foto2: fotos[1] ? { text: 'Ver foto 2', hyperlink: fotos[1].url } : '',
            foto3: fotos[2] ? { text: 'Ver foto 3', hyperlink: fotos[2].url } : '',
          });
        }
      }
    }
  }
  agregarHoja(
    wb,
    'Detalle productos',
    [
      { header: 'registro', key: 'id', width: 46 },
      { header: 'fecha', key: 'fecha', width: 12 },
      { header: 'turno', key: 'turno', width: 10 },
      { header: 'mercaimpulsadora', key: 'imp', width: 24 },
      { header: 'punto_venta', key: 'pdv', width: 22 },
      { header: 'codigo', key: 'cod', width: 9 },
      { header: 'producto', key: 'producto', width: 34 },
      { header: 'unidad', key: 'unidad', width: 8 },
      { header: 'inv_inicial', key: 'ini', width: 11, numFmt: '0.###' },
      { header: 'recibido', key: 'rec', width: 10, numFmt: '0.###' },
      { header: 'inv_final', key: 'fin', width: 10, numFmt: '0.###' },
      { header: 'averia', key: 'ave', width: 9, numFmt: '0.###' },
      { header: 'venta', key: 'venta', width: 9, numFmt: '0.###' },
      { header: 'venta_kg_eq', key: 'ventaKg', width: 12, numFmt: '0.###' },
      { header: 'agotado', key: 'agot', width: 9 },
      { header: 'vence_mas_proximo', key: 'vtoMin', width: 17 },
      { header: 'dias_a_vencer', key: 'dias', width: 13 },
      { header: 'nivel_riesgo', key: 'nivel', width: 26 },
    ],
    detalle,
  );
  agregarHoja(
    wb,
    'Lotes',
    [
      { header: 'registro', key: 'id', width: 46 },
      { header: 'fecha', key: 'fecha', width: 12 },
      { header: 'turno', key: 'turno', width: 10 },
      { header: 'mercaimpulsadora', key: 'imp', width: 24 },
      { header: 'punto_venta', key: 'pdv', width: 22 },
      { header: 'codigo', key: 'cod', width: 9 },
      { header: 'producto', key: 'producto', width: 34 },
      { header: 'momento', key: 'momento', width: 10 },
      { header: 'lote', key: 'lote', width: 14 },
      { header: 'cantidad', key: 'cantidad', width: 10, numFmt: '0.###' },
      { header: 'cantidad_kg_eq', key: 'kg', width: 14, numFmt: '0.###' },
      { header: 'vence', key: 'vto', width: 12 },
      { header: 'dias_a_vencer', key: 'dias', width: 13 },
      { header: 'nivel_riesgo', key: 'nivel', width: 26 },
      { header: 'novedad', key: 'novedad', width: 22 },
    ],
    lotesF,
  );
  const wsNov = agregarHoja(
    wb,
    'Novedades',
    [
      { header: 'registro', key: 'id', width: 46 },
      { header: 'fecha', key: 'fecha', width: 12 },
      { header: 'turno', key: 'turno', width: 10 },
      { header: 'mercaimpulsadora', key: 'imp', width: 24 },
      { header: 'punto_venta', key: 'pdv', width: 22 },
      { header: 'codigo', key: 'cod', width: 9 },
      { header: 'producto', key: 'producto', width: 34 },
      { header: 'momento', key: 'momento', width: 10 },
      { header: 'lote', key: 'lote', width: 14 },
      { header: 'cantidad', key: 'cantidad', width: 10, numFmt: '0.###' },
      { header: 'vence', key: 'vto', width: 12 },
      { header: 'tipo', key: 'tipo', width: 24 },
      { header: 'nota', key: 'nota', width: 36 },
      { header: 'foto_1', key: 'foto1', width: 12 },
      { header: 'foto_2', key: 'foto2', width: 12 },
      { header: 'foto_3', key: 'foto3', width: 12 },
    ],
    novedades,
  );
  for (const k of ['foto1', 'foto2', 'foto3'])
    wsNov.getColumn(k).eachCell((c, row) => {
      if (row > 1 && c.value) c.font = { color: { argb: 'FF0563C1' }, underline: true };
    });

  agregarHoja(
    wb,
    'Usuarios',
    [
      { header: 'id', key: '_id', width: 16 },
      { header: 'nombre', key: 'nombre', width: 26 },
      { header: 'usuario', key: 'usuario', width: 16 },
      { header: 'rol', key: 'rol', width: 12 },
      { header: 'ciudad', key: 'ciudad', width: 14 },
      { header: 'puntos_asignados', key: 'pdvIds', width: 50 },
      { header: 'activo', key: 'activo', width: 8 },
      { header: 'debe_cambiar_contrasena', key: 'debe', width: 23 },
      { header: 'ultimo_acceso', key: 'ultimo', width: 19 },
      { header: 'creado', key: 'creado', width: 19 },
    ],
    d.usuarios.map((x) => ({
      _id: x._id,
      nombre: x.nombre,
      usuario: x.usuario,
      rol: x.rol,
      ciudad: x.ciudad,
      pdvIds: x.pdvIds.join(', '),
      activo: siNo(x.activo),
      debe: siNo(x.debeCambiarPassword),
      ultimo: fechaHoraBogota(x.ultimoAcceso),
      creado: fechaHoraBogota(x.creadoEn),
    })),
  );
  agregarHoja(
    wb,
    'Puntos de venta',
    [
      { header: 'id', key: '_id', width: 20 },
      { header: 'nombre', key: 'nombre', width: 24 },
      { header: 'cadena', key: 'cadena', width: 16 },
      { header: 'ciudad', key: 'ciudad', width: 14 },
      { header: 'portafolio', key: 'portafolio', width: 40 },
      { header: 'lat', key: 'lat', width: 11 },
      { header: 'lng', key: 'lng', width: 11 },
      { header: 'radio_m', key: 'radioM', width: 9 },
      { header: 'activo', key: 'activo', width: 8 },
    ],
    d.pdvs.map((p) => ({
      _id: p._id,
      nombre: p.nombre,
      cadena: p.cadena,
      ciudad: p.ciudad,
      portafolio: p.portafolio.join(', '),
      lat: p.ubicacion?.lat ?? null,
      lng: p.ubicacion?.lng ?? null,
      radioM: p.radioM,
      activo: siNo(p.activo),
    })),
  );
  agregarHoja(
    wb,
    'Productos',
    [
      { header: 'codigo', key: '_id', width: 9 },
      { header: 'nombre', key: 'nombre', width: 40 },
      { header: 'unidad', key: 'unidad', width: 8 },
      { header: 'peso_kg', key: 'pesoKg', width: 9, numFmt: '0.###' },
      { header: 'activo', key: 'activo', width: 8 },
    ],
    d.productos.map((p) => ({ ...p, activo: siNo(p.activo) })),
  );
  const c = d.config;
  agregarHoja(
    wb,
    'Configuración',
    [
      { header: 'parametro', key: 'k', width: 34 },
      { header: 'valor', key: 'v', width: 80 },
    ],
    [
      { k: 'Meta días de inventario (DOH) máx.', v: c.metas.doh },
      { k: 'Meta % merma máx.', v: c.metas.merma },
      { k: 'Meta OSA mín.', v: c.metas.osa },
      { k: 'Meta share of shelf mín.', v: c.metas.sos },
      { k: 'Meta conversión mín.', v: c.metas.conv },
      { k: 'Riesgo medio (días ≤)', v: c.riesgoVto.medio },
      { k: 'Riesgo crítico (días ≤)', v: c.riesgoVto.critico },
      { k: 'Emergencia – salida (días ≤)', v: c.riesgoVto.emergencia },
      { k: 'Marcas de competencia', v: c.marcasCompetencia.join(', ') },
      { k: 'Novedades generales', v: c.novedadesGenerales.join(', ') },
      { k: 'Novedades de producto', v: c.novedadesProducto.join(', ') },
      { k: 'Fecha del backup', v: d.hoy },
    ],
  );
  agregarHoja(
    wb,
    'Auditoría',
    [
      { header: 'fecha_hora', key: 'en', width: 19 },
      { header: 'usuario', key: 'usuarioNombre', width: 22 },
      { header: 'usuario_id', key: 'usuarioId', width: 16 },
      { header: 'rol', key: 'rol', width: 12 },
      { header: 'accion', key: 'accion', width: 22 },
      { header: 'entidad', key: 'entidad', width: 12 },
      { header: 'entidad_id', key: 'entidadId', width: 40 },
      { header: 'resumen', key: 'resumen', width: 60 },
      { header: 'cambios', key: 'cambios', width: 60 },
      { header: 'ip', key: 'ip', width: 15 },
      { header: 'dispositivo', key: 'dispositivo', width: 30 },
      { header: 'gps', key: 'geo', width: 22 },
    ],
    d.auditoria.map((a) => ({
      en: fechaHoraBogota(a.en),
      usuarioNombre: a.usuarioNombre,
      usuarioId: a.usuarioId ?? '',
      rol: a.rol ?? '',
      accion: a.accion,
      entidad: a.entidad ?? '',
      entidadId: a.entidadId ?? '',
      resumen: a.resumen,
      cambios: a.cambios ? JSON.stringify(a.cambios).slice(0, 32_000) : '',
      ip: a.ip ?? '',
      dispositivo: a.dispositivo ?? '',
      geo: a.geo ? `${a.geo.lat}, ${a.geo.lng}` : '',
    })),
  );
  return aBuffer(wb);
}
