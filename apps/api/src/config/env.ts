import 'dotenv/config';
import { z } from 'zod';

const vacioAUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const opcional = z.preprocess(vacioAUndefined, z.string().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatoria'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  /** Lista separada por comas, p. ej. "https://mercaimpulso.workers.dev,http://localhost:5173" */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
  CLOUDINARY_CLOUD_NAME: opcional,
  CLOUDINARY_API_KEY: opcional,
  CLOUDINARY_API_SECRET: opcional,
  ADMIN_USER: opcional,
  ADMIN_PASSWORD: opcional,
  TURNSTILE_SECRET: opcional,
  TZ: z.string().default('America/Bogota'),
  LOG_LEVEL: opcional,
});

export type Env = z.infer<typeof EnvSchema>;

function cargar(): Env {
  const r = EnvSchema.safeParse(process.env);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`Variables de entorno inválidas:\n${msg}`);
    throw new Error('Variables de entorno inválidas');
  }
  if (r.data.JWT_SECRET === r.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos');
  }
  return r.data;
}

export const env = cargar();
export const esProduccion = env.NODE_ENV === 'production';
export const esTest = env.NODE_ENV === 'test';
