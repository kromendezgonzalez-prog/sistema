import { RIESGO_DEF, type UmbralesRiesgo } from './constantes.js';
import { diffDias } from './fechas.js';

export const NIVELES_RIESGO = ['vencido', 'emergencia', 'critico', 'medio', 'ok'] as const;
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];

export interface InfoNivel {
  nivel: NivelRiesgo;
  etiqueta: string;
  corto: string;
  icono: string;
  /** Token de color para la UI (la web lo mapea a su paleta). */
  color: 'negro' | 'rojo' | 'naranja' | 'amarillo' | 'verde';
  accion: string;
  /** 0 = peor */
  orden: number;
}

export const INFO_NIVEL: Record<NivelRiesgo, InfoNivel> = {
  vencido: {
    nivel: 'vencido',
    etiqueta: 'Vencido',
    corto: 'Vencido',
    icono: '⛔',
    color: 'negro',
    accion: 'Retiro inmediato de góndola y reportar novedad.',
    orden: 0,
  },
  emergencia: {
    nivel: 'emergencia',
    etiqueta: 'Emergencia crítica – Salida',
    corto: 'Emergencia',
    icono: '✕',
    color: 'rojo',
    accion: 'Gestionar la salida hoy: retirar o liquidar con la tienda.',
    orden: 1,
  },
  critico: {
    nivel: 'critico',
    etiqueta: 'Crítico',
    corto: 'Crítico',
    icono: '⚠',
    color: 'naranja',
    accion: 'Impulso y degustación prioritaria; producto al frente.',
    orden: 2,
  },
  medio: {
    nivel: 'medio',
    etiqueta: 'Riesgo medio',
    corto: 'Medio',
    icono: '!',
    color: 'amarillo',
    accion: 'Rotar FEFO: lo que vence primero, adelante.',
    orden: 3,
  },
  ok: {
    nivel: 'ok',
    etiqueta: 'Sin riesgo',
    corto: 'OK',
    icono: '✓',
    color: 'verde',
    accion: '',
    orden: 4,
  },
};

/** Nivel según días que faltan para vencer (negativo = vencido). */
export function nivelPorDias(dias: number, u: UmbralesRiesgo = RIESGO_DEF): NivelRiesgo {
  if (dias < 0) return 'vencido';
  if (dias <= u.emergencia) return 'emergencia';
  if (dias <= u.critico) return 'critico';
  if (dias <= u.medio) return 'medio';
  return 'ok';
}

/** Nivel de una fecha de vencimiento respecto a `hoy` (YYYY-MM-DD). */
export function nivelPorFecha(
  vto: string,
  hoy: string,
  u: UmbralesRiesgo = RIESGO_DEF,
): { dias: number; nivel: NivelRiesgo } {
  const dias = diffDias(vto, hoy);
  return { dias, nivel: nivelPorDias(dias, u) };
}

/** El peor de varios niveles. */
export function peorNivel(niveles: NivelRiesgo[]): NivelRiesgo {
  let peor: NivelRiesgo = 'ok';
  for (const n of niveles) if (INFO_NIVEL[n].orden < INFO_NIVEL[peor].orden) peor = n;
  return peor;
}
