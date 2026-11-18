import {
  ConfigSchema,
  FechaSchema,
  PdvSchema,
  ProductoSchema,
  UbicacionSchema,
  UsuarioCrearSchema,
  UsuarioEditarSchema,
  hoyBogota,
  type AuditoriaResponse,
  type Config,
  type EventoAuditoria,
  type Item,
  type NovedadFila,
  type NovedadesResponse,
  type PasswordTemporalResponse,
} from '@merca/shared';
import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { permitir } from '../middleware/auth.js';
import { validarBody } from '../middleware/validar.js';
import { Auditoria, ConfigModel, Pdv, Producto, Registro, Usuario } from '../models/index.js';
import { auditar, diffCampos } from '../services/auditoria.js';
import { obtenerConfig } from '../services/config.js';
import { MIME_XLSX, libroBackup, type DatosBackup, type RegistroX } from '../services/excel.js';
import { ah, conflicto, invalido, noEncontrado, parsear } from '../utils/errores.js';
import { generarPasswordTemporal, hashPassword } from '../utils/password.js';
import { usuarioPublico } from '../utils/usuarios.js';
import { escaparRegex, finDiaBogota, inicioDiaBogota, paginacion } from '../utils/varios.js';
import { listarPdvs, listarProductos } from './config.js';
import { rangoConsulta } from './tablero.js';

const router = Router();
const soloAdmin = permitir('admin');

async function validarPdvIds(ids: string[] | undefined) {
  if (!ids?.length) return;
  const existentes = new Set((await Pdv.find({ _id: { $in: ids } }).select('_id').lean()).map((p) => String(p._id)));
  const malos = ids.filter((i) => !existentes.has(i));
  if (malos.length)
    throw invalido(`Puntos de venta inexistentes: ${malos.join(', ')}`, [
      { path: 'pdvIds', message: `No existen: ${malos.join(', ')}` },
    ]);
}

async function validarPortafolio(cods: string[] | undefined) {
  if (!cods?.length) return;
  const existentes = new Set(
    (await Producto.find({ _id: { $in: cods } }).select('_id').lean()).map((p) => String(p._id)),
  );
  const malos = cods.filter((c) => !existentes.has(c));
  if (malos.length)
    throw invalido(`Productos inexistentes en el portafolio: ${malos.join(', ')}`, [
      { path: 'portafolio', message: `No existen: ${malos.join(', ')}` },
    ]);
}

/** Solo las claves definidas (para $set en PATCH). */
function definidos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/* ───────────── Usuarios ───────────── */

router.get(
  '/usuarios',
  soloAdmin,
  ah(async (_req, res) => {
    const us = await Usuario.find().sort({ rol: 1, nombre: 1 }).lean();
    res.json({ items: us.map(usuarioPublico) });
  }),
);

router.post(
  '/usuarios',
  soloAdmin,
  validarBody(UsuarioCrearSchema),
  ah(async (req, res) => {
    const d = req.body as z.infer<typeof UsuarioCrearSchema>;
    if (await Usuario.exists({ usuario: d.usuario })) throw conflicto(`Ya existe el usuario "${d.usuario}".`);
    await validarPdvIds(d.pdvIds);
    let _id = d.usuario;
    while (await Usuario.exists({ _id })) _id = `${d.usuario}-${randomInt(1000, 9999)}`;
    const passwordTemporal = generarPasswordTemporal();
    const u = await Usuario.create({
      _id,
      ...d,
      passwordHash: await hashPassword(passwordTemporal),
      debeCambiarPassword: true,
      creadoEn: new Date(),
    });
    await auditar(req, {
      accion: 'USUARIO_CREADO',
      entidad: 'usuario',
      entidadId: _id,
      resumen: `Creó el usuario "${d.usuario}" (${d.nombre}, ${d.rol})`,
      cambios: diffCampos(null, { nombre: d.nombre, usuario: d.usuario, rol: d.rol, ciudad: d.ciudad, pdvIds: d.pdvIds, activo: d.activo }, ['nombre', 'usuario', 'rol', 'ciudad', 'pdvIds', 'activo']),
    });
    const body: PasswordTemporalResponse = { usuario: usuarioPublico(u.toObject()), passwordTemporal };
    res.status(201).json(body);
  }),
);

