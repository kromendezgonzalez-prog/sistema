import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { Auditoria, Usuario } from '../src/models/index.js';
import {
  PASS,
  app,
  auth,
  diasAtras,
  idDe,
  login,
  registroBase,
  sembrarBasico,
  usarBaseDePruebas,
} from './helpers.js';

usarBaseDePruebas();

let ana: string;
let bea: string;
let admin: string;
let sup: string;

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** supertest: recibe el cuerpo binario como Buffer */
const binario = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on('data', (c: Buffer) => partes.push(c));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

async function leerLibro(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

beforeAll(async () => {
  await sembrarBasico();
  ana = (await login('ana')).token;
  bea = (await login('bea')).token;
  admin = (await login('admin')).token;
  sup = (await login('super')).token;

  // Datos: Ana con 2 lotes y una novedad con foto; Bea con un registro simple
  const vto = diasAtras(-6);
  const ra = registroBase({
    pdvId: 'p1',
    fecha: diasAtras(1),
    items: {
      '33017': {
        lotesIni: [
          { id: 'l1', cantidad: 4, vto },
          { id: 'l2', cantidad: 2, vto: diasAtras(-30) },
        ],
        rec: 1,
        ave: 0.5,
        agot: false,
        lotesFin: [
          {
            id: 'l1',
            cantidad: 1.5,
            vto,
            novedad: {
              tipo: 'Empaque abierto / roto',
              nota: 'Bandeja rota en góndola',
              fotos: [{ publicId: 'mercaimpulso/x/ana/f1', url: 'https://res.cloudinary.com/demo/image/upload/f1.jpg' }],
            },
          },
        ],
      },
    },
    ejec: { exhib: 'Sí', frentesL: 4, frentesC: 6, precioOk: 'Sí', temp: 3 },
    impulso: { abordados: 10, degust: 5, compras: 3 },
    nov: ['Precio errado'],
    obs: 'Todo en orden, señora pidió más tocineta',
  });
  expect((await request(app).put(`/api/v1/registros/${encodeURIComponent(idDe(ra, 'ana'))}`).set(auth(ana)).send(ra)).status).toBe(200);
  const rb = registroBase({ pdvId: 'p2', fecha: diasAtras(1), items: { '33062': { lotesIni: [{ id: 'z', cantidad: 6, vto: null }], agot: true } } });
  expect((await request(app).put(`/api/v1/registros/${encodeURIComponent(idDe(rb, 'bea'))}`).set(auth(bea)).send(rb)).status).toBe(200);
});

describe('GET /tablero', () => {
  it('la impulsadora queda forzada a sí misma aunque pida a otra', async () => {
    const r = await request(app)
      .get('/api/v1/tablero')
      .query({ impulsadoraId: 'bea', desde: diasAtras(6), hasta: diasAtras(0) })
      .set(auth(ana));
    expect(r.status).toBe(200);
    expect(r.body.filtros.impulsadoraId).toBe('ana');
    expect(r.body.resumen.registros).toBe(1);
    expect(r.body.porImpulsadora.map((x: { id: string }) => x.id)).toEqual(['ana']);
    expect(r.body.cumplimiento.map((x: { impulsadoraId: string }) => x.impulsadoraId)).toEqual(['ana']);
    expect(r.body.checkins.length).toBe(1);
    expect(r.body.checkins[0]).toMatchObject({ pdvNombre: 'Mercacentro 4', dentroDeRango: true });
    // venta = 6 + 1 − 1.5 − 0.5 = 5 kg
    expect(r.body.resumen.ventaKg).toBeCloseTo(5);
    expect(r.body.riesgo.porNivel.critico.lotes).toBe(1);
  });

  it('admin y supervisor ven todo el equipo y pueden filtrar', async () => {
    const r = await request(app).get('/api/v1/tablero').set(auth(sup));
    expect(r.status).toBe(200);
    expect(r.body.resumen.registros).toBe(2);
    expect(r.body.cumplimiento.length).toBe(2);
    const f = await request(app).get('/api/v1/tablero').query({ pdvId: 'p2' }).set(auth(admin));
    expect(f.body.resumen.registros).toBe(1);
    expect(f.body.filtros.pdvId).toBe('p2');
  });

  it('rango inválido → 400', async () => {
    const r = await request(app).get('/api/v1/tablero').query({ desde: '2026-02-30' }).set(auth(admin));
    expect(r.status).toBe(400);
  });
});

describe('Auditoría', () => {
  it('solo admin: supervisor e impulsadora → 403', async () => {
    expect((await request(app).get('/api/v1/admin/auditoria').set(auth(sup))).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/auditoria').set(auth(ana))).status).toBe(403);
  });

  it('admin: paginada, orden desc y filtros', async () => {
    const r = await request(app).get('/api/v1/admin/auditoria').query({ porPagina: 5 }).set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBe(5);
    expect(r.body.total).toBeGreaterThan(5);
    const ens = r.body.items.map((x: { en: string }) => x.en);
    expect([...ens].sort().reverse()).toEqual(ens);

    const f = await request(app).get('/api/v1/admin/auditoria').query({ accion: 'REGISTRO_CREADO', usuarioId: 'ana' }).set(auth(admin));
    expect(f.body.items.length).toBe(1);
    expect(f.body.items[0].accion).toBe('REGISTRO_CREADO');

    const q = await request(app).get('/api/v1/admin/auditoria').query({ q: 'mercacentro' }).set(auth(admin));
    expect(q.body.items.length).toBeGreaterThan(0);

    const d = await request(app).get('/api/v1/admin/auditoria').query({ desde: diasAtras(0), hasta: diasAtras(0) }).set(auth(admin));
    expect(d.body.total).toBe(r.body.total); // todo ocurrió hoy
    const manana = await request(app).get('/api/v1/admin/auditoria').query({ desde: diasAtras(-1) }).set(auth(admin));
    expect(manana.body.total).toBe(0);
  });
});

describe('Usuarios (admin)', () => {
  it('crear usuario devuelve contraseña temporal una sola vez y obliga a cambiarla', async () => {
    const r = await request(app)
      .post('/api/v1/admin/usuarios')
      .set(auth(admin))
      .send({ nombre: 'Carla Nueva', usuario: 'carla', rol: 'impulsadora', pdvIds: ['p1'] });
    expect(r.status).toBe(201);
    expect(r.body.passwordTemporal).toMatch(/^Lomus-[a-km-np-z2-9]{4}$/);
    expect(r.body.usuario).toMatchObject({ _id: 'carla', debeCambiarPassword: true, rol: 'impulsadora' });
    const s = await login('carla', r.body.passwordTemporal);
    expect(s.body.usuario.debeCambiarPassword).toBe(true);
    const dup = await request(app)
      .post('/api/v1/admin/usuarios')
      .set(auth(admin))
      .send({ nombre: 'Otra', usuario: 'carla', rol: 'impulsadora' });
    expect(dup.status).toBe(409);
    const malPdv = await request(app)
      .post('/api/v1/admin/usuarios')
      .set(auth(admin))
      .send({ nombre: 'Otra', usuario: 'otra', rol: 'impulsadora', pdvIds: ['nope'] });
    expect(malPdv.status).toBe(400);
    expect((await request(app).get('/api/v1/admin/usuarios').set(auth(sup))).status).toBe(403);
  });

  it('listar usuarios nunca expone el hash', async () => {
    const r = await request(app).get('/api/v1/admin/usuarios').set(auth(admin));
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('reset-password devuelve temporal, desbloquea, obliga a cambiarla e invalida sesiones', async () => {
    const s = await login('bea');
    await Usuario.updateOne({ _id: 'bea' }, { bloqueadoHasta: new Date(Date.now() + 10 * 60_000), intentosFallidos: 3 });
    const bloqueada = await request(app).post('/api/v1/auth/login').send({ usuario: 'bea', password: PASS });
    expect(bloqueada.status).toBe(423);

    const r = await request(app).post('/api/v1/admin/usuarios/bea/reset-password').set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.body.passwordTemporal).toMatch(/^Lomus-/);
    expect(r.body.usuario.debeCambiarPassword).toBe(true);
    expect(r.body.usuario.bloqueadoHasta).toBeNull();
    const u = await Usuario.findById('bea').lean();
    expect(u!.intentosFallidos).toBe(0);

    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', s.cookie)).status).toBe(401);
    const s2 = await login('bea', r.body.passwordTemporal);
    expect(s2.body.usuario.debeCambiarPassword).toBe(true);
    expect(await Auditoria.exists({ accion: 'PASSWORD_RESETEADA', entidadId: 'bea' })).toBeTruthy();
    // la vieja ya no sirve
    expect((await request(app).post('/api/v1/auth/login').send({ usuario: 'bea', password: PASS })).status).toBe(401);
  });

  it('editar usuario audita con diff; no puede desactivarse ni quitarse el rol admin a sí misma', async () => {
    const r = await request(app).patch('/api/v1/admin/usuarios/carla').set(auth(admin)).send({ pdvIds: ['p1', 'p2'], ciudad: 'Ibagué' });
    expect(r.status).toBe(200);
    expect(r.body.usuario.pdvIds).toEqual(['p1', 'p2']);
    const ev = await Auditoria.findOne({ accion: 'USUARIO_EDITADO', entidadId: 'carla' }).lean();
    expect(ev!.cambios).toMatchObject({ pdvIds: { antes: ['p1'], despues: ['p1', 'p2'] }, ciudad: { antes: '', despues: 'Ibagué' } });

    expect((await request(app).patch('/api/v1/admin/usuarios/admin').set(auth(admin)).send({ activo: false })).status).toBe(400);
    expect((await request(app).patch('/api/v1/admin/usuarios/admin').set(auth(admin)).send({ rol: 'supervisor' })).status).toBe(400);

    // desactivar a alguien invalida su sesión
    const s = await login('super');
    expect((await request(app).patch('/api/v1/admin/usuarios/super').set(auth(admin)).send({ activo: false })).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(auth(s.token))).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', s.cookie)).status).toBe(401);
    await request(app).patch('/api/v1/admin/usuarios/super').set(auth(admin)).send({ activo: true });
    sup = (await login('super')).token;
  });
});

describe('Puntos, productos y config (admin)', () => {
  it('CRUD de puntos de venta y fijar ubicación', async () => {
    const c = await request(app)
      .post('/api/v1/admin/pdvs')
      .set(auth(admin))
      .send({ _id: 'nuevo-punto', nombre: 'Nuevo Punto', ciudad: 'Neiva' });
    expect(c.status).toBe(201);
    expect(c.body.pdv).toMatchObject({ _id: 'nuevo-punto', radioM: 300, ubicacion: null, activo: true });
    expect((await request(app).post('/api/v1/admin/pdvs').set(auth(admin)).send({ _id: 'nuevo-punto', nombre: 'X' })).status).toBe(409);
    expect((await request(app).post('/api/v1/admin/pdvs').set(auth(admin)).send({ _id: 'Mal Id', nombre: 'X' })).status).toBe(400);

    const p = await request(app).patch('/api/v1/admin/pdvs/nuevo-punto').set(auth(admin)).send({ portafolio: ['33017'], radioM: 500 });
    expect(p.status).toBe(200);
    expect(p.body.pdv).toMatchObject({ portafolio: ['33017'], radioM: 500, nombre: 'Nuevo Punto' });
    expect((await request(app).patch('/api/v1/admin/pdvs/nuevo-punto').set(auth(admin)).send({ portafolio: ['00000'] })).status).toBe(400);

    const u = await request(app).post('/api/v1/pdvs/nuevo-punto/ubicacion').set(auth(admin)).send({ lat: 2.93, lng: -75.28 });
    expect(u.status).toBe(200);
    expect(u.body.pdv.ubicacion).toEqual({ lat: 2.93, lng: -75.28 });
    expect(await Auditoria.exists({ accion: 'PDV_UBICACION_FIJADA', entidadId: 'nuevo-punto' })).toBeTruthy();
    expect((await request(app).post('/api/v1/pdvs/nuevo-punto/ubicacion').set(auth(ana)).send({ lat: 1, lng: 1 })).status).toBe(403);

    const l = await request(app).get('/api/v1/admin/pdvs').set(auth(admin));
    expect(l.body.items.length).toBe(4);
  });

  it('CRUD de productos', async () => {
    const c = await request(app)
      .post('/api/v1/admin/productos')
      .set(auth(admin))
      .send({ _id: '33999', nombre: 'PRODUCTO DE PRUEBA', unidad: 'und', pesoKg: 0.25 });
    expect(c.status).toBe(201);
    const p = await request(app).patch('/api/v1/admin/productos/33999').set(auth(admin)).send({ activo: false });
    expect(p.body.producto).toMatchObject({ _id: '33999', activo: false, pesoKg: 0.25 });
    expect(await Auditoria.exists({ accion: 'PRODUCTO_EDITADO', entidadId: '33999' })).toBeTruthy();
  });

  it('PUT /admin/config valida umbrales y audita con diff', async () => {
    const actual = (await request(app).get('/api/v1/config').set(auth(admin))).body.config;
    const malo = await request(app)
      .put('/api/v1/admin/config')
      .set(auth(admin))
      .send({ ...actual, riesgoVto: { medio: 5, critico: 7, emergencia: 3 } });
    expect(malo.status).toBe(400);
    const r = await request(app)
      .put('/api/v1/admin/config')
      .set(auth(admin))
      .send({ ...actual, metas: { ...actual.metas, doh: 5 } });
    expect(r.status).toBe(200);
    expect(r.body.config.metas.doh).toBe(5);
    const ev = await Auditoria.findOne({ accion: 'CONFIG_CAMBIADA' }).lean();
    expect(Object.keys(ev!.cambios as object)).toEqual(['metas']);
  });
});

describe('Novedades', () => {
  it('aplana lotes con novedad (cierre/llegada); admin y supervisor sí, impulsadora no', async () => {
    const r = await request(app).get('/api/v1/admin/novedades').set(auth(sup));
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(1);
    expect(r.body.items[0]).toMatchObject({
      momento: 'cierre',
      cod: '33017',
      producto: 'PUNTA DE ANCA DE CERDO',
      loteId: 'l1',
      tipo: 'Empaque abierto / roto',
      pdvNombre: 'Mercacentro 4',
    });
    expect(r.body.items[0].fotos[0].url).toMatch(/cloudinary/);
    const f = await request(app).get('/api/v1/admin/novedades').query({ tipo: 'Otro' }).set(auth(admin));
    expect(f.body.total).toBe(0);
    expect((await request(app).get('/api/v1/admin/novedades').set(auth(ana))).status).toBe(403);
  });
});

describe('Fotos', () => {
  it('POST /fotos/firma devuelve firma de Cloudinary con carpeta por fecha y usuario', async () => {
    const r = await request(app).post('/api/v1/fotos/firma').set(auth(ana)).send({ contexto: 'novedad' });
    expect(r.status).toBe(200);
    expect(r.body.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-nube/image/upload');
    expect(r.body.folder).toMatch(/^mercaimpulso\/\d{4}-\d{2}-\d{2}\/ana$/);
    expect(r.body.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(r.body.apiKey).toBe('123456789012345');
    expect(await Auditoria.exists({ accion: 'FOTO_SUBIDA', usuarioId: 'ana' })).toBeTruthy();
    expect((await request(app).post('/api/v1/fotos/firma').set(auth(ana)).send({ contexto: 'selfie' })).status).toBe(400);
  });
});

describe('Excel', () => {
  it('GET /export (admin/supervisor) → hoja Detalle con una fila por lote, tildes y encabezados', async () => {
    expect((await request(app).get('/api/v1/export').set(auth(ana))).status).toBe(403);
    const r = await request(app)
      .get('/api/v1/export')
      .query({ desde: diasAtras(7), hasta: diasAtras(0) })
      .set(auth(sup))
      .buffer(true)
      .parse(binario);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain(MIME_XLSX);
    expect(r.headers['content-disposition']).toMatch(/attachment; filename="mercaimpulso_/);
    const wb = await leerLibro(r.body as Buffer);
    const ws = wb.getWorksheet('Detalle')!;
    expect(ws).toBeTruthy();
    const enc = (ws.getRow(1).values as unknown[]).slice(1);
    expect(enc[0]).toBe('fecha');
    expect(enc).toContain('cantidad_kg_eq');
    expect(enc[enc.length - 1]).toBe('actualizado');
    expect(ws.getRow(1).font?.bold).toBe(true);
    // Ana: 2 lotes llegada + 1 cierre = 3 filas; Bea: 1 lote = 1 fila
    expect(ws.rowCount).toBe(1 + 4);
    const col = (k: string) => enc.indexOf(k) + 1;
    const filasAna = [2, 3, 4, 5].map((i) => ws.getRow(i)).filter((row) => row.getCell(col('mercaimpulsadora')).value === 'Ana Impulsadora');
    expect(filasAna.length).toBe(3);
    expect(filasAna.map((row) => row.getCell(col('momento')).value)).toEqual(['llegada', 'llegada', 'cierre']);
    expect(filasAna[0].getCell(col('venta')).value).toBe(5);
    expect(filasAna[1].getCell(col('venta')).value).toBeNull();
    expect(filasAna[2].getCell(col('novedad_tipo')).value).toBe('Empaque abierto / roto');
    expect(filasAna[0].getCell(col('observaciones')).value).toBe('Todo en orden, señora pidió más tocineta');
    expect(await Auditoria.exists({ accion: 'EXPORT_EXCEL' })).toBeTruthy();
  });

  it('GET /admin/backup.xlsx → content-type de Excel con todas las hojas y sin contraseñas', async () => {
    expect((await request(app).get('/api/v1/admin/backup.xlsx').set(auth(sup))).status).toBe(403);
    const r = await request(app).get('/api/v1/admin/backup.xlsx').set(auth(admin)).buffer(true).parse(binario);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain(MIME_XLSX);
    const wb = await leerLibro(r.body as Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Registros',
      'Detalle productos',
      'Lotes',
      'Novedades',
      'Usuarios',
      'Puntos de venta',
      'Productos',
      'Configuración',
      'Auditoría',
    ]);
    const usuarios = wb.getWorksheet('Usuarios')!;
    const texto: string[] = [];
    usuarios.eachRow((row) => texto.push(JSON.stringify(row.values)));
    expect(texto.join()).not.toMatch(/\$2[aby]\$|passwordHash/);
    expect(wb.getWorksheet('Novedades')!.rowCount).toBe(2);
    expect(wb.getWorksheet('Lotes')!.rowCount).toBe(1 + 4);
    expect(await Auditoria.exists({ accion: 'BACKUP_EXCEL' })).toBeTruthy();
  });
});
