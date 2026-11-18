import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    pool: 'forks',
    // la primera vez mongodb-memory-server descarga el binario de MongoDB
    hookTimeout: 600_000,
    testTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://se-reemplaza-en-las-pruebas',
      JWT_SECRET: 'secreto-de-pruebas-acceso-0123456789',
      JWT_REFRESH_SECRET: 'secreto-de-pruebas-refresh-0123456789',
      CORS_ORIGIN: 'http://localhost:5173',
      CLOUDINARY_CLOUD_NAME: 'demo-nube',
      CLOUDINARY_API_KEY: '123456789012345',
      CLOUDINARY_API_SECRET: 'secreto-cloudinary-pruebas',
      TURNSTILE_SECRET: '',
      TZ: 'America/Bogota',
    },
  },
});
