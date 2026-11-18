import { hoyBogota, sumarDias } from '@merca/shared';

/** Rangos de fecha del tablero (igual al prototipo). La clave va en la URL (?rango=7). */
export const RANGOS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: '7', texto: '7 días' },
  { clave: '14', texto: '14 días' },
  { clave: '30', texto: '30 días' },
  { clave: 'mes', texto: 'Mes actual' },
  { clave: '90', texto: '90 días' },
] as const;

export type ClaveRango = (typeof RANGOS)[number]['clave'];
export const RANGO_DEF: ClaveRango = '7';

export function esClaveRango(s: string | null | undefined): s is ClaveRango {
  return !!s && RANGOS.some((r) => r.clave === s);
}

export function textoRango(c: ClaveRango): string {
  return RANGOS.find((r) => r.clave === c)!.texto;
}

export function claveDeTexto(t: string): ClaveRango {
  return RANGOS.find((r) => r.texto === t)?.clave ?? RANGO_DEF;
}

/** Fechas desde/hasta (YYYY-MM-DD, hora Colombia) para un rango. */
export function fechasRango(
  c: ClaveRango,
  hoy: string = hoyBogota(),
): { desde: string; hasta: string } {
  if (c === 'hoy') return { desde: hoy, hasta: hoy };
  if (c === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return { desde: sumarDias(hoy, -(Number(c) - 1)), hasta: hoy };
}
