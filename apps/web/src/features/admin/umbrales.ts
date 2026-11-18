import type { UmbralesRiesgo } from '@merca/shared';

export type ErroresUmbrales = Partial<Record<keyof UmbralesRiesgo | 'general', string>>;

/**
 * Valida los umbrales de riesgo de vencimiento (días).
 * Reglas (iguales a `UmbralesRiesgoSchema` de shared): enteros, emergencia 0–90, crítico y medio 1–90,
 * y medio > crítico > emergencia. Devuelve mensajes en español por campo.
 */
export function validarUmbrales(u: {
  medio: number | null;
  critico: number | null;
  emergencia: number | null;
}): ErroresUmbrales {
  const e: ErroresUmbrales = {};
  const rev = (k: keyof UmbralesRiesgo, min: number) => {
    const v = u[k];
    if (v === null || !Number.isFinite(v)) e[k] = 'Escribe un número de días';
    else if (!Number.isInteger(v)) e[k] = 'Debe ser un número entero de días';
    else if (v < min || v > 90) e[k] = `Entre ${min} y 90 días`;
  };
  rev('emergencia', 0);
  rev('critico', 1);
  rev('medio', 1);
  if (e.medio || e.critico || e.emergencia) return e;
  const { medio, critico, emergencia } = u as UmbralesRiesgo;
  if (critico <= emergencia) e.critico = `Debe ser mayor que Emergencia (${emergencia})`;
  if (medio <= critico) e.medio = `Debe ser mayor que Crítico (${critico})`;
  if (e.medio || e.critico) e.general = 'Debe cumplirse: Medio > Crítico > Emergencia.';
  return e;
}

export function umbralesValidos(u: Parameters<typeof validarUmbrales>[0]): u is UmbralesRiesgo {
  return Object.keys(validarUmbrales(u)).length === 0;
}
