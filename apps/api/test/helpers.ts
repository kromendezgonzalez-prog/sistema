import { hoyBogota, registroId, sumarDias, type RegistroInput } from '@merca/shared';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import { crearApp } from '../src/app.js';
import { ConfigModel, Pdv, Producto, Usuario } from '../src/models/index.js';
import { CONFIG_DEF } from '../src/services/config.js';
import { hashPassword } from '../src/utils/password.js';

export const PASS = 'clave-segura-1';

/** Conecta a una base propia del archivo de pruebas y la borra al final. */
export function usarBaseDePruebas() {
  beforeAll(async () => {
    const uri = process.env.MONGO_TEST_URI;
    if (!uri) throw new Error('Falta MONGO_TEST_URI (global-setup)');
    const nombre = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await mongoose.connect(uri, { dbName: nombre, maxPoolSize: 5 });
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  });
}

export const app = crearApp();

/** Ubicación del punto "p1" (con coordenadas). */
export const UBICACION_P1 = { lat: 4.6097, lng: -74.0817 };

export async function sembrarBasico() {
  await ConfigModel.create({ _id: 'general', ...CONFIG_DEF });
  await Producto.create([
    { _id: '33017', nombre: 'PUNTA DE ANCA DE CERDO', unidad: 'kg', pesoKg: null },
    { _id: '33062', nombre: 'TROCITOS DE COSTILLA LOMUS 500 g', unidad: 'und', pesoKg: 0.5 },
  ]);
  await Pdv.create([
    { _id: 'p1', nombre: 'Mercacentro 4', cadena: 'Mercacentro', ciudad: 'Ibagué', ubicacion: UBICACION_P1, radioM: 300 },
    { _id: 'p2', nombre: 'Surtiplaza Aqua', cadena: 'Surtiplaza', ciudad: 'Ibagué', ubicacion: null },
    { _id: 'p3', nombre: 'Punto inactivo', activo: false },
  ]);
  const hash = await hashPassword(PASS);
  const base = { passwordHash: hash, debeCambiarPassword: false, activo: true };
  await Usuario.create([
    { _id: 'admin', nombre: 'Carolina Admin', usuario: 'admin', rol: 'admin', ...base },
    { _id: 'super', nombre: 'Sofía Supervisora', usuario: 'super', rol: 'supervisor', ...base },
    { _id: 'ana', nombre: 'Ana Impulsadora', usuario: 'ana', rol: 'impulsadora', pdvIds: ['p1'], ...base },
    { _id: 'bea', nombre: 'Bea Impulsadora', usuario: 'bea', rol: 'impulsadora', pdvIds: ['p2'], ...base },
  ]);
}

export async function login(usuario: string, password = PASS) {
  const r = await request(app).post('/api/v1/auth/login').send({ usuario, password });
  if (r.status !== 200) throw new Error(`login ${usuario} falló: ${r.status} ${JSON.stringify(r.body)}`);
  const setCookie = r.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (setCookie ?? []).find((c) => c.startsWith('rt='))?.split(';')[0] ?? '';
  return { token: r.body.accessToken as string, cookie, body: r.body };
}

export const hoy = () => hoyBogota();
export const diasAtras = (n: number) => sumarDias(hoyBogota(), -n);

export function geoEn(lat: number, lng: number) {
  return { lat, lng, precisionM: 12, capturadoEn: new Date().toISOString() };
}

/** Registro laboral mínimo válido en el punto indicado. */
export function registroBase(over: Partial<RegistroInput> & { pdvId: string }): RegistroInput {
  return {
    fecha: hoy(),
    turno: 'Mañana',
    tipoDia: 'Laboral',
    items: {},
    ejec: {},
    comp: {},
    impulso: {},
    nov: [],
    obs: '',
    fotosGondola: [],
    geo: geoEn(UBICACION_P1.lat, UBICACION_P1.lng),
    ...over,
  } as RegistroInput;
}

export function idDe(r: Pick<RegistroInput, 'fecha' | 'pdvId' | 'turno'>, impulsadoraId: string) {
  return registroId(r.fecha, impulsadoraId, r.pdvId, r.turno);
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
