import { TURNOS } from '@merca/shared';

/**
 * JSON con claves ordenadas (para comparar objetos sin importar el orden).
 * Las claves con valor null/undefined se omiten (Mongo puede guardar undefined como null).
 */
export function jsonEstable(v: unknown): string {
  return JSON.stringify(ordenar(v));
}
function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined && x !== null) out[k] = ordenar(x);
    }
    return out;
  }
  return v;
}

export const iguales = (a: unknown, b: unknown) => jsonEstable(a) === jsonEstable(b);

export function turnoOrden(t: string): number {
  const i = TURNOS.indexOf(t as (typeof TURNOS)[number]);
  return i < 0 ? 9 : i;
}

/** Inicio del día YYYY-MM-DD en Bogotá (UTC−5, sin horario de verano) como Date UTC. */
export function inicioDiaBogota(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000-05:00`);
}
export function finDiaBogota(fecha: string): Date {
  return new Date(`${fecha}T23:59:59.999-05:00`);
}

/** "2026-11-16 08:30" en hora de Bogotá. */
export function fechaHoraBogota(d: Date | string | null | undefined): string {
  if (!d) return '';
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return f.format(new Date(d));
}

export function escaparRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Paginación común: pagina ≥ 1, porPagina 1..max. */
export function paginacion(pagina: number | undefined, porPagina: number | undefined, def = 50, max = 200) {
  const p = Math.max(1, Math.floor(pagina ?? 1));
  const pp = Math.min(max, Math.max(1, Math.floor(porPagina ?? def)));
  return { pagina: p, porPagina: pp, saltar: (p - 1) * pp };
}
