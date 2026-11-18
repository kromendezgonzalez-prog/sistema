/**
 * Cola offline de registros: guardar (o encolar si no hay señal) y sincronizar.
 */
import {
  RegistroInputSchema,
  type GuardarRegistroResponse,
  type RegistroInput,
  type SyncResponse,
} from '@merca/shared';
import type { ZodError } from 'zod';
import { api, ErrorApi, ErrorRed, mensajeError } from '@/lib/api';
import { borrarFotosLocales, resolverFotos } from '@/lib/fotos';
import { db, type MetaForm, type RegistroEnCola, type ResumenCola } from './db';

export const TAM_LOTE_SYNC = 50;
const TIMEOUT_MS = 25_000;

/** AbortSignal con tiempo límite (un servidor dormido no debe dejar a la trabajadora esperando). */
export function senalConTiempo(ms = TIMEOUT_MS): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** El servidor no está disponible (dormido / reiniciando): se trata como "sin señal". */
const servidorCaido = (e: unknown) => e instanceof ErrorApi && [502, 503, 504].includes(e.status);

/** Mensaje con el detalle de validación (si lo hay). */
export function mensajeDetallado(e: unknown): string {
  if (e instanceof ErrorApi && Array.isArray(e.body.detalle) && e.body.detalle.length) {
    const d = e.body.detalle
      .slice(0, 3)
      .map((x) => x.message)
      .join(' · ');
    return `${e.message} (${d})`;
  }
  return mensajeError(e);
}

export function mensajeZod(err: ZodError): string {
  const m = err.issues
    .slice(0, 3)
    .map((i) => i.message)
    .join(' · ');
  return `Hay datos por corregir: ${m}`;
}

/* ───────── Cola ───────── */

export async function encolar(
  id: string,
  usuarioId: string,
  input: RegistroInput,
  resumen: ResumenCola,
  meta?: MetaForm,
): Promise<void> {
  const ahora = Date.now();
  const previo = await db.cola.get(id);
  await db.cola.put({
    id,
    usuarioId,
    input,
    meta,
    resumen,
    estado: 'pendiente',
    intentos: 0,
    ultimoError: null,
    errorDeDatos: false,
    creadoEn: previo?.creadoEn ?? ahora,
    actualizadoEn: ahora,
  });
}

export async function descartarDeCola(id: string) {
  await db.cola.delete(id);
}

/** Tras enviar con éxito: quita de la cola, borra el borrador y las fotos locales. */
async function limpiarTrasEnvio(id: string, idsLocales: string[]) {
  await db.transaction('rw', db.cola, db.borradores, db.fotosPendientes, async () => {
    await db.cola.delete(id);
    await db.borradores.delete(id);
    await borrarFotosLocales(idsLocales);
  });
}

async function marcar(id: string, cambios: Partial<RegistroEnCola>) {
  await db.cola.update(id, { ...cambios, actualizadoEn: Date.now() });
}

/* ───────── Guardar en línea o encolar ───────── */

export type ResultadoGuardar =
  | { tipo: 'enviado'; respuesta: GuardarRegistroResponse }
  | { tipo: 'encolado' };

/**
 * Intenta `PUT /registros/:id`. Sin señal (o servidor caído) lo deja en la cola del celular.
 * Errores de datos (validación, plazo, permisos) se lanzan para mostrarlos.
 */
