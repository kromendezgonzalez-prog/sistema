import { crearApp } from './app.js';
import { env } from './config/env.js';
import { conectarDB, desconectarDB } from './db.js';
import { logger } from './utils/logger.js';

process.env.TZ = env.TZ;

async function main() {
  await conectarDB(env.MONGODB_URI);
  logger.info('Conectado a MongoDB');
  const app = crearApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API Mercaimpulso escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
  });

  const cerrar = (senal: string) => {
    logger.info(`${senal} recibido: cerrando…`);
    server.close(async () => {
      await desconectarDB().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => cerrar('SIGTERM'));
  process.on('SIGINT', () => cerrar('SIGINT'));
}

main().catch((e) => {
  logger.fatal({ err: e }, 'No se pudo iniciar la API');
  process.exit(1);
});
