import { pino } from 'pino';
import { env, esProduccion, esTest } from '../config/env.js';

/** Logger sin datos sensibles (tokens, cookies, contraseñas). */
export const logger = pino({
  level: env.LOG_LEVEL ?? (esTest ? 'silent' : esProduccion ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.actual',
      '*.nueva',
      '*.turnstileToken',
    ],
    censor: '[oculto]',
  },
});
