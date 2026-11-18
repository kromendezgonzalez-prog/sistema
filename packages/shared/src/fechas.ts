/** Fechas de negocio: siempre "YYYY-MM-DD" en hora de Colombia (America/Bogota, UTC-5 sin DST). */

export const TZ = 'America/Bogota';

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha de hoy (o de `ahora`) en Bogotá como "YYYY-MM-DD". */
export function hoyBogota(ahora: Date = new Date()): string {
  return fmtFecha.format(ahora);
}

export function esFechaValida(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtc(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** a − b en días calendario. */
export function diffDias(a: string, b: string): number {
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
}

export function sumarDias(s: string, n: number): string {
  const d = new Date(toUtc(s) + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Lista de fechas desde..hasta inclusive. */
export function rangoFechas(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const n = diffDias(hasta, desde);
  for (let i = 0; i <= n; i++) out.push(sumarDias(desde, i));
  return out;
}
