/**
 * MongoDB temporal para probar en el computador sin Atlas: `npm run mongo:local`.
 * Queda escuchando en mongodb://127.0.0.1:27027/mercaimpulso hasta cerrar la terminal.
 * Los datos se guardan en .mongo-local/ (ignorado por git).
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dbPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.mongo-local');
mkdirSync(dbPath, { recursive: true });

const srv = await MongoMemoryServer.create({
  instance: { port: 27027, dbPath, storageEngine: 'wiredTiger' },
});
console.log(`MongoDB local listo: ${srv.getUri()}mercaimpulso`);
const cerrar = async () => {
  await srv.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