export async function guardarOEncolar(
  id: string,
  usuarioId: string,
  input: RegistroInput,
  resumen: ResumenCola,
  meta?: MetaForm,
): Promise<ResultadoGuardar> {
  try {
    const { registro, idsLocales } = await resolverFotos(input);
    const respuesta = await api<GuardarRegistroResponse>(`/registros/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: registro,
      signal: senalConTiempo(),
    });
    await limpiarTrasEnvio(id, idsLocales);
    return { tipo: 'enviado', respuesta };
  } catch (e) {
    if (e instanceof ErrorRed || servidorCaido(e)) {
      await encolar(id, usuarioId, input, resumen, meta);
      await db.borradores.delete(id);
      return { tipo: 'encolado' };
    }
    throw e;
  }
}

/* ───────── Sincronizar ───────── */

export interface ResultadoSync {
  enviados: number;
  errores: number;
  sinRed: boolean;
}

let enCurso: Promise<ResultadoSync> | null = null;

/**
 * Envía los registros pendientes del usuario: primero sube sus fotos, luego
 * `POST /registros/sync` en lotes de hasta 50. Si se llama mientras corre, devuelve la misma promesa.
 * `incluirErrores`: reintenta también los que fallaron por datos (botón "Reintentar").
 */
export function sincronizar(usuarioId: string, opciones: { incluirErrores?: boolean } = {}): Promise<ResultadoSync> {
  enCurso ??= sincronizarInterno(usuarioId, !!opciones.incluirErrores).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function sincronizarInterno(usuarioId: string, incluirErrores: boolean): Promise<ResultadoSync> {
  const r: ResultadoSync = { enviados: 0, errores: 0, sinRed: false };
  const todos = await db.cola.where('usuarioId').equals(usuarioId).toArray();
  const candidatos = todos
    .filter((x) => !(x.estado === 'error' && x.errorDeDatos) || incluirErrores)
    .sort((a, b) => a.creadoEn - b.creadoEn);
  if (!candidatos.length) return r;

  // 1. Fotos + validación local
  const listos: { reg: RegistroEnCola; input: RegistroInput; idsLocales: string[] }[] = [];
  for (const reg of candidatos) {
    try {
      const { registro, idsLocales } = await resolverFotos(reg.input);
      const v = RegistroInputSchema.safeParse(registro);
      if (!v.success) {
        r.errores++;
        await marcar(reg.id, { estado: 'error', errorDeDatos: true, ultimoError: mensajeZod(v.error) });
        continue;
      }
      listos.push({ reg, input: v.data, idsLocales });
    } catch (e) {
      if (e instanceof ErrorRed || servidorCaido(e)) {
        r.sinRed = true;
        await marcar(reg.id, { estado: 'pendiente', intentos: reg.intentos + 1, ultimoError: mensajeError(e) });
        break;
      }
      r.errores++;
      await marcar(reg.id, { estado: 'error', errorDeDatos: false, ultimoError: mensajeError(e) });
    }
  }

  // 2. Envío en lotes de 50
  for (let i = 0; i < listos.length && !r.sinRed; i += TAM_LOTE_SYNC) {
    const lote = listos.slice(i, i + TAM_LOTE_SYNC);
    await Promise.all(lote.map((x) => marcar(x.reg.id, { estado: 'enviando' })));
    try {
      const resp = await api<SyncResponse>('/registros/sync', {
        method: 'POST',
        body: { registros: lote.map((x) => x.input) },
        signal: senalConTiempo(45_000),
      });
      for (let j = 0; j < lote.length; j++) {
        const x = lote[j];
        const res = resp.resultados.find((y) => y.id === x.reg.id) ?? resp.resultados[j];
        if (res?.ok) {
          r.enviados++;
          await limpiarTrasEnvio(x.reg.id, x.idsLocales);
        } else {
          r.errores++;
          await marcar(x.reg.id, {
            estado: 'error',
            errorDeDatos: true,
            intentos: x.reg.intentos + 1,
            ultimoError: res?.error ?? 'El servidor no aceptó este registro.',
          });
        }
      }
    } catch (e) {
      if (e instanceof ErrorRed || servidorCaido(e)) {
        r.sinRed = true;
        await Promise.all(
          lote.map((x) =>
            marcar(x.reg.id, { estado: 'pendiente', intentos: x.reg.intentos + 1, ultimoError: mensajeError(e) }),
          ),
        );
      } else if (e instanceof ErrorApi && e.status === 400) {
        // Un registro inválido tumbó el lote: se envían uno por uno para aislar el error.
        for (const x of lote) await enviarUno(x, r);
      } else {
        // sesión, permisos u otro: queda pendiente para reintentar después
        r.errores += lote.length;
        await Promise.all(
          lote.map((x) =>
            marcar(x.reg.id, {
              estado: 'error',
              errorDeDatos: false,
              intentos: x.reg.intentos + 1,
              ultimoError: mensajeDetallado(e),
            }),
          ),
        );
      }
    }
  }
  return r;
}

async function enviarUno(
  x: { reg: RegistroEnCola; input: RegistroInput; idsLocales: string[] },
  r: ResultadoSync,
) {
  if (r.sinRed) {
    await marcar(x.reg.id, { estado: 'pendiente' });
    return;
  }
  try {
    await api<GuardarRegistroResponse>(`/registros/${encodeURIComponent(x.reg.id)}`, {
      method: 'PUT',
      body: x.input,
      signal: senalConTiempo(),
    });
    r.enviados++;
    await limpiarTrasEnvio(x.reg.id, x.idsLocales);
  } catch (e) {
    if (e instanceof ErrorRed || servidorCaido(e)) {
      r.sinRed = true;
      await marcar(x.reg.id, { estado: 'pendiente', intentos: x.reg.intentos + 1, ultimoError: mensajeError(e) });
      return;
    }
    r.errores++;
    await marcar(x.reg.id, {
      estado: 'error',
      errorDeDatos: e instanceof ErrorApi && e.status < 500,
      intentos: x.reg.intentos + 1,
      ultimoError: mensajeDetallado(e),
    });
  }
}
