import type { ApiError } from '@merca/shared';
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { esProduccion } from '../config/env.js';
import { HttpError, detalleZod } from '../utils/errores.js';
import { logger } from '../utils/logger.js';

/** 404 JSON para rutas inexistentes. */
export function noEncontradoRuta(req: Request, res: Response) {
  const body: ApiError = { error: 'Ruta no encontrada.', codigo: 'NO_ENCONTRADO' };
  res.status(404).json(body);
}

/** Manejador final: errores siempre en JSON y en español; nunca expone el stack. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function manejarErrores(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let body: ApiError = { error: 'Ocurrió un error interno. Intenta de nuevo en un momento.', codigo: 'INTERNO' };

  const e = err as { type?: string; status?: number; message?: string; code?: number };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: err.message, codigo: err.codigo };
    if (err.detalle !== undefined) body.detalle = err.detalle;
  } else if (err instanceof ZodError) {
    status = 400;
    body = { error: 'Datos inválidos', codigo: 'VALIDACION', detalle: detalleZod(err) };
  } else if (e?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: 'El cuerpo de la petición no es un JSON válido.', codigo: 'VALIDACION' };
  } else if (e?.type === 'entity.too.large') {
    status = 413;
    body = { error: 'La información enviada es demasiado grande (máximo 1 MB).', codigo: 'VALIDACION' };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    body = { error: 'Identificador inválido.', codigo: 'VALIDACION' };
  } else if (e?.code === 11000) {
    status = 409;
    body = { error: 'Ya existe un elemento con ese identificador.', codigo: 'CONFLICTO' };
  }

  if (status >= 500) {
    logger.error({ err, url: req.originalUrl, metodo: req.method }, 'Error no controlado');
    if (!esProduccion && e?.message) body.detalle = e.message;
  }
  if (res.headersSent) return;
  res.status(status).json(body);
}
