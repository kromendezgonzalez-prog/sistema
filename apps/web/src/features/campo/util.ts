import { TURNOS, type Pdv, type Producto, type Turno, type UsuarioPublico } from '@merca/shared';
import { fmt } from '@/lib/formato';

/** "PUNTA DE ANCA DE CERDO LOMUS" → "Punta de anca de cerdo LOMUS" */
export function nombreProducto(p: Pick<Producto, 'nombre'> | undefined, cod?: string): string {
  if (!p) return cod ? `Producto ${cod}` : 'Producto';
  const n = p.nombre.trim();
  if (n !== n.toUpperCase()) return n;
  const s = n.toLowerCase().replace(/\blomus\b/g, 'LOMUS').replace(/\bst\.\s/g, 'St. ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const unidadCorta = (p?: Pick<Producto, 'unidad'>) => (p?.unidad === 'und' ? 'und' : 'kg');

/** "kg" · "und (500 g)" */
export function textoUnidad(p?: Pick<Producto, 'unidad' | 'pesoKg'>): string {
  if (!p || p.unidad === 'kg') return 'kg';
  return p.pesoKg ? `und (${fmt(p.pesoKg * 1000, 0)} g)` : 'und';
}

export function cantidadTxt(n: number | null | undefined, p?: Pick<Producto, 'unidad'>): string {
  if (n === null || n === undefined) return '–';
  return `${fmt(n, p?.unidad === 'und' ? 0 : 2)} ${unidadCorta(p)}`;
}

/** Turno sugerido según la hora (antes de la 1 p. m. → Mañana). */
function horaBogota(ahora: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(ahora),
  );
}

export function turnoPorHora(ahora = new Date()): Turno {
  return horaBogota(ahora) < 13 ? 'Mañana' : 'Tarde';
}

export const ordenTurno = (t: string) => TURNOS.indexOf(t as Turno);

/** Puntos que la persona puede elegir: asignados primero; admin ve todos. */
export function puntosDisponibles(usuario: UsuarioPublico | null, pdvs: Pdv[]) {
  const activos = pdvs.filter((p) => p.activo !== false);
  const asignados = activos.filter((p) => usuario?.pdvIds.includes(p._id));
  const otros = activos.filter((p) => !usuario?.pdvIds.includes(p._id));
  if (usuario?.rol === 'admin') return { asignados, otros };
  // impulsadora sin puntos asignados: se muestran todos (el servidor valida)
  if (!asignados.length) return { asignados: [], otros: activos };
  return { asignados, otros: [] as Pdv[] };
}

/** Saludo según la hora en Colombia. */
export function saludo(ahora = new Date()): string {
  const h = horaBogota(ahora);
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Fecha larga: "lunes 16 de noviembre" */
export function fechaLarga(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function metros(m: number): string {
  return m >= 1000 ? `${fmt(m / 1000, 1)} km` : `${fmt(m, 0)} m`;
}
