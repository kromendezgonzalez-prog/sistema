import { RADIO_PDV_DEF_M } from './constantes.js';

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export interface EvaluacionGeo {
  /** null si el punto aún no tiene ubicación fijada */
  distanciaPdvM: number | null;
  /** null si no se puede evaluar (punto sin ubicación) */
  dentroDeRango: boolean | null;
}

export function evaluarGeo(
  geo: { lat: number; lng: number },
  pdv: { ubicacion?: { lat: number; lng: number } | null; radioM?: number | null },
): EvaluacionGeo {
  if (!pdv.ubicacion) return { distanciaPdvM: null, dentroDeRango: null };
  const d = distanciaM(geo.lat, geo.lng, pdv.ubicacion.lat, pdv.ubicacion.lng);
  return { distanciaPdvM: d, dentroDeRango: d <= (pdv.radioM ?? RADIO_PDV_DEF_M) };
}
