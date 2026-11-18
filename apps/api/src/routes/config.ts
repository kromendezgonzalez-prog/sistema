import type { ConfigResponse, MiembroEquipo, Pdv as PdvT, Producto as ProductoT } from '@merca/shared';
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { Pdv, Producto, Usuario } from '../models/index.js';
import { obtenerConfig } from '../services/config.js';
import { ah } from '../utils/errores.js';

const router = Router();

export async function listarPdvs(): Promise<PdvT[]> {
  const docs = await Pdv.find().sort({ nombre: 1 }).lean();
  return docs.map((p) => ({
    _id: String(p._id),
    nombre: p.nombre,
    cadena: p.cadena ?? '',
    ciudad: p.ciudad ?? '',
    portafolio: p.portafolio ?? [],
    ubicacion: p.ubicacion && p.ubicacion.lat != null && p.ubicacion.lng != null
      ? { lat: p.ubicacion.lat, lng: p.ubicacion.lng }
      : null,
    radioM: p.radioM ?? 300,
    activo: p.activo !== false,
  }));
}

export async function listarProductos(): Promise<ProductoT[]> {
  const docs = await Producto.find().sort({ _id: 1 }).lean();
  return docs.map((p) => ({
    _id: String(p._id),
    nombre: p.nombre,
    unidad: p.unidad as ProductoT['unidad'],
    pesoKg: p.pesoKg ?? null,
    activo: p.activo !== false,
  }));
}

/* GET /config — con ETag (If-None-Match → 304) */
router.get(
  '/',
  ah(async (req, res) => {
    const yo = req.usuario!;
    const [config, productos, pdvs, usuarios] = await Promise.all([
      obtenerConfig(),
      listarProductos(),
      listarPdvs(),
      yo.rol === 'impulsadora'
        ? Usuario.find({ _id: yo._id }).lean()
        : Usuario.find().sort({ nombre: 1 }).lean(),
    ]);
    const equipo: MiembroEquipo[] = usuarios.map((u) => ({
      _id: String(u._id),
      nombre: u.nombre,
      rol: u.rol as MiembroEquipo['rol'],
      ciudad: u.ciudad ?? '',
      pdvIds: u.pdvIds ?? [],
      activo: u.activo !== false,
    }));
    const contenido = { config, productos, pdvs, equipo };
    const version = createHash('sha1').update(JSON.stringify(contenido)).digest('hex').slice(0, 16);
    const etag = `"${version}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', 'private, no-cache');
    const inm = req.get('if-none-match');
    if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) {
      res.status(304).end();
      return;
    }
    const body: ConfigResponse = { ...contenido, version };
    res.json(body);
  }),
);

export default router;
