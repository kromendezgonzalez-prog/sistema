import {
  FechaSchema,
  calcularTablero,
  diffDias,
  hoyBogota,
  sumarDias,
  type RegistroCalc,
  type TableroResponse,
} from '@merca/shared';
import { Router } from 'express';
import { z } from 'zod';
import { Producto, Registro, Usuario } from '../models/index.js';
import { obtenerConfig } from '../services/config.js';
import { ah, invalido, parsear } from '../utils/errores.js';

const router = Router();

const TableroQuery = z.object({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
  impulsadoraId: z.string().max(60).optional(),
  pdvId: z.string().max(60).optional(),
});

/** Máximo de días por consulta (protege la API y la BD). */
const MAX_DIAS_RANGO = 400;

/** Rango por defecto: últimos 7 días (incluye hoy). */
export function rangoConsulta(desde?: string, hasta?: string, diasDef = 7) {
  const hoy = hoyBogota();
  const h = hasta ?? hoy;
  const d = desde ?? sumarDias(h, -(diasDef - 1));
  if (d > h) throw invalido('La fecha "desde" no puede ser posterior a "hasta".');
  if (diffDias(h, d) > MAX_DIAS_RANGO) throw invalido(`El rango máximo es de ${MAX_DIAS_RANGO} días.`);
  return { desde: d, hasta: h, hoy };
}

/* GET /tablero?desde&hasta&impulsadoraId&pdvId */
router.get(
  '/',
  ah(async (req, res) => {
    const yo = req.usuario!;
    const q = parsear(TableroQuery, req.query);
    const { desde, hasta, hoy } = rangoConsulta(q.desde, q.hasta);
    const impulsadoraId = yo.rol === 'impulsadora' ? yo._id : q.impulsadoraId || null;
    const pdvId = q.pdvId || null;

    const filtro: Record<string, unknown> = { fecha: { $gte: desde, $lte: hasta } };
    if (impulsadoraId) filtro.impulsadoraId = impulsadoraId;
    if (pdvId) filtro.pdvId = pdvId;

    const filtroEquipo: Record<string, unknown> = { rol: 'impulsadora', activo: true };
    if (impulsadoraId) filtroEquipo._id = impulsadoraId;
    if (pdvId) filtroEquipo.pdvIds = pdvId;

    const [regs, productos, equipo, config] = await Promise.all([
      Registro.find(filtro).sort({ fecha: 1, turnoOrden: 1 }).lean(),
      Producto.find().lean(),
      Usuario.find(filtroEquipo).select('nombre').sort({ nombre: 1 }).lean(),
      obtenerConfig(),
    ]);

    const P: Record<string, { nombre: string; unidad: 'kg' | 'und'; pesoKg: number | null }> = {};
    for (const p of productos)
      P[String(p._id)] = { nombre: p.nombre, unidad: p.unidad as 'kg' | 'und', pesoKg: p.pesoKg ?? null };

    const tablero = calcularTablero(regs as unknown as RegistroCalc[], {
      productos: P,
      equipo: equipo.map((u) => ({ _id: String(u._id), nombre: u.nombre })),
      metas: config.metas,
      riesgoVto: config.riesgoVto,
      desde,
      hasta,
      hoy,
    });

    const checkins: TableroResponse['checkins'] = [];
    for (const r of regs) {
      const g = r.geo as { lat?: number; lng?: number; distanciaPdvM?: number | null; dentroDeRango?: boolean | null } | null;
      if (!g || typeof g.lat !== 'number' || typeof g.lng !== 'number') continue;
      checkins.push({
        registroId: String(r._id),
        fecha: r.fecha,
        turno: r.turno,
        impulsadoraNombre: r.impulsadoraNombre ?? '',
        pdvNombre: r.pdvNombre ?? '',
        lat: g.lat,
        lng: g.lng,
        distanciaPdvM: g.distanciaPdvM ?? null,
        dentroDeRango: g.dentroDeRango ?? null,
      });
    }

    const body: TableroResponse = {
      ...tablero,
      filtros: { desde, hasta, impulsadoraId, pdvId },
      checkins,
    };
    res.json(body);
  }),
);

export default router;
