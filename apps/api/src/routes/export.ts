import { FechaSchema } from '@merca/shared';
import { Router } from 'express';
import { z } from 'zod';
import { permitir } from '../middleware/auth.js';
import { Producto, Registro } from '../models/index.js';
import { auditar } from '../services/auditoria.js';
import { obtenerConfig } from '../services/config.js';
import { MIME_XLSX, libroExport, type ProductosMap, type RegistroX } from '../services/excel.js';
import { ah, parsear } from '../utils/errores.js';
import { rangoConsulta } from './tablero.js';

const router = Router();

const ExportQuery = z.object({ desde: FechaSchema.optional(), hasta: FechaSchema.optional() });

/* GET /export?desde&hasta → .xlsx (hoja "Detalle") */
router.get(
  '/',
  permitir('admin', 'supervisor'),
  ah(async (req, res) => {
    const q = parsear(ExportQuery, req.query);
    const { desde, hasta } = rangoConsulta(q.desde, q.hasta, 30);
    const [regs, productos, config] = await Promise.all([
      Registro.find({ fecha: { $gte: desde, $lte: hasta } })
        .sort({ fecha: 1, pdvNombre: 1, turnoOrden: 1 })
        .lean(),
      Producto.find().lean(),
      obtenerConfig(),
    ]);
    const P: ProductosMap = {};
    for (const p of productos)
      P[String(p._id)] = { nombre: p.nombre, unidad: p.unidad as 'kg' | 'und', pesoKg: p.pesoKg ?? null };
    const buf = await libroExport(regs as unknown as RegistroX[], P, config.riesgoVto);
    await auditar(req, {
      accion: 'EXPORT_EXCEL',
      entidad: 'registro',
      entidadId: null,
      resumen: `Descargó Excel de registros del ${desde} al ${hasta} (${regs.length} registro(s))`,
    });
    const nombre = `mercaimpulso_${desde}_${hasta}.xlsx`;
    res.setHeader('Content-Type', MIME_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }),
);

export default router;