router.patch(
  '/usuarios/:id',
  soloAdmin,
  validarBody(UsuarioEditarSchema),
  ah(async (req, res) => {
    const yo = req.usuario!;
    const d = definidos(req.body as z.infer<typeof UsuarioEditarSchema>);
    const u = await Usuario.findById(req.params.id);
    if (!u) throw noEncontrado('El usuario no existe.');
    if (u._id === yo._id && (d.activo === false || (d.rol !== undefined && d.rol !== 'admin')))
      throw invalido('No puedes desactivarte ni quitarte el rol de administradora a ti misma.');
    if (d.usuario && d.usuario !== u.usuario && (await Usuario.exists({ usuario: d.usuario, _id: { $ne: u._id } })))
      throw conflicto(`Ya existe el usuario "${d.usuario}".`);
    await validarPdvIds(d.pdvIds);

    const antes = u.toObject();
    const cambios = diffCampos(antes as Record<string, unknown>, d, ['nombre', 'usuario', 'rol', 'ciudad', 'pdvIds', 'activo']);
    if (!Object.keys(cambios).length) return res.json({ usuario: usuarioPublico(antes) });

    u.set(d);
    if (cambios.activo || cambios.rol) u.tokenVersion = (u.tokenVersion ?? 0) + 1; // cierra sesiones
    await u.save();
    await auditar(req, {
      accion: 'USUARIO_EDITADO',
      entidad: 'usuario',
      entidadId: u._id,
      resumen: `Editó el usuario "${u.usuario}": ${Object.keys(cambios).join(', ')}`,
      cambios,
    });
    res.json({ usuario: usuarioPublico(u.toObject()) });
  }),
);

router.post(
  '/usuarios/:id/reset-password',
  soloAdmin,
  ah(async (req, res) => {
    const u = await Usuario.findById(req.params.id);
    if (!u) throw noEncontrado('El usuario no existe.');
    const passwordTemporal = generarPasswordTemporal();
    u.passwordHash = await hashPassword(passwordTemporal);
    u.debeCambiarPassword = true;
    u.intentosFallidos = 0;
    u.bloqueadoHasta = null;
    u.tokenVersion = (u.tokenVersion ?? 0) + 1;
    await u.save();
    await auditar(req, {
      accion: 'PASSWORD_RESETEADA',
      entidad: 'usuario',
      entidadId: u._id,
      resumen: `Restableció la contraseña de "${u.usuario}" (queda con contraseña temporal y desbloqueado)`,
    });
    const body: PasswordTemporalResponse = { usuario: usuarioPublico(u.toObject()), passwordTemporal };
    res.json(body);
  }),
);

/* ───────────── Puntos de venta ───────────── */

const PdvEditarSchema = PdvSchema.omit({ _id: true }).partial();

router.get(
  '/pdvs',
  soloAdmin,
  ah(async (_req, res) => {
    res.json({ items: await listarPdvs() });
  }),
);

router.post(
  '/pdvs',
  soloAdmin,
  validarBody(PdvSchema),
  ah(async (req, res) => {
    const d = req.body as z.infer<typeof PdvSchema>;
    if (await Pdv.exists({ _id: d._id })) throw conflicto(`Ya existe un punto de venta con id "${d._id}".`);
    await validarPortafolio(d.portafolio);
    await Pdv.create(d);
    await auditar(req, {
      accion: 'PDV_CREADO',
      entidad: 'pdv',
      entidadId: d._id,
      resumen: `Creó el punto de venta "${d.nombre}"`,
    });
    const pdv = (await listarPdvs()).find((p) => p._id === d._id);
    res.status(201).json({ pdv });
  }),
);

