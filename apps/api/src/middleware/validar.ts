import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { invalido, detalleZod } from '../utils/errores.js';

/**
 * Valida `req.body` con Zod y lo reemplaza por el resultado (con defaults aplicados).
 * Error → 400 { error: 'Datos inválidos', codigo: 'VALIDACION', detalle: [{ path, message }] }
 */
export function validarBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body ?? {});
    if (!r.success) return next(invalido('Datos inválidos', detalleZod(r.error)));
    req.body = r.data;
    next();
  };
}
