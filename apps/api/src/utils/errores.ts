import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodError, ZodTypeAny, z } from 'zod';

export type Detalle = { path: string; message: string }[] | string;

/** Error HTTP con mensaje en español listo para mostrar. */
export class HttpError extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public codigo?: string,
    public detalle?: Detalle,
  ) {
    super(mensaje);
  }
}

export const noAutenticado = (m = 'Debes iniciar sesión.') => new HttpError(401, m, 'NO_AUTENTICADO');
export const sinPermiso = (m = 'No tienes permiso para hacer esto.') => new HttpError(403, m, 'SIN_PERMISO');
export const noEncontrado = (m = 'No se encontró lo que buscas.') => new HttpError(404, m, 'NO_ENCONTRADO');
export const conflicto = (m: string) => new HttpError(409, m, 'CONFLICTO');
export const invalido = (m: string, detalle?: Detalle) => new HttpError(400, m, 'VALIDACION', detalle);

export function detalleZod(e: ZodError) {
  return e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Valida con Zod o lanza 400 VALIDACION. */
export function parsear<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw invalido('Datos inválidos', detalleZod(r.error));
  return r.data;
}

/** Envuelve handlers async para que los errores lleguen al middleware de errores (Express 4). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
