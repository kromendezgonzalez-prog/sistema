const nf = (d: number) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Número en formato colombiano; "–" si no hay dato. */
export function fmt(n: number | null | undefined, decimales = 1): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '–' : nf(decimales).format(n);
}

/** Porcentaje (0–1 → "45 %"). */
export function pct(n: number | null | undefined, decimales = 0): string {
  return n === null || n === undefined || !Number.isFinite(n)
    ? '–'
    : `${nf(decimales).format(n * 100)} %`;
}

export function pesos(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n)
    ? '–'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-11-16" → "lun 16 nov" */
export function fechaCorta(s: string | null | undefined): string {
  if (!s) return '–';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[dt.getUTCDay()]} ${d} ${MESES[m - 1]}`;
}

/** ISO → "16 nov, 3:45 p. m." en hora Colombia */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Convierte texto del usuario ("1,5") a número o null. */
export function aNumero(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