router.patch(
  '/pdvs/:id',
  soloAdmin,
  validarBody(PdvEditarSchema),
  ah(async (req, res) => {
    const d = definidos(req.body as z.infer<typeof PdvEditarSchema>);
    const p = await Pdv.findById(req.params.id);
    if (!p) throw noEncontrado('El punto de venta no existe.');
    await validarPortafolio(d.portafolio);
    const antes = p.toObject() as Record<string, unknown>;
    const cambios = diffCampos(antes, d, ['nombre', 'cadena', 'ciudad', 'portafolio', 'ubicacion', 'radioM', 'activo']);
    if (Object.keys(cambios).length) {
      p.set(d);
      await p.save();
      await auditar(req, {
        accion: 'PDV_EDITADO',
        entidad: 'pdv',
        entidadId: String(p._id),
        resumen: `Editó el punto de venta "${p.nombre}": ${Object.keys(cambios).join(', ')}`,
        cambios,
      });
    }
    const pdv = (await listarPdvs()).find((x) => x._id === String(p._id));
    res.json({ pdv });
  }),
);

/* ───────────── Productos ───────────── */

const ProductoEditarSchema = ProductoSchema.omit({ _id: true }).partial();

router.get(
  '/productos',
  soloAdmin,
  ah(async (_req, res) => {
    res.json({ items: await listarProductos() });
  }),
);

router.post(
  '/productos',
  soloAdmin,
  validarBody(ProductoSchema),
  ah(async (req, res) => {
    const d = req.body as z.infer<typeof ProductoSchema>;
    if (await Producto.exists({ _id: d._id })) throw conflicto(`Ya existe un producto con código "${d._id}".`);
    await Producto.create(d);
    await auditar(req, {
      accion: 'PRODUCTO_CREADO',
      entidad: 'producto',
      entidadId: d._id,
      resumen: `Creó el producto ${d._id} "${d.nombre}"`,
    });
    res.status(201).json({ producto: d });
  }),
);

router.patch(
  '/productos/:id',
  soloAdmin,
  validarBody(ProductoEditarSchema),
  ah(async (req, res) => {
    const d = definidos(req.body as z.infer<typeof ProductoEditarSchema>);
    const p = await Producto.findById(req.params.id);
    if (!p) throw noEncontrado('El producto no existe.');
    const cambios = diffCampos(p.toObject() as Record<string, unknown>, d, ['nombre', 'unidad', 'pesoKg', 'activo']);
    if (Object.keys(cambios).length) {
      p.set(d);
      await p.save();
      await auditar(req, {
        accion: 'PRODUCTO_EDITADO',
        entidad: 'producto',
        entidadId: String(p._id),
        resumen: `Editó el producto ${p._id} "${p.nombre}": ${Object.keys(cambios).join(', ')}`,
        cambios,
      });
    }
    const producto = (await listarProductos()).find((x) => x._id === String(p._id));
    res.json({ producto });
  }),
);

/* ───────────── Config ───────────── */

router.put(
  '/config',
  soloAdmin,
  validarBody(ConfigSchema),
  ah(async (req, res) => {
    const nueva = req.body as Config;
    const antes = await obtenerConfig();
    const cambios = diffCampos(antes as unknown as Record<string, unknown>, nueva as unknown as Record<string, unknown>, [
      'metas',
      'riesgoVto',
      'marcasCompetencia',
      'novedadesGenerales',
      'novedadesProducto',
    ]);
    await ConfigModel.updateOne(
      { _id: 'general' },
      { $set: { ...nueva, actualizadoEn: new Date() } },
      { upsert: true },
    );
    if (Object.keys(cambios).length)
      await auditar(req, {
        accion: 'CONFIG_CAMBIADA',
        entidad: 'config',
        entidadId: 'general',
        resumen: `Cambió la configuración: ${Object.keys(cambios).join(', ')}`,
        cambios,
      });
    res.json({ config: await obtenerConfig() });
  }),
);

/* ───────────── Auditoría (solo admin) ───────────── */

const AuditoriaQuery = z.object({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
  usuarioId: z.string().max(60).optional(),
  accion: z.string().max(40).optional(),
  q: z.string().max(100).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  porPagina: z.coerce.number().int().min(1).optional(),
});

