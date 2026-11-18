import {
  DIAS_EDICION,
  diffDias,
  evaluarGeo,
  finOf,
  hoyBogota,
  iniOf,
  registroId,
  riesgosRegistro,
  type Config,
  type GeoRegistro,
  type Item,
  type Registro as RegistroT,
  type RegistroInput,
} from '@merca/shared';
import type { Request } from 'express';
import { Pdv, Producto, Registro, Usuario } from '../models/index.js';
import type { UsuarioAuth } from '../middleware/auth.js';
import { HttpError, invalido, noEncontrado, sinPermiso } from '../utils/errores.js';
import { iguales, turnoOrden } from '../utils/varios.js';
import { auditar, type Cambios } from './auditoria.js';
import { obtenerConfig } from './config.js';

export type Origen = 'online' | 'offline-sync';

/** Convierte un documento guardado al tipo público `Registro` (sin campos internos). */
export function aRegistro(doc: Record<string, unknown>): RegistroT {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { turnoOrden: _t, ...resto } = doc;
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string));
  return {
    ...(resto as unknown as RegistroT),
    _id: String(doc._id),
    creadoEn: iso(doc.creadoEn),
    actualizadoEn: iso(doc.actualizadoEn),
  };
}

/** Resumen corto de un ítem para el diff de auditoría. */
function resumenItem(it: Partial<Item> | undefined) {
  if (!it) return null;
  const novedades = [...(it.lotesIni ?? []), ...(it.lotesFin ?? [])].filter((l) => l.novedad).length;
  return {
    ini: iniOf(it),
    rec: it.rec ?? null,
    fin: finOf(it),
    ave: it.ave ?? null,
    agot: !!it.agot,
    lotesIni: it.lotesIni?.length ?? null,
    lotesFin: it.lotesFin?.length ?? null,
    novedades,
  };
}

/** Diff resumido: qué secciones y qué productos cambiaron (no el documento entero). */
export function diffRegistro(antes: Record<string, unknown>, despues: Record<string, unknown>): Cambios {
  const out: Cambios = {};
  for (const k of ['tipoDia', 'ejec', 'comp', 'impulso', 'nov', 'obs', 'fotosGondola']) {
    if (!iguales(antes[k] ?? null, despues[k] ?? null)) {
      const a = antes[k] ?? null;
      const b = despues[k] ?? null;
      out[k] =
        k === 'fotosGondola'
          ? { antes: (a as unknown[] | null)?.length ?? 0, despues: (b as unknown[] | null)?.length ?? 0 }
          : { antes: a, despues: b };
    }
  }
  const ga = antes.geo as GeoRegistro | null;
  const gb = despues.geo as GeoRegistro | null;
  const geoCorto = (g: GeoRegistro | null) =>
    g ? { lat: g.lat, lng: g.lng, distanciaPdvM: g.distanciaPdvM, dentroDeRango: g.dentroDeRango } : null;
  if (!iguales(geoCorto(ga), geoCorto(gb))) out.geo = { antes: geoCorto(ga), despues: geoCorto(gb) };

  const ia = (antes.items ?? {}) as Record<string, Partial<Item>>;
  const ib = (despues.items ?? {}) as Record<string, Partial<Item>>;
  for (const cod of new Set([...Object.keys(ia), ...Object.keys(ib)])) {
    if (!iguales(ia[cod] ?? null, ib[cod] ?? null))
      out[`items.${cod}`] = { antes: resumenItem(ia[cod]), despues: resumenItem(ib[cod]) };
  }
  return out;
}

export interface ResultadoGuardado {
  registro: RegistroT;
  creado: boolean;
}

/**
 * Crea o reemplaza un registro aplicando TODAS las reglas del servidor.
 * `idUrl` es el `:id` de la URL (PUT) o null (sync, donde el id se calcula).
 */
