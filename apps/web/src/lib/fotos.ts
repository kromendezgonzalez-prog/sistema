/**
 * Fotos: compresión en el celular, subida firmada a Cloudinary y respaldo offline.
 *
 * Flujo: la foto se comprime y se guarda SIEMPRE primero en el celular (Dexie) como
 * referencia local `{ publicId: 'local:<id>', url: 'local:<id>' }`. Se intenta subir de
 * inmediato; si no hay señal, se sube al sincronizar y la referencia local se reemplaza
 * por `{ publicId, url }` de Cloudinary antes de enviar el registro.
 */
import type { FirmaFotoResponse, Foto, RegistroInput } from '@merca/shared';
import imageCompression from 'browser-image-compression';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { useEffect, useMemo } from 'react';
import { db } from '@/offline/db';
import { api, ErrorRed } from './api';

export type ContextoFoto = 'novedad' | 'gondola';

export const PREFIJO_LOCAL = 'local:';
export const esFotoLocal = (f: Foto) => f.publicId.startsWith(PREFIJO_LOCAL);
export const idFotoLocal = (f: Foto) => f.publicId.slice(PREFIJO_LOCAL.length);
const refLocal = (id: string): Foto => ({ publicId: PREFIJO_LOCAL + id, url: PREFIJO_LOCAL + id });

export const OPCIONES_COMPRESION = {
  maxWidthOrHeight: 1280,
  maxSizeMB: 0.4,
  initialQuality: 0.72,
  fileType: 'image/jpeg',
  useWebWorker: true,
} as const;

/** Error al subir a Cloudinary (no de red). */
export class ErrorSubidaFoto extends Error {}

/** Reduce la foto (máx. 1280 px, JPEG ~0,72, ≤ ~400 KB). */
export async function comprimirFoto(file: File | Blob): Promise<Blob> {
  try {
    return await imageCompression(file as File, { ...OPCIONES_COMPRESION });
  } catch {
    throw new ErrorSubidaFoto('No pudimos procesar la foto. Intenta tomarla de nuevo.');
  }
}

async function aBuffer(b: Blob): Promise<ArrayBuffer> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(b);
  });
}

/** Pide firma a la API y sube directo a Cloudinary. Lanza ErrorRed sin señal. */
export async function subirBlob(blob: Blob, contexto: ContextoFoto): Promise<Foto> {
  const firma = await api<FirmaFotoResponse>('/fotos/firma', { method: 'POST', body: { contexto } });
  const fd = new FormData();
  fd.append('file', blob, 'foto.jpg');
  fd.append('api_key', firma.apiKey);
  fd.append('timestamp', String(firma.timestamp));
  fd.append('signature', firma.signature);
  fd.append('folder', firma.folder);
  let res: Response;
  try {
    res = await fetch(firma.uploadUrl, { method: 'POST', body: fd });
  } catch {
    throw new ErrorRed();
  }
  if (!res.ok) throw new ErrorSubidaFoto('La foto no se pudo subir. Intenta de nuevo más tarde.');
  const j = (await res.json()) as { public_id: string; secure_url: string };
  return { publicId: j.public_id, url: j.secure_url };
}

/** Comprime y guarda la foto en el celular. Devuelve la referencia local. */
export async function guardarFotoLocal(file: File | Blob, contexto: ContextoFoto, usuarioId: string): Promise<Foto> {
  const blob = await comprimirFoto(file);
  const id = nanoid(12);
  await db.fotosPendientes.put({
    id,
    usuarioId,
    datos: await aBuffer(blob),
    tipo: blob.type || 'image/jpeg',
    contexto,
    creadoEn: Date.now(),
    subida: null,
  });
  return refLocal(id);
}

