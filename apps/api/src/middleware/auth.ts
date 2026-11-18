import type { Rol } from '@merca/shared';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/index.js';
import { HttpError, noAutenticado, sinPermiso } from '../utils/errores.js';
import { verificarAccess } from '../utils/tokens.js';

/** Usuario autenticado disponible en `req.usuario` (datos frescos de la BD). */
export interface UsuarioAuth {
  _id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  ciudad: string;
  pdvIds: string[];
  activo: boolean;
  debeCambiarPassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAuth;
    }
  }
}

/** Exige `Authorization: Bearer <accessToken>` válido y usuario activo. */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.get('authorization') ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) throw noAutenticado();
    let sub: string;
    try {
      sub = verificarAccess(m[1].trim()).sub;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError)
        throw new HttpError(401, 'Tu sesión expiró. Vuelve a ingresar.', 'TOKEN_EXPIRADO');
      throw noAutenticado('Sesión inválida. Vuelve a ingresar.');
    }
    const u = await Usuario.findById(sub)
      .select('nombre usuario rol ciudad pdvIds activo debeCambiarPassword')
      .lean();
    if (!u) throw noAutenticado('Tu usuario ya no existe. Habla con la administradora.');
    if (!u.activo) throw noAutenticado('Tu usuario está desactivado. Habla con la administradora.');
    req.usuario = {
      _id: String(u._id),
      nombre: u.nombre,
      usuario: u.usuario,
      rol: u.rol as Rol,
      ciudad: u.ciudad ?? '',
      pdvIds: u.pdvIds ?? [],
      activo: true,
      debeCambiarPassword: !!u.debeCambiarPassword,
    };
    next();
  } catch (e) {
    next(e);
  }
}

/** Bloquea todo (salvo /auth/* y GET /config) si el usuario debe cambiar su contraseña temporal. */
export function exigirPasswordDefinitiva(req: Request, _res: Response, next: NextFunction) {
  if (req.usuario?.debeCambiarPassword)
    return next(
      new HttpError(
        403,
        'Debes cambiar tu contraseña temporal antes de continuar.',
        'DEBE_CAMBIAR_PASSWORD',
      ),
    );
  next();
}

/** Restringe a ciertos roles. */
export function permitir(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) return next(noAutenticado());
    if (!roles.includes(req.usuario.rol)) return next(sinPermiso());
    next();
  };
}