router.get(
  '/auditoria',
  soloAdmin,
  ah(async (req, res) => {
    const q = parsear(AuditoriaQuery, req.query);
    const filtro: Record<string, unknown> = {};
    if (q.desde || q.hasta)
      filtro.en = {
        ...(q.desde ? { $gte: inicioDiaBogota(q.desde) } : {}),
        ...(q.hasta ? { $lte: finDiaBogota(q.hasta) } : {}),
      };
    if (q.usuarioId) filtro.usuarioId = q.usuarioId;
    if (q.accion) filtro.accion = q.accion;
    if (q.q?.trim()) {
      const rx = new RegExp(escaparRegex(q.q.trim()), 'i');
      filtro.$or = [{ resumen: rx }, { usuarioNombre: rx }, { entidadId: rx }, { accion: rx }];
    }
    const { pagina, porPagina, saltar } = paginacion(q.pagina, q.porPagina, 50, 200);
    const [docs, total] = await Promise.all([
      Auditoria.find(filtro).sort({ en: -1, _id: -1 }).skip(saltar).limit(porPagina).lean(),
      Auditoria.countDocuments(filtro),
    ]);
    const items: EventoAuditoria[] = docs.map((a) => ({
      _id: String(a._id),
      en: new Date(a.en).toISOString(),
      usuarioId: a.usuarioId ?? null,
      usuarioNombre: a.usuarioNombre ?? '',
      rol: a.rol ?? null,
      accion: a.accion,
      entidad: a.entidad ?? null,
      entidadId: a.entidadId ?? null,
      resumen: a.resumen ?? '',
      cambios: (a.cambios as EventoAuditoria['cambios']) ?? null,
      ip: a.ip ?? null,
      dispositivo: a.dispositivo ?? null,
      geo: (a.geo as EventoAuditoria['geo']) ?? null,
    }));
    const body: AuditoriaResponse = { items, total, pagina, porPagina };
    res.json(body);
  }),
);

/* ───────────── Novedades (admin y supervisor) ───────────── */

const NovedadesQuery = z.object({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
  pdvId: z.string().max(60).optional(),
  tipo: z.string().max(60).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  porPagina: z.coerce.number().int().min(1).optional(),
});

router.get(
  '/novedades',
  permitir('admin', 'supervisor'),
  ah(async (req, res) => {
    const q = parsear(NovedadesQuery, req.query);
    const { desde, hasta } = rangoConsulta(q.desde, q.hasta, 30);
    const filtro: Record<string, unknown> = { fecha: { $gte: desde, $lte: hasta } };
    if (q.pdvId) filtro.pdvId = q.pdvId;
    const [regs, productos] = await Promise.all([
      Registro.find(filtro)
        .select('fecha turno turnoOrden pdvId pdvNombre impulsadoraNombre items')
        .sort({ fecha: -1, turnoOrden: -1, _id: 1 })
        .lean(),
      Producto.find().select('nombre').lean(),
    ]);
    const nombres = new Map(productos.map((p) => [String(p._id), p.nombre]));
    const filas: NovedadFila[] = [];
    for (const r of regs) {
      const items = (r.items ?? {}) as Record<string, Partial<Item>>;
      for (const cod of Object.keys(items).sort()) {
        const it = items[cod];
        const lotes = [
          ...(it.lotesIni ?? []).map((l) => ({ momento: 'llegada' as const, l })),
          ...(it.lotesFin ?? []).map((l) => ({ momento: 'cierre' as const, l })),
        ];
        for (const { momento, l } of lotes) {
          if (!l.novedad) continue;
          if (q.tipo && l.novedad.tipo !== q.tipo) continue;
          filas.push({
            registroId: String(r._id),
            fecha: r.fecha,
            turno: r.turno,
            pdvId: r.pdvId,
            pdvNombre: r.pdvNombre ?? '',
            impulsadoraNombre: r.impulsadoraNombre ?? '',
            cod,
            producto: nombres.get(cod) ?? cod,
            loteId: l.id,
            momento,
            cantidad: l.cantidad,
            vto: l.vto ?? null,
            tipo: l.novedad.tipo,
            nota: l.novedad.nota ?? '',
            fotos: l.novedad.fotos ?? [],
          });
        }
      }
    }
    const { pagina, porPagina, saltar } = paginacion(q.pagina, q.porPagina, 50, 200);
    const body: NovedadesResponse = {
      items: filas.slice(saltar, saltar + porPagina),
      total: filas.length,
      pagina,
      porPagina,
    };
    res.json(body);
  }),
);

