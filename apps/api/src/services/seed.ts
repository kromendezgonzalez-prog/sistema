/** Semillas idempotentes (compartidas por scripts/seed.ts y el arranque de la API). Nunca borra ni sobrescribe. */
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
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigModel, Pdv, Producto, Usuario } from '../models/index.js';
import { generarPasswordTemporal, hashPassword } from '../utils/password.js';

const aqui = dirname(fileURLToPath(import.meta.url));
/** raíz del repo (src/services o dist/services → ../../../..) */
const RAIZ = resolve(aqui, '../../../..');

export interface SeedConfig {
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