/** Sube una foto guardada en el celular (idempotente: si ya se subió, devuelve la misma). */
export async function subirFotoLocal(id: string): Promise<Foto> {
  const r = await db.fotosPendientes.get(id);
  if (!r) throw new ErrorSubidaFoto('La foto ya no está en el celular.');
  if (r.subida) return r.subida;
  const f = await subirBlob(new Blob([r.datos], { type: r.tipo }), r.contexto);
  await db.fotosPendientes.update(id, { subida: f });
  return f;
}

export async function borrarFotoLocal(f: Foto) {
  if (esFotoLocal(f)) await db.fotosPendientes.delete(idFotoLocal(f));
}

/* ───────── Recorrer las fotos de un registro ───────── */

type ConFotos = Pick<RegistroInput, 'items' | 'fotosGondola'>;

/** Todas las fotos de un registro (góndola + novedades de lotes). */
export function fotosDe(r: ConFotos): Foto[] {
  const out: Foto[] = [...(r.fotosGondola ?? [])];
  for (const it of Object.values(r.items ?? {}))
    for (const l of [...(it.lotesIni ?? []), ...(it.lotesFin ?? [])]) out.push(...(l.novedad?.fotos ?? []));
  return out;
}

export const contarFotosLocales = (r: ConFotos) => fotosDe(r).filter(esFotoLocal).length;

/** Aplica `fn` a cada lista de fotos y devuelve una copia. */
export function mapearFotos<T extends ConFotos>(r: T, fn: (fs: Foto[]) => Foto[]): T {
  const items: ConFotos['items'] = {};
  for (const [cod, it] of Object.entries(r.items ?? {})) {
    const mapLotes = (ls?: typeof it.lotesIni) =>
      ls?.map((l) => (l.novedad ? { ...l, novedad: { ...l.novedad, fotos: fn(l.novedad.fotos ?? []) } } : l));
    const nuevo = { ...it };
    if (it.lotesIni !== undefined) nuevo.lotesIni = mapLotes(it.lotesIni);
    if (it.lotesFin !== undefined) nuevo.lotesFin = mapLotes(it.lotesFin);
    items[cod] = nuevo;
  }
  return { ...r, items, fotosGondola: fn(r.fotosGondola ?? []) };
}

/**
 * Sube las fotos locales de un registro y reemplaza sus referencias.
 * Lanza ErrorRed si no hay señal (el registro debe quedar en cola).
 * Las fotos locales que ya no existan en el celular se quitan.
 */
export async function resolverFotos<T extends ConFotos>(r: T): Promise<{ registro: T; idsLocales: string[] }> {
  const idsLocales = fotosDe(r).filter(esFotoLocal).map(idFotoLocal);
  const subidas = new Map<string, Foto | null>();
  for (const id of idsLocales) {
    try {
      subidas.set(id, await subirFotoLocal(id));
    } catch (e) {
      if (e instanceof ErrorRed) throw e;
      subidas.set(id, null);
    }
  }
  const registro = mapearFotos(r, (fs) =>
    fs.flatMap((f) => {
      if (!esFotoLocal(f)) return [f];
      const s = subidas.get(idFotoLocal(f));
      return s ? [s] : [];
    }),
  );
  return { registro, idsLocales };
}

export async function borrarFotosLocales(ids: string[]) {
  if (ids.length) await db.fotosPendientes.bulkDelete(ids);
}

/* ───────── Hook para mostrar una foto (local o en la nube) ───────── */

/** URL mostrable de una foto: si es local, crea un object URL desde el celular. */
export function useFotoSrc(f: Foto): string | null {
  const local = esFotoLocal(f);
  const reg = useLiveQuery(() => (local ? db.fotosPendientes.get(idFotoLocal(f)) : undefined), [f.publicId]);
  const url = useMemo(() => {
    if (!local) return f.url;
    if (!reg) return null;
    if (reg.subida) return reg.subida.url;
    try {
      return URL.createObjectURL(new Blob([reg.datos], { type: reg.tipo }));
    } catch {
      return null;
    }
  }, [local, f.url, reg]);
  useEffect(
    () => () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}
