/**
 * Ubicación del celular para el check-in del registro (GPS obligatorio en días laborales).
 * Primero intenta alta precisión; si se demora o falla, reintenta con baja precisión
 * aceptando una lectura reciente (útil dentro de supermercados).
 */
import type { GeoInput } from '@merca/shared';

export type TipoErrorGeo = 'denegado' | 'no-disponible' | 'tiempo' | 'no-soportado';

const MENSAJES: Record<TipoErrorGeo, string> = {
  denegado: 'El permiso de ubicación está bloqueado para esta app.',
  'no-disponible': 'El GPS del celular está apagado o no encuentra señal.',
  tiempo: 'El GPS se demoró demasiado en responder.',
  'no-soportado': 'Este navegador no permite usar la ubicación.',
};

export class ErrorGeo extends Error {
  constructor(public tipo: TipoErrorGeo) {
    super(MENSAJES[tipo]);
  }
}

/** Precisión (m) a partir de la cual mostramos "precisión baja". */
export const PRECISION_BAJA_M = 150;

function tipoDe(e: unknown): TipoErrorGeo {
  const code = (e as { code?: number } | null)?.code;
  if (code === 1) return 'denegado';
  if (code === 3) return 'tiempo';
  return 'no-disponible';
}

function pedir(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, opts));
}

export interface OpcionesUbicacion {
  /** tiempo máximo por intento (ms) */
  timeoutMs?: number;
}

/** Pide la ubicación actual. Lanza `ErrorGeo`. */
export async function obtenerUbicacion({ timeoutMs = 15_000 }: OpcionesUbicacion = {}): Promise<GeoInput> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw new ErrorGeo('no-soportado');
  let pos: GeolocationPosition;
  try {
    pos = await pedir({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 });
  } catch (e) {
    const t = tipoDe(e);
    if (t === 'denegado') throw new ErrorGeo(t);
    try {
      pos = await pedir({ enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 120_000 });
    } catch (e2) {
      throw new ErrorGeo(tipoDe(e2));
    }
  }
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    precisionM: Math.max(0, Math.round(pos.coords.accuracy ?? 0)),
    capturadoEn: new Date().toISOString(),
  };
}

/** Estado del permiso sin preguntar (si el navegador lo permite). */
export async function estadoPermisoGeo(): Promise<'granted' | 'denied' | 'prompt' | 'desconocido'> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return p?.state ?? 'desconocido';
  } catch {
    return 'desconocido';
  }
}

export function esIPhone(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
