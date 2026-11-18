/**
 * Respaldo de la base a JSON: `npm run backup -w apps/api`.
 * Escribe una carpeta backups/AAAA-MM-DD/ con un archivo por colección.
 * Las contraseñas (passwordHash) NO se incluyen.
 */
import { hoyBogota } from '@merca/shared';
import { config as cargarDotenv } from 'dotenv';
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(aqui, '..');

/** Campos que nunca salen en un respaldo. */
const EXCLUIR: Record<string, string[]> = { usuarios: ['passwordHash'] };

async function main() {
  cargarDotenv({ path: resolve(RAIZ, 'apps/api/.env') });
  cargarDotenv({ path: resolve(RAIZ, '.env') });
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI (en apps/api/.env o en el entorno).');
    process.exit(1);
  }
  await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 15_000 });
  try {
    const db = mongoose.connection.db!;
    const dir = resolve(RAIZ, 'backups', hoyBogota());
    await mkdir(dir, { recursive: true });
    const colecciones = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'))
      .sort();
    const resumen: Record<string, number> = {};
    for (const nombre of colecciones) {
      const proyeccion = Object.fromEntries((EXCLUIR[nombre] ?? []).map((k) => [k, 0]));
      const docs = await db.collection(nombre).find({}, { projection: proyeccion }).toArray();
      await writeFile(resolve(dir, `${nombre}.json`), JSON.stringify(docs, null, 2), 'utf8');
      resumen[nombre] = docs.length;
    }
    await writeFile(
      resolve(dir, '_resumen.json'),
      JSON.stringify({ creado: new Date().toISOString(), colecciones: resumen }, null, 2),
      'utf8',
    );
    console.log(`Respaldo guardado en ${dir}`);
    console.table(Object.entries(resumen).map(([c, n]) => ({ Colección: c, Documentos: n })));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error('Error en el respaldo:', e instanceof Error ? e.message : e);
  process.exit(1);
});
