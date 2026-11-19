/**
 * Semillas: `npm run seed` (desde la raíz). La lógica vive en apps/api/src/services/seed.ts.
 * Variables: MONGODB_URI, ADMIN_USER, ADMIN_PASSWORD, ADMIN_NOMBRE (apps/api/.env o entorno).
 */
import { config as cargarDotenv } from 'dotenv';
import mongoose from 'mongoose';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ConfigModel, Pdv, Producto, Usuario } from '../apps/api/src/models/index.js';
import { leerSeedConfig, sembrar } from '../apps/api/src/services/seed.js';

export { leerSeedConfig, sembrar };
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
    await Promise.all([Producto, Pdv, ConfigModel, Usuario].map((m) => m.syncIndexes()));
    const datos = await leerSeedConfig();
    const r = await sembrar(datos, {
      usuario: process.env.ADMIN_USER,
      password: process.env.ADMIN_PASSWORD,
      nombre: process.env.ADMIN_NOMBRE,
    });
    console.log('\nSemillas aplicadas (no se borró ni modificó nada existente):');
    console.log(`  Productos: ${r.productos.creados} creados, ${r.productos.existentes} ya existían`);
    console.log(`  Puntos de venta: ${r.pdvs.creados} creados, ${r.pdvs.existentes} ya existían`);
    console.log(`  Configuración: ${r.config}`);
    console.log(
      `  Admin: ${r.admin === 'omitido' ? 'omitido (define ADMIN_USER y ADMIN_PASSWORD)' : r.admin}`,
    );
    if (r.usuariosExistentes.length)
      console.log(`  Usuarios que ya existían (sin cambios): ${r.usuariosExistentes.join(', ')}`);
    if (r.usuariosNuevos.length) {
      console.log('\nUsuarios NUEVOS con contraseña temporal (entrégala a cada persona; se muestra solo esta vez):');
      console.table(
        r.usuariosNuevos.map((u) => ({
          Usuario: u.usuario,
          Nombre: u.nombre,
          Rol: u.rol,
          'Contraseña temporal': u.passwordTemporal,
        })),
      );
    } else console.log('\nNo hubo usuarios nuevos.');
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error('Error al sembrar:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
