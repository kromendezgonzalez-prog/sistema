/**
 * CONTRATO DE LA API (/api/v1). Backend y frontend deben respetar estas formas.
 * Ver docs/CONTRATO-API.md para el detalle de cada endpoint.
 */
import type { Config, EventoAuditoria, Foto, Pdv, Producto, Registro, UsuarioPublico } from './schemas.js';
import type { Tablero } from './kpis.js';

export const API_PREFIX = '/api/v1';

/** Todas las respuestas de error. Mensaje SIEMPRE en español, apto para mostrar al usuario. */
export interface ApiError {
  error: string;
  /** p. ej. issues de Zod: [{ path: 'items.33017.lotesFin.0.vto', message: '...' }] */
  detalle?: { path: string; message: string }[] | string;
  /** código estable para que la web reaccione: 'NO_AUTENTICADO', 'TOKEN_EXPIRADO', 'SIN_PERMISO', 'BLOQUEADO', 'DEBE_CAMBIAR_PASSWORD', 'VALIDACION', 'NO_ENCONTRADO', 'FUERA_DE_PLAZO', 'CONFLICTO', 'INTERNO' */
  codigo?: string;
}

/* ───────── Auth ───────── */

/** POST /auth/login · POST /auth/refresh (cookie httpOnly `rt`) */
export interface AuthResponse {
  /** JWT de acceso (12 h). La web lo guarda en memoria y lo envía como `Authorization: Bearer`. */
  accessToken: string;
  usuario: UsuarioPublico;
}

/* ───────── Config ───────── */

export interface MiembroEquipo {
  _id: string;
  nombre: string;
  rol: UsuarioPublico['rol'];
  ciudad: string;
  pdvIds: string[];
  activo: boolean;
}

/** GET /config — todo lo que la PWA necesita para trabajar offline (con ETag). */
export interface ConfigResponse {
  config: Config;
  productos: Producto[];
  pdvs: Pdv[];
  /** admin/supervisor: todo el equipo. impulsadora: solo ella. */
  equipo: MiembroEquipo[];
  /** hash del contenido; cambia cuando el admin edita algo */
  version: string;
}

/* ───────── Registros ───────── */

export interface Paginado<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

/** PUT /registros/:id */
export interface GuardarRegistroResponse {
  registro: Registro;
  creado: boolean;
}

/** POST /registros/sync */
export interface SyncResponse {
  resultados: { id: string; ok: boolean; error?: string; registro?: Registro }[];
}

/** GET /registros/ultimo-inventario?pdvId&fecha&turno */
export interface UltimoInventarioResponse {
  previo: null | {
    registroId: string;
    fecha: string;
    turno: string;
    impulsadoraNombre: string;
    /** lotes finales por producto (o iniciales si ese registro no se cerró) */
    lotes: Record<string, import('./schemas.js').Lote[]>;
  };
}

/* ───────── Fotos ───────── */

/** POST /fotos/firma → la web sube directo a `uploadUrl` con multipart (file, api_key, timestamp, signature, folder). */
export interface FirmaFotoResponse {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}
export type { Foto };

/* ───────── Tablero ───────── */

/** GET /tablero?desde&hasta&impulsadoraId&pdvId */
export interface TableroResponse extends Tablero {
  filtros: { desde: string; hasta: string; impulsadoraId: string | null; pdvId: string | null };
  /** puntos de venta con ubicación + check-ins del rango (para el mapa) */
  checkins: {
    registroId: string;
    fecha: string;
    turno: string;
    impulsadoraNombre: string;
    pdvNombre: string;
    lat: number;
    lng: number;
    distanciaPdvM: number | null;
    dentroDeRango: boolean | null;
  }[];
}

/* ───────── Admin ───────── */

/** POST /admin/usuarios · POST /admin/usuarios/:id/reset-password */
export interface PasswordTemporalResponse {
  usuario: UsuarioPublico;
  /** se muestra UNA sola vez; no queda guardada en ningún lado */
  passwordTemporal: string;
}

export type AuditoriaResponse = Paginado<EventoAuditoria>;

export interface NovedadFila {
  registroId: string;
  fecha: string;
  turno: string;
  pdvId: string;
  pdvNombre: string;
  impulsadoraNombre: string;
  cod: string;
  producto: string;
  loteId: string;
  momento: 'llegada' | 'cierre';
  cantidad: number;
  vto: string | null;
  tipo: string;
  nota: string;
  fotos: Foto[];
}
export type NovedadesResponse = Paginado<NovedadFila>;
