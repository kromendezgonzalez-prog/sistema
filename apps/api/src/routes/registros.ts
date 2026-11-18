import {
  FechaSchema,
  RegistroInputSchema,
  TURNOS,
  registroId,
  type Lote,
  type Paginado,
  type Registro as RegistroT,
  type SyncResponse,
  type UltimoInventarioResponse,
} from '@merca/shared';
import { Router } from 'express';
import { z } from 'zod';
import { permitir } from '../middleware/auth.js';
import { Registro } from '../models/index.js';
import { auditar } from '../services/auditoria.js';
import { obtenerConfig } from '../services/config.js';
import { aRegistro, guardarRegistro, leerRegistro } from '../services/registros.js';
import { HttpError, ah, detalleZod, parsear, sinPermiso } from '../utils/errores.js';
import { paginacion, turnoOrden } from '../utils/varios.js';

const router = Router();

const ListarQuery = z.object({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
  impulsadoraId: z.string().max(60).optional(),
  pdvId: z.string().max(60).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  porPagina: z.coerce.number().int().min(1).optional(),
});

/* GET /registros */
router.get(
  '/',
  ah(async (req, res) => {
    const yo = req.usuario!;
    const q = parsear(ListarQuery, req.query);
    const filtro: Record<string, unknown> = {};
    if (q.desde || q.hasta)
      filtro.fecha = { ...(q.desde ? { $gte: q.desde } : {}), ...(q.hasta ? { $lte: q.hasta } : {}) };
    if (yo.rol === 'impulsadora') filtro.impulsadoraId = yo._id;
    else if (q.impulsadoraId) filtro.impulsadoraId = q.impulsadoraId;
    if (q.pdvId) filtro.pdvId = q.pdvId;
    const { pagina, porPagina, saltar } = paginacion(q.pagina, q.porPagina, 50, 200);
    const [docs, total] = await Promise.all([
      Registro.find(filtro).sort({ fecha: -1, turnoOrden: -1, _id: 1 }).skip(saltar).limit(porPagina).lean(),
      Registro.countDocuments(filtro),
    ]);
    const body: Paginado<RegistroT> = {
      items: docs.map((d) => aRegistro(d as Record<string, unknown>)),
      total,
      pagina,
      porPagina,
    };
    res.json(body);
  }),
);

const UltimoQuery = z.object({
  pdvId: z.string().min(1).max(60),
  fecha: FechaSchema,
  turno: z.enum(TURNOS),
});

/* GET /registros/ultimo-inventario?pdvId&fecha&turno */
router.get(
  '/ultimo-inventario',
  ah(async (req, res) => {
    const yo = req.usuario!;
    const q = parsear(UltimoQuery, req.query);
    if (yo.rol === 'impulsadora' && !yo.pdvIds.includes(q.pdvId))
      throw sinPermiso('Ese punto de venta no está asignado a ti.');
    const t = turnoOrden(q.turno);
    const r = await Registro.findOne({
      pdvId: q.pdvId,
      tipoDia: 'Laboral',
      $or: [{ fecha: { $lt: q.fecha } }, { fecha: q.fecha, turnoOrden: { $lt: t } }],
    })
      .sort({ fecha: -1, turnoOrden: -1 })
      .lean();
    if (!r) {
      const vacio: UltimoInventarioResponse = { previo: null };
      return res.json(vacio);
    }
    const lotes: Record<string, Lote[]> = {};
    const items = (r.items ?? {}) as Record<string, { lotesIni?: Lote[]; lotesFin?: Lote[] }>;
    for (const [cod, it] of Object.entries(items)) {
      const ls = it.lotesFin ?? it.lotesIni;
      if (!ls) continue;
      // Se precargan cantidades y fechas; las novedades del turno anterior no se arrastran.
      lotes[cod] = ls.map((l) => ({ id: l.id, cantidad: l.cantidad, vto: l.vto ?? null }));
    }
    const body: UltimoInventarioResponse = {
      previo: {
        registroId: String(r._id),
        fecha: r.fecha,
        turno: r.turno,
        impulsadoraNombre: r.impulsadoraNombre ?? '',
        lotes,
      },
    };
    res.json(body);
  }),
);

/* POST /registros/sync — cada registro se procesa como un PUT; un error no frena los demás */
router.post(
  '/sync',
  permitir('impulsadora', 'admin'),
  ah(async (req, res) => {
    const yo = req.usuario!;
    const sobre = parsear(z.object({ registros: z.array(z.unknown()).min(1).max(50) }), req.body);
    const config = await obtenerConfig();
    const resultados: SyncResponse['resultados'] = [];
    let ok = 0;
    for (const crudo of sobre.registros) {
      const c = (crudo ?? {}) as Record<string, unknown>;
      const impId =
        yo.rol === 'admin' && typeof c.impulsadoraId === 'string' && c.impulsadoraId ? c.impulsadoraId : yo._id;
      const idTentativo = registroId(String(c.fecha ?? ''), impId, String(c.pdvId ?? ''), String(c.turno ?? ''));
      const p = RegistroInputSchema.safeParse(crudo);
      if (!p.success) {
        const d = detalleZod(p.error);
        resultados.push({
          id: idTentativo,
          ok: false,
          error: `Datos inválidos: ${d.map((x) => `${x.path || 'registro'}: ${x.message}`).join('; ')}`,
        });
        continue;
      }
      try {
        const r = await guardarRegistro(req, yo, p.data, null, 'offline-sync', config);
        resultados.push({ id: r.registro._id, ok: true, registro: r.registro });
        ok++;
      } catch (e) {
        if (e instanceof HttpError) resultados.push({ id: idTentativo, ok: false, error: e.message });
        else throw e;
      }
    }
    await auditar(req, {
      accion: 'REGISTRO_SYNC_OFFLINE',
      entidad: 'registro',
      entidadId: null,
      resumen: `Sincronizó ${ok} de ${sobre.registros.length} registro(s) guardados sin señal`,
    });
    const body: SyncResponse = { resultados };
    res.json(body);
  }),
);

/* GET /registros/:id */
router.get(
  '/:id',
  ah(async (req, res) => {
    const registro = await leerRegistro(req.usuario!, req.params.id);
    res.json({ registro });
  }),
);

/* PUT /registros/:id */
router.put(
  '/:id',
  permitir('impulsadora', 'admin'),
  ah(async (req, res) => {
    const input = parsear(RegistroInputSchema, req.body);
    const r = await guardarRegistro(req, req.usuario!, input, req.params.id, 'online');
    res.json(r);
  }),
);

export default router;