export async function guardarRegistro(
  req: Request,
  yo: UsuarioAuth,
  input: RegistroInput,
  idUrl: string | null,
  origen: Origen,
  configCache?: Config,
): Promise<ResultadoGuardado> {
  if (yo.rol === 'supervisor') throw sinPermiso('El rol supervisor solo puede consultar registros.');

  const ahora = new Date();
  const hoy = hoyBogota(ahora);

  // 1) ¿A nombre de quién?
  let impulsadora: { _id: string; nombre: string; ciudad: string };
  if (yo.rol === 'impulsadora') {
    impulsadora = { _id: yo._id, nombre: yo.nombre, ciudad: yo.ciudad };
  } else {
    const objetivoId = input.impulsadoraId?.trim() || yo._id;
    if (objetivoId === yo._id) impulsadora = { _id: yo._id, nombre: yo.nombre, ciudad: yo.ciudad };
    else {
      const u = await Usuario.findById(objetivoId).select('nombre ciudad').lean();
      if (!u)
        throw invalido('La mercaimpulsadora indicada no existe.', [
          { path: 'impulsadoraId', message: 'No existe' },
        ]);
      impulsadora = { _id: String(u._id), nombre: u.nombre, ciudad: u.ciudad ?? '' };
    }
  }

  // 2) id determinístico
  const id = registroId(input.fecha, impulsadora._id, input.pdvId, input.turno);
  if (idUrl !== null && idUrl !== id)
    throw invalido('El identificador del registro no coincide con su fecha, persona, punto y turno.', [
      { path: 'id', message: `Se esperaba "${id}"` },
    ]);

  // 3) Fecha
  if (input.fecha > hoy)
    throw invalido('La fecha no puede ser futura.', [{ path: 'fecha', message: 'Fecha futura' }]);
  if (yo.rol === 'impulsadora' && diffDias(hoy, input.fecha) > DIAS_EDICION)
    throw new HttpError(
      403,
      `Solo puedes registrar o editar hasta ${DIAS_EDICION} días atrás. Pide a la administradora que haga este cambio.`,
      'FUERA_DE_PLAZO',
    );

  // 4) Punto de venta
  const pdv = await Pdv.findById(input.pdvId).lean();
  if (!pdv || pdv.activo === false)
    throw invalido('El punto de venta no existe o está inactivo.', [
      { path: 'pdvId', message: 'Punto de venta inválido' },
    ]);
  if (yo.rol === 'impulsadora' && !yo.pdvIds.includes(input.pdvId))
    throw sinPermiso('Ese punto de venta no está asignado a ti.');

  // 5) Productos
  const cods = Object.keys(input.items ?? {});
  if (cods.length) {
    const existentes = new Set(
      (await Producto.find({ _id: { $in: cods } }).select('_id').lean()).map((p) => String(p._id)),
    );
    const malos = cods.filter((c) => !existentes.has(c));
    if (malos.length)
      throw invalido(
        `Productos inexistentes en el catálogo: ${malos.join(', ')}`,
        malos.map((c) => ({ path: `items.${c}`, message: 'Producto inexistente' })),
      );
  }
  const clavesMalas = Object.keys(input.comp ?? {}).filter((k) => k.includes('.') || k.startsWith('$'));
  if (clavesMalas.length)
    throw invalido('Nombre de marca de competencia inválido.', clavesMalas.map((k) => ({ path: `comp.${k}`, message: 'Inválido' })));

  // 6) Campos calculados por el servidor
  const config = configCache ?? (await obtenerConfig());
  const geo: GeoRegistro | null = input.geo
    ? {
        ...input.geo,
        ...evaluarGeo(input.geo, {
          ubicacion: pdv.ubicacion && pdv.ubicacion.lat != null && pdv.ubicacion.lng != null
            ? { lat: pdv.ubicacion.lat, lng: pdv.ubicacion.lng }
            : null,
          radioM: pdv.radioM,
        }),
      }
    : null;
  const riesgos = riesgosRegistro(input.items ?? {}, hoy, config.riesgoVto);

  const antes = (await Registro.findById(id).lean()) as Record<string, unknown> | null;
  const capturadoMismoDia =
    origen === 'offline-sync' && !!input.geo?.capturadoEn && hoyBogota(new Date(input.geo.capturadoEn)) === input.fecha;
  const mismoDia = antes ? !!antes.mismoDia : input.fecha === hoy || capturadoMismoDia;

  const doc: Record<string, unknown> = {
    _id: id,
    fecha: input.fecha,
    turno: input.turno,
    turnoOrden: turnoOrden(input.turno),
    tipoDia: input.tipoDia,
    impulsadoraId: impulsadora._id,
    impulsadoraNombre: impulsadora.nombre,
    pdvId: String(pdv._id),
    pdvNombre: pdv.nombre,
    ciudad: pdv.ciudad || impulsadora.ciudad || '',
    items: input.items ?? {},
    ejec: input.ejec ?? {},
    comp: input.comp ?? {},
    impulso: input.impulso ?? {},
    nov: input.nov ?? [],
    obs: input.obs ?? '',
    fotosGondola: input.fotosGondola ?? [],
    geo,
    riesgos,
    creadoEn: (antes?.creadoEn as Date | undefined) ?? ahora,
    actualizadoEn: ahora,
    creadoPor: (antes?.creadoPor as string | undefined) ?? yo._id,
    actualizadoPor: yo._id,
    mismoDia,
    origen,
  };

  const descripcion = `${pdv.nombre} · ${input.fecha} ${input.turno} (${impulsadora.nombre})`;
  const geoAud = input.geo ? { lat: input.geo.lat, lng: input.geo.lng } : null;

  if (antes) {
    const cambios = diffRegistro(antes, doc);
    if (!Object.keys(cambios).length) {
      // Reenvío idéntico (p. ej. reintento offline): no se reescribe ni se audita.
      return { registro: aRegistro(antes), creado: false };
    }
    await Registro.replaceOne({ _id: id }, doc);
    const secciones = Object.keys(cambios);
    const prods = secciones.filter((s) => s.startsWith('items.')).length;
    const otras = secciones.filter((s) => !s.startsWith('items.'));
    await auditar(req, {
      accion: 'REGISTRO_EDITADO',
      entidad: 'registro',
      entidadId: id,
      resumen: `Editó registro de ${descripcion}: ${[prods ? `${prods} producto(s)` : '', ...otras].filter(Boolean).join(', ')}${origen === 'offline-sync' ? ' [sincronizado sin señal]' : ''}`,
      cambios,
      geo: geoAud,
    });
    if (geo?.dentroDeRango === false && cambios.geo) await auditarFueraDeRango(req, id, descripcion, geo, pdv.radioM);
    return { registro: aRegistro(doc), creado: false };
  }

  try {
    await Registro.create(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      throw new HttpError(409, 'Este registro se está guardando desde otro envío. Intenta de nuevo.', 'CONFLICTO');
    throw e;
  }
  await auditar(req, {
    accion: 'REGISTRO_CREADO',
    entidad: 'registro',
    entidadId: id,
    resumen: `Creó registro de ${descripcion} · ${input.tipoDia}, ${cods.length} producto(s)${origen === 'offline-sync' ? ' [sincronizado sin señal]' : ''}`,
    geo: geoAud,
  });
  if (geo?.dentroDeRango === false) await auditarFueraDeRango(req, id, descripcion, geo, pdv.radioM);
  return { registro: aRegistro(doc), creado: true };
}

async function auditarFueraDeRango(
  req: Request,
  id: string,
  descripcion: string,
  geo: GeoRegistro,
  radioM: number | null | undefined,
) {
  await auditar(req, {
    accion: 'GPS_FUERA_DE_RANGO',
    entidad: 'registro',
    entidadId: id,
    resumen: `Registro a ${geo.distanciaPdvM} m del punto (radio ${radioM ?? 300} m): ${descripcion}`,
    geo: { lat: geo.lat, lng: geo.lng },
  });
}

/** Lectura con control de acceso: impulsadora solo lo suyo. */
export async function leerRegistro(yo: UsuarioAuth, id: string): Promise<RegistroT> {
  const r = (await Registro.findById(id).lean()) as Record<string, unknown> | null;
  if (!r) throw noEncontrado('El registro no existe.');
  if (yo.rol === 'impulsadora' && r.impulsadoraId !== yo._id)
    throw sinPermiso('No puedes ver registros de otra persona.');
  return aRegistro(r);
}
