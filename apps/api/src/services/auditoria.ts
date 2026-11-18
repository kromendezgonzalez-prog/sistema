import type { AccionAuditoria } from '@merca/shared';
import type { Request } from 'express';
import { Auditoria } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { iguales } from '../utils/varios.js';

export type Cambios = Record<string, { antes: unknown; despues: unknown }>;

export interface DatosEvento {
  accion: AccionAuditoria;
  entidad?: string | null;
  entidadId?: string | null;
  resumen: string;
  cambios?: Cambios | null;
  geo?: { lat: number; lng: number } | null;
  /** si no hay usuario autenticado (p. ej. login fallido) */
  usuario?: { _id?: string | null; nombre?: string; rol?: string | null } | null;
}

/** Escribe un evento de auditoría. Nunca lanza: un fallo de auditoría no debe romper la operación. */
export async function auditar(req: Request | null, d: DatosEvento): Promise<void> {
  const u = d.usuario ?? req?.usuario ?? null;
  try {
    await Auditoria.create({
      en: new Date(),
      usuarioId: u?._id ?? null,
      usuarioNombre: u?.nombre ?? '',
      rol: u?.rol ?? null,
      accion: d.accion,
      entidad: d.entidad ?? null,
      entidadId: d.entidadId ?? null,
      resumen: d.resumen,
      cambios: d.cambios && Object.keys(d.cambios).length ? d.cambios : null,
      ip: req?.ip ?? null,
      dispositivo: req ? String(req.get('user-agent') ?? '').slice(0, 200) || null : null,
      geo: d.geo ? { lat: d.geo.lat, lng: d.geo.lng } : null,
    });
  } catch (e) {
    logger.error({ err: e, accion: d.accion }, 'No se pudo escribir la auditoría');
  }
}

/** Diferencias campo a campo entre dos objetos planos (solo las claves indicadas). */
export function diffCampos<T extends Record<string, unknown>>(
  antes: Partial<T> | null | undefined,
  despues: Partial<T>,
  claves: (keyof T & string)[],
): Cambios {
  const out: Cambios = {};
  for (const k of claves) {
    if (!(k in despues)) continue;
    const a = antes?.[k] ?? null;
    const b = despues[k] ?? null;
    if (!iguales(a, b)) out[k] = { antes: a, despues: b };
  }
  return out;
}
