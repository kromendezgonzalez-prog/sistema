import type { NivelRiesgo, UmbralesRiesgo } from '@merca/shared';

/** Niveles con riesgo, del peor al más leve (orden de las tarjetas del tablero). */
export const NIVELES_CON_RIESGO = [
  'vencido',
  'emergencia',
  'critico',
  'medio',
] as const satisfies readonly Exclude<NivelRiesgo, 'ok'>[];
export type NivelConRiesgo = (typeof NIVELES_CON_RIESGO)[number];

/** Clases de borde / fondo suave por nivel (siempre acompañadas de ícono + texto). */
export const ESTILO_NIVEL: Record<NivelRiesgo, { borde: string; fondo: string; barra: string }> = {
  vencido: { borde: 'border-riesgo-vencido', fondo: 'bg-black/[.04]', barra: 'bg-riesgo-vencido' },
  emergencia: {
    borde: 'border-riesgo-emergencia',
    fondo: 'bg-error-bg',
    barra: 'bg-riesgo-emergencia',
  },
  critico: { borde: 'border-riesgo-critico', fondo: 'bg-[#fff0e6]', barra: 'bg-riesgo-critico' },
  medio: { borde: 'border-riesgo-medio', fondo: 'bg-[#fff8db]', barra: 'bg-riesgo-medio' },
  ok: { borde: 'border-riesgo-ok', fondo: 'bg-ok-bg', barra: 'bg-riesgo-ok' },
};

const dias = (n: number) => `${n} día${n === 1 ? '' : 's'}`;

/** Texto del rango de días de cada nivel según los umbrales configurados. */
export function textoRangoNivel(n: NivelRiesgo, u: UmbralesRiesgo): string {
  switch (n) {
    case 'vencido':
      return 'Ya pasó la fecha de vencimiento';
    case 'emergencia':
      return u.emergencia === 0 ? 'Vence hoy' : `Vence hoy o en máximo ${dias(u.emergencia)}`;
    case 'critico':
      return u.critico === u.emergencia + 1
        ? `Vence en ${dias(u.critico)}`
        : `Vence en ${u.emergencia + 1} a ${dias(u.critico)}`;
    case 'medio':
      return u.medio === u.critico + 1
        ? `Vence en ${dias(u.medio)}`
        : `Vence en ${u.critico + 1} a ${dias(u.medio)}`;
    case 'ok':
      return `Vence en más de ${dias(u.medio)}`;
  }
}
