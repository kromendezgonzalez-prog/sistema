/**
 * Semillas idempotentes: `npm run seed` (desde la raíz).
 * Lee referencia/seed-config.json y crea lo que falte. NUNCA borra ni sobrescribe datos existentes
 * (lo que la administradora edite en el panel se respeta).
 *
 * Variables: MONGODB_URI (obligatoria), ADMIN_USER y ADMIN_PASSWORD (para crear la cuenta admin),
 * ADMIN_NOMBRE (opcional). Se leen de apps/api/.env o del entorno.
 */
import {
  METAS_DEF,
  NOVEDADES_GENERALES,
  NOVEDADES_PRODUCTO,
  PasswordSchema,
  PdvSchema,
  ProductoSchema,
  RIESGO_DEF,
  UsuarioNombreSchema,
} from '@merca/shared';
import { config as cargarDotenv } from 'dotenv';
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ConfigModel, Pdv, Producto, Usuario } from '../apps/api/src/models/index.js';
import { generarPasswordTemporal, hashPassword } from '../apps/api/src/utils/password.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(aqui, '..');

interface SeedConfig {
  catalogo: { cod: string; nombre: string; unidad: 'kg' | 'und'; peso: number | null; activo?: boolean }[];
  pdvs: { id: string; nombre: string; cadena?: string; ciudad?: string; activo?: boolean }[];
  equipo: { id: string; nombre: string; rol: 'admin' | 'supervisor' | 'impulsadora'; ciudad?: string; pdvs?: string[]; activo?: boolean }[];
  metas: Record<string, number>;
  marcasCompetencia: string[];
}

export interface ResultadoSeed {
  productos: { creados: number; existentes: number };
  pdvs: { creados: number; existentes: number };
  config: 'creada' | 'existente';
  usuariosNuevos: { usuario: string; nombre: string; rol: string; passwordTemporal: string }[];
  usuariosExistentes: string[];
  admin: 'creado' | 'existente' | 'omitido';
}

export async function leerSeedConfig(ruta = resolve(RAIZ, 'referencia/seed-config.json')): Promise<SeedConfig> {
  return JSON.parse(await readFile(ruta, 'utf8')) as SeedConfig;
}

/** Inserta solo si no existe (no modifica documentos existentes). */
async function insertarSiFalta(modelo: mongoose.Model<any>, _id: string, doc: Record<string, unknown>) {
  const r = await modelo.updateOne({ _id }, { $setOnInsert: { _id, ...doc } }, { upsert: true });
  return r.upsertedCount > 0;
}

export async function sembrar(
  datos: SeedConfig,
  admin?: { usuario?: string; password?: string; nombre?: string },
): Promise<ResultadoSeed> {
  const res: ResultadoSeed = {
    productos: { creados: 0, existentes: 0 },
    pdvs: { creados: 0, existentes: 0 },
    config: 'existente',
    usuariosNuevos: [],
    usuariosExistentes: [],
    admin: 'omitido',
  };

  // Productos (cod → _id, peso → pesoKg)
  for (const p of datos.catalogo) {
    const prod = ProductoSchema.parse({
      _id: String(p.cod),
      nombre: p.nombre,
      unidad: p.unidad,
      pesoKg: p.peso ?? null,
      activo: p.activo ?? true,
    });
    const { _id, ...resto } = prod;
    if (await insertarSiFalta(Producto, _id, resto)) res.productos.creados++;
    else res.productos.existentes++;
  }

  // Puntos de venta (id → _id, sin ubicación, radio 300 m, portafolio vacío = todos)
  for (const p of datos.pdvs) {
    const pdv = PdvSchema.parse({
      _id: p.id,
      nombre: p.nombre,
      cadena: p.cadena ?? '',
      ciudad: p.ciudad ?? '',
      portafolio: [],
      ubicacion: null,
      radioM: 300,
      activo: p.activo ?? true,
    });
    const { _id, ...resto } = pdv;
    if (await insertarSiFalta(Pdv, _id, resto)) res.pdvs.creados++;
    else res.pdvs.existentes++;
  }

  // Config general (metas sin alertaVto; umbrales de riesgo nuevos)
  const m = datos.metas ?? {};
  const config = {
    metas: {
      doh: m.doh ?? METAS_DEF.doh,
      merma: m.merma ?? METAS_DEF.merma,
      osa: m.osa ?? METAS_DEF.osa,
      sos: m.sos ?? METAS_DEF.sos,
      conv: m.conv ?? METAS_DEF.conv,
    },
    riesgoVto: { ...RIESGO_DEF },
    marcasCompetencia: datos.marcasCompetencia ?? [],
    novedadesGenerales: [...NOVEDADES_GENERALES],
    novedadesProducto: [...NOVEDADES_PRODUCTO],
    actualizadoEn: new Date(),
  };
  res.config = (await insertarSiFalta(ConfigModel, 'general', config)) ? 'creada' : 'existente';

  // Equipo (usuario = id). Contraseña temporal NUEVA solo si el usuario no existe.
  for (const e of datos.equipo) {
    const usuario = UsuarioNombreSchema.parse(e.id.toLowerCase());
    if (await Usuario.exists({ $or: [{ _id: e.id }, { usuario }] })) {
      res.usuariosExistentes.push(usuario);
      continue;
    }
    const passwordTemporal = generarPasswordTemporal();
    await Usuario.create({
      _id: e.id,
      nombre: e.nombre,
      usuario,
      passwordHash: await hashPassword(passwordTemporal),
      rol: e.rol,
      ciudad: e.ciudad ?? '',
      pdvIds: e.pdvs ?? [],
      activo: e.activo ?? true,
      debeCambiarPassword: true,
      creadoEn: new Date(),
    });
    res.usuariosNuevos.push({ usuario, nombre: e.nombre, rol: e.rol, passwordTemporal });
  }

  // Admin desde variables de entorno (si existe, no se toca su contraseña)
  if (admin?.usuario && admin.password) {
    const usuario = UsuarioNombreSchema.parse(admin.usuario.trim().toLowerCase());
    if (await Usuario.exists({ usuario })) res.admin = 'existente';
    else {
      PasswordSchema.parse(admin.password);
      await Usuario.create({
        _id: usuario,
        nombre: admin.nombre?.trim() || 'Administradora',
        usuario,
        passwordHash: await hashPassword(admin.password),
        rol: 'admin',
        ciudad: '',
        pdvIds: [],
        activo: true,
        debeCambiarPassword: false,
        creadoEn: new Date(),
      });
      res.admin = 'creado';
    }
  }
  return res;
}

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
