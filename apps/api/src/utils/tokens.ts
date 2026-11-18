import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { API_PREFIX } from '@merca/shared';
import { env, esProduccion } from '../config/env.js';

export interface AccessPayload {
  sub: string;
  rol: string;
  nombre: string;
}
export interface RefreshPayload {
  sub: string;
  /** tokenVersion del usuario al emitirlo */
  tv: number;
}

export const ACCESS_TTL = '12h';
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE_RT = 'rt';
export const COOKIE_PATH = `${API_PREFIX}/auth`;

export function firmarAccess(p: AccessPayload) {
  return jwt.sign({ sub: p.sub, rol: p.rol, nombre: p.nombre }, env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function firmarRefresh(p: RefreshPayload) {
  return jwt.sign({ sub: p.sub, tv: p.tv }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_MS / 1000 });
}

export function verificarAccess(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}

export function verificarRefresh(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}

function opcionesCookie(): CookieOptions {
  return esProduccion
    ? { httpOnly: true, secure: true, sameSite: 'none', path: COOKIE_PATH }
    : { httpOnly: true, secure: false, sameSite: 'lax', path: COOKIE_PATH };
}

export function ponerCookieRefresh(res: Response, token: string) {
  res.cookie(COOKIE_RT, token, { ...opcionesCookie(), maxAge: REFRESH_TTL_MS });
}

export function borrarCookieRefresh(res: Response) {
  res.clearCookie(COOKIE_RT, opcionesCookie());
}
