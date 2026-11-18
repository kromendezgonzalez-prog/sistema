import { API_PREFIX, type ApiError, type AuthResponse } from '@merca/shared';

/** URL base de la API (Render). En desarrollo: http://localhost:4000 */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

let accessToken: string | null = null;
let onSesionPerdida: (() => void) | null = null;
let onSesionRenovada: ((r: AuthResponse) => void) | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken() {
  return accessToken;
}
/** El AuthProvider registra qué hacer cuando la sesión se pierde o se renueva. */
export function registrarHandlersSesion(h: {
  perdida: () => void;
  renovada: (r: AuthResponse) => void;
}) {
  onSesionPerdida = h.perdida;
  onSesionRenovada = h.renovada;
}

/** Error de API con mensaje en español listo para mostrar. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error || 'Error inesperado');
  }
  get codigo() {
    return this.body.codigo;
  }
}

/** Error de red (sin conexión, servidor dormido, etc.). */
export class ErrorRed extends Error {
  constructor() {
    super('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
  }
}

export type ResultadoRefresh = 'ok' | 'invalida' | 'sin-red';
let refrescando: Promise<ResultadoRefresh> | null = null;

/** Renueva el access token usando la cookie httpOnly. 'sin-red' = no se pudo contactar al servidor. */
export async function refrescarSesion(): Promise<ResultadoRefresh> {
  refrescando ??= (async (): Promise<ResultadoRefresh> => {
    try {
      const r = await fetch(`${API_URL}${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) return r.status >= 500 ? 'sin-red' : 'invalida';
      const data = (await r.json()) as AuthResponse;
      accessToken = data.accessToken;
      onSesionRenovada?.(data);
      return 'ok';
    } catch {
      return 'sin-red';
    } finally {
      setTimeout(() => (refrescando = null), 0);
    }
  })();
  return refrescando;
}

export interface OpcionesApi extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** query string */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** no intentar refresh ante 401 */
  sinRefresh?: boolean;
  /** devolver la Response cruda (descargas) */
  crudo?: boolean;
}

/**
 * Cliente de la API. Uso: `api<ConfigResponse>('/config')`.
 * Lanza `ErrorApi` (status + mensaje en español) o `ErrorRed`.
 */
export async function api<T>(ruta: string, op: OpcionesApi = {}): Promise<T> {
  const { body, query, sinRefresh, crudo, headers, ...rest } = op;
  const qs = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const h = new Headers(headers);
  if (body !== undefined) h.set('Content-Type', 'application/json');
  if (accessToken) h.set('Authorization', `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${API_PREFIX}${ruta}${qs === '?' ? '' : qs}`, {
      ...rest,
      headers: h,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ErrorRed();
  }

  if (res.status === 401 && !sinRefresh) {
    const r = await refrescarSesion();
    if (r === 'ok') return api<T>(ruta, { ...op, sinRefresh: true });
    if (r === 'sin-red') throw new ErrorRed();
    onSesionPerdida?.();
  }

  if (!res.ok && res.status !== 304) {
    let b: ApiError;
    try {
      b = (await res.json()) as ApiError;
    } catch {
      b = { error: `Error del servidor (${res.status})` };
    }
    throw new ErrorApi(res.status, b);
  }
  if (crudo) return res as unknown as T;
  if (res.status === 204 || res.status === 304) return undefined as T;
  return (await res.json()) as T;
}

/** Descarga un archivo (p. ej. Excel) autenticado y lo guarda en el dispositivo. */
export async function descargar(ruta: string, nombre: string, query?: OpcionesApi['query']) {
  const res = await api<Response>(ruta, { query, crudo: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Mensaje amigable para cualquier error. */
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorApi || e instanceof ErrorRed) return e.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
