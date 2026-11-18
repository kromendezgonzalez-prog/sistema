import { API_PREFIX } from '@merca/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { autenticar, exigirPasswordDefinitiva } from './middleware/auth.js';
import { manejarErrores, noEncontradoRuta } from './middleware/errores.js';
import adminRouter, { pdvsRouter } from './routes/admin.js';
import authRouter from './routes/auth.js';
import configRouter from './routes/config.js';
import exportRouter from './routes/export.js';
import fotosRouter from './routes/fotos.js';
import registrosRouter from './routes/registros.js';
import tableroRouter from './routes/tablero.js';
import { logger } from './utils/logger.js';

/** Crea la app Express (sin conectar a la BD; se exporta para las pruebas). */
export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render está detrás de un proxy
  app.set('etag', false); // el ETag se maneja a mano en /config

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        // sin Origin (curl, health checks, apps nativas) → se permite; navegador → solo la lista
        if (!origin || env.CORS_ORIGIN.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
      exposedHeaders: ['ETag', 'Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  /* Salud: no toca la BD (lo usa el keep-alive). */
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const api = Router();
  api.use('/auth', authRouter);
  api.use('/config', autenticar, configRouter);

  const protegido = Router();
  protegido.use(autenticar, exigirPasswordDefinitiva);
  protegido.use('/registros', registrosRouter);
  protegido.use('/fotos', fotosRouter);
  protegido.use('/tablero', tableroRouter);
  protegido.use('/export', exportRouter);
  protegido.use('/admin', adminRouter);
  protegido.use('/pdvs', pdvsRouter);
  api.use(protegido);

  app.use(API_PREFIX, api);
  app.use(noEncontradoRuta);
  app.use(manejarErrores);
  return app;
}