/* ───────────── Backup Excel (solo admin) ───────────── */

router.get(
  '/backup.xlsx',
  soloAdmin,
  ah(async (req, res) => {
    const [registros, productos, pdvs, usuarios, config, auditoria] = await Promise.all([
      Registro.find().sort({ fecha: 1, turnoOrden: 1, _id: 1 }).lean(),
      listarProductos(),
      listarPdvs(),
      Usuario.find().select('-passwordHash -tokenVersion -intentosFallidos').sort({ nombre: 1 }).lean(),
      obtenerConfig(),
      Auditoria.find().sort({ en: -1 }).limit(100_000).lean(),
    ]);
    const hoy = hoyBogota();
    const datos: DatosBackup = {
      registros: registros as unknown as RegistroX[],
      productos,
      pdvs,
      usuarios: usuarios.map((u) => ({
        _id: String(u._id),
        nombre: u.nombre,
        usuario: u.usuario,
        rol: u.rol,
        ciudad: u.ciudad ?? '',
        pdvIds: u.pdvIds ?? [],
        activo: u.activo !== false,
        debeCambiarPassword: !!u.debeCambiarPassword,
        ultimoAcceso: u.ultimoAcceso ?? null,
        bloqueadoHasta: u.bloqueadoHasta ?? null,
        creadoEn: u.creadoEn ?? null,
      })),
      config,
      auditoria: auditoria.map((a) => ({
        en: a.en,
        usuarioId: a.usuarioId ?? null,
        usuarioNombre: a.usuarioNombre ?? '',
        rol: a.rol ?? null,
        accion: a.accion,
        entidad: a.entidad ?? null,
        entidadId: a.entidadId ?? null,
        resumen: a.resumen ?? '',
        cambios: a.cambios ?? null,
        ip: a.ip ?? null,
        dispositivo: a.dispositivo ?? null,
        geo: (a.geo as { lat: number; lng: number } | null) ?? null,
      })),
      hoy,
    };
    const buf = await libroBackup(datos);
    await auditar(req, {
      accion: 'BACKUP_EXCEL',
      entidad: null,
      entidadId: null,
      resumen: `Descargó el backup completo en Excel (${registros.length} registro(s))`,
    });
    res.setHeader('Content-Type', MIME_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="mercaimpulso_backup_${hoy}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }),
);

export default router;

/* ───────────── POST /pdvs/:id/ubicacion (admin) ───────────── */

export const pdvsRouter = Router();

pdvsRouter.post(
  '/:id/ubicacion',
  soloAdmin,
  validarBody(UbicacionSchema),
  ah(async (req, res) => {
    const { lat, lng } = req.body as z.infer<typeof UbicacionSchema>;
    const p = await Pdv.findById(req.params.id);
    if (!p) throw noEncontrado('El punto de venta no existe.');
    const antes = p.ubicacion ? { lat: p.ubicacion.lat, lng: p.ubicacion.lng } : null;
    p.set({ ubicacion: { lat, lng } });
    await p.save();
    await auditar(req, {
      accion: 'PDV_UBICACION_FIJADA',
      entidad: 'pdv',
      entidadId: String(p._id),
      resumen: `Fijó la ubicación del punto "${p.nombre}"`,
      cambios: { ubicacion: { antes, despues: { lat, lng } } },
      geo: { lat, lng },
    });
    const pdv = (await listarPdvs()).find((x) => x._id === String(p._id));
    res.json({ pdv });
  }),
);
