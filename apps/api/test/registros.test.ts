import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { Auditoria, Registro } from '../src/models/index.js';
import {
  UBICACION_P1,
  app,
  auth,
  diasAtras,
  geoEn,
  hoy,
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

beforeAll(async () => {
  await sembrarBasico();
  ana = (await login('ana')).token;
  bea = (await login('bea')).token;
  admin = (await login('admin')).token;
  sup = (await login('super')).token;
});

const put = (token: string, id: string, body: unknown) =>
  request(app).put(`/api/v1/registros/${encodeURIComponent(id)}`).set(auth(token)).send(body);

describe('PUT /registros/:id', () => {
  it('crea un registro y el servidor fija nombres, ciudad, geo, riesgos y mismoDia', async () => {
    const vtoCerca = diasAtras(-3); // vence en 3 días → emergencia
    const r = registroBase({
      pdvId: 'p1',
      items: {
        '33017': {
          lotesIni: [{ id: 'a', cantidad: 5, vto: vtoCerca }],
          rec: 2,
          ave: 0,
          agot: false,
          lotesFin: [{ id: 'a', cantidad: 3, vto: vtoCerca }],
        },
      },
    });
    const id = idDe(r, 'ana');
    const res = await put(ana, id, r);
    expect(res.status).toBe(200);
    expect(res.body.creado).toBe(true);
    const g = res.body.registro;
    expect(g._id).toBe(id);
    expect(g).toMatchObject({
      impulsadoraId: 'ana',
      impulsadoraNombre: 'Ana Impulsadora',
      pdvNombre: 'Mercacentro 4',
      ciudad: 'Ibagué',
      mismoDia: true,
      origen: 'online',
      creadoPor: 'ana',
    });
    expect(g.geo.distanciaPdvM).toBe(0);
    expect(g.geo.dentroDeRango).toBe(true);
    expect(g.riesgos).toEqual([{ cod: '33017', loteId: 'a', cantidad: 3, vto: vtoCerca, dias: 3, nivel: 'emergencia' }]);
    expect(g.turnoOrden).toBeUndefined();
    expect(await Auditoria.exists({ accion: 'REGISTRO_CREADO', entidadId: id })).toBeTruthy();
  });

  it('es idempotente: reenviar el mismo registro no duplica ni audita de nuevo', async () => {
    const r = registroBase({ pdvId: 'p1', turno: 'Tarde' });
    const id = idDe(r, 'ana');
    const a = await put(ana, id, r);
    const b = await put(ana, id, r);
    expect(a.body.creado).toBe(true);
    expect(b.status).toBe(200);
    expect(b.body.creado).toBe(false);
    expect(await Registro.countDocuments({ _id: id })).toBe(1);
    expect(await Auditoria.countDocuments({ entidadId: id, accion: { $in: ['REGISTRO_CREADO', 'REGISTRO_EDITADO'] } })).toBe(1);
  });

  it('editar genera REGISTRO_EDITADO con diff resumido (secciones y productos)', async () => {
    const r = registroBase({ pdvId: 'p1', turno: 'Completa', obs: 'inicio' });
    const id = idDe(r, 'ana');
    await put(ana, id, r);
    const r2 = {
      ...r,
      obs: 'cierre del día',
      items: { '33062': { lotesIni: [{ id: 'x', cantidad: 10, vto: diasAtras(-30) }], agot: false } },
    };
    const res = await put(ana, id, r2);
    expect(res.status).toBe(200);
    expect(res.body.creado).toBe(false);
    expect(res.body.registro.obs).toBe('cierre del día');
    const ev = await Auditoria.findOne({ accion: 'REGISTRO_EDITADO', entidadId: id }).lean();
    expect(ev).toBeTruthy();
    const cambios = ev!.cambios as Record<string, { antes: unknown; despues: unknown }>;
    expect(Object.keys(cambios).sort()).toEqual(['items.33062', 'obs']);
    expect(cambios.obs).toEqual({ antes: 'inicio', despues: 'cierre del día' });
    expect(cambios['items.33062'].antes).toBeNull();
    expect(cambios['items.33062'].despues).toMatchObject({ ini: 10, lotesIni: 1 });
    expect(ev!.resumen).toMatch(/Editó registro/);
    expect(await Registro.countDocuments({ _id: id })).toBe(1);
  });

  it('día laboral sin geo → 400 VALIDACION (path geo)', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(1), geo: null });
    const res = await put(ana, idDe(r, 'ana'), r);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION');
    expect(res.body.detalle.some((d: { path: string }) => d.path === 'geo')).toBe(true);
  });

  it('día no laboral sin geo se acepta', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(1), tipoDia: 'Descanso', geo: null });
    const res = await put(ana, idDe(r, 'ana'), r);
    expect(res.status).toBe(200);
    expect(res.body.registro.geo).toBeNull();
    expect(res.body.registro.mismoDia).toBe(false);
  });

  it('fuera de rango → se guarda con dentroDeRango:false y evento GPS_FUERA_DE_RANGO', async () => {
    const r = registroBase({
      pdvId: 'p1',
      fecha: diasAtras(2),
      geo: geoEn(UBICACION_P1.lat + 0.01, UBICACION_P1.lng), // ~1,1 km al norte
    });
    const id = idDe(r, 'ana');
    const res = await put(ana, id, r);
    expect(res.status).toBe(200);
    expect(res.body.registro.geo.dentroDeRango).toBe(false);
    expect(res.body.registro.geo.distanciaPdvM).toBeGreaterThan(1000);
    const ev = await Auditoria.findOne({ accion: 'GPS_FUERA_DE_RANGO', entidadId: id }).lean();
    expect(ev).toBeTruthy();
    expect(ev!.geo).toMatchObject({ lat: UBICACION_P1.lat + 0.01 });
  });

  it('punto sin ubicación → distancia y rango null', async () => {
    const r = registroBase({ pdvId: 'p2' });
    const res = await put(bea, idDe(r, 'bea'), r);
    expect(res.status).toBe(200);
    expect(res.body.registro.geo).toMatchObject({ distanciaPdvM: null, dentroDeRango: null });
  });

  it('el :id debe coincidir con registroId(fecha, impulsadora, punto, turno)', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(3) });
    const res = await put(ana, idDe(r, 'bea'), r);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION');
  });

  it('fecha anterior a hoy−3 → 403 FUERA_DE_PLAZO (impulsadora)', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(4) });
    const res = await put(ana, idDe(r, 'ana'), r);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('FUERA_DE_PLAZO');
  });

  it('fecha futura → 400', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(-1) });
    const res = await put(ana, idDe(r, 'ana'), r);
    expect(res.status).toBe(400);
  });

  it('punto inexistente o inactivo → 400', async () => {
    for (const pdvId of ['no-existe', 'p3']) {
      const r = registroBase({ pdvId });
      const res = await put(admin, idDe(r, 'admin'), r);
      expect(res.status).toBe(400);
      expect(res.body.detalle[0].path).toBe('pdvId');
    }
  });

  it('producto inexistente en items → 400', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(1), items: { '99999': { agot: true } } });
    const res = await put(ana, idDe(r, 'ana'), r);
    expect(res.status).toBe(400);
    expect(res.body.detalle[0].path).toBe('items.99999');
  });

  it('el admin puede registrar a nombre de otra persona y en fechas antiguas', async () => {
    const r = registroBase({ pdvId: 'p2', fecha: diasAtras(10), impulsadoraId: 'bea' });
    const id = idDe(r, 'bea');
    const res = await put(admin, id, r);
    expect(res.status).toBe(200);
    expect(res.body.registro).toMatchObject({ impulsadoraId: 'bea', impulsadoraNombre: 'Bea Impulsadora', creadoPor: 'admin' });
  });

  it('el supervisor no puede escribir', async () => {
    const r = registroBase({ pdvId: 'p1' });
    const res = await put(sup, idDe(r, 'super'), r);
    expect(res.status).toBe(403);
  });
});

describe('Aislamiento entre impulsadoras (criterio de aceptación)', () => {
  it('no puede escribir en un punto que no tiene asignado', async () => {
    const r = registroBase({ pdvId: 'p2' });
    const res = await put(ana, idDe(r, 'ana'), r);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });

  it('no puede escribir a nombre de otra: el impulsadoraId del body se ignora', async () => {
    const r = registroBase({ pdvId: 'p1', fecha: diasAtras(1), turno: 'Tarde', impulsadoraId: 'bea' });
    // intenta usar el id de Bea → no coincide con su propio id
    const res = await put(ana, idDe(r, 'bea'), r);
    expect(res.status).toBe(400);
    // con su id, queda a nombre de Ana
    const ok = await put(ana, idDe(r, 'ana'), r);
    expect(ok.status).toBe(200);
    expect(ok.body.registro.impulsadoraId).toBe('ana');
  });

  it('no puede sobrescribir un registro de otra persona', async () => {
    const rb = registroBase({ pdvId: 'p2', turno: 'Tarde' });
    const idBea = idDe(rb, 'bea');
    expect((await put(bea, idBea, rb)).status).toBe(200);
    const intento = await put(ana, idBea, { ...rb, obs: 'hackeado' });
    expect([400, 403]).toContain(intento.status);
    const doc = await Registro.findById(idBea).lean();
    expect(doc!.obs).toBe('');
  });

  it('no puede leer registros de otra: GET /registros solo devuelve los suyos y GET /:id ajeno → 403', async () => {
    const lista = await request(app).get('/api/v1/registros').query({ impulsadoraId: 'bea' }).set(auth(ana));
    expect(lista.status).toBe(200);
    expect(lista.body.items.length).toBeGreaterThan(0);
    expect(lista.body.items.every((x: { impulsadoraId: string }) => x.impulsadoraId === 'ana')).toBe(true);

    const ajeno = await Registro.findOne({ impulsadoraId: 'bea' }).lean();
    const r = await request(app).get(`/api/v1/registros/${encodeURIComponent(ajeno!._id)}`).set(auth(ana));
    expect(r.status).toBe(403);

    const propio = await Registro.findOne({ impulsadoraId: 'ana' }).lean();
    const r2 = await request(app).get(`/api/v1/registros/${encodeURIComponent(propio!._id)}`).set(auth(ana));
    expect(r2.status).toBe(200);
    expect(r2.body.registro._id).toBe(propio!._id);
  });

  it('ultimo-inventario de un punto no asignado → 403', async () => {
    const r = await request(app)
      .get('/api/v1/registros/ultimo-inventario')
      .query({ pdvId: 'p2', fecha: hoy(), turno: 'Tarde' })
      .set(auth(ana));
    expect(r.status).toBe(403);
  });

  it('supervisor y admin leen todo', async () => {
    const s = await request(app).get('/api/v1/registros').set(auth(sup));
    const ids = new Set(s.body.items.map((x: { impulsadoraId: string }) => x.impulsadoraId));
    expect(ids.has('ana') && ids.has('bea')).toBe(true);
    const f = await request(app).get('/api/v1/registros').query({ impulsadoraId: 'bea' }).set(auth(admin));
    expect(f.body.items.every((x: { impulsadoraId: string }) => x.impulsadoraId === 'bea')).toBe(true);
  });
});

describe('GET /registros (paginación y orden)', () => {
  it('ordena por fecha desc y turno desc, con porPagina máx 200', async () => {
    const r = await request(app).get('/api/v1/registros').query({ porPagina: 500 }).set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.body.porPagina).toBe(200);
    const items = r.body.items as { fecha: string; turno: string }[];
    const ord = { Mañana: 0, Tarde: 1, Completa: 2 } as Record<string, number>;
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1];
      const b = items[i];
      expect(a.fecha > b.fecha || (a.fecha === b.fecha && ord[a.turno] >= ord[b.turno])).toBe(true);
    }
    const p = await request(app).get('/api/v1/registros').query({ porPagina: 1, pagina: 2 }).set(auth(admin));
    expect(p.body.items.length).toBe(1);
    expect(p.body.pagina).toBe(2);
    expect(p.body.total).toBe(r.body.total);
  });
});

describe('POST /registros/sync', () => {
  it('procesa cada registro; uno inválido no frena los demás; origen offline-sync', async () => {
    const ok1 = registroBase({ pdvId: 'p1', fecha: diasAtras(3), turno: 'Mañana' });
    const malo = registroBase({ pdvId: 'p1', fecha: diasAtras(3), turno: 'Tarde', geo: null });
    const ajeno = registroBase({ pdvId: 'p2', fecha: diasAtras(3), turno: 'Tarde' });
    const ok2 = registroBase({ pdvId: 'p1', fecha: diasAtras(3), turno: 'Completa' });
    const res = await request(app)
      .post('/api/v1/registros/sync')
      .set(auth(ana))
      .send({ registros: [ok1, malo, ajeno, ok2] });
    expect(res.status).toBe(200);
    const rs = res.body.resultados as { id: string; ok: boolean; error?: string; registro?: { origen: string } }[];
    expect(rs.map((x) => x.ok)).toEqual([true, false, false, true]);
    expect(rs[0].id).toBe(idDe(ok1, 'ana'));
    expect(rs[0].registro!.origen).toBe('offline-sync');
    expect(rs[1].error).toMatch(/ubicación/);
    expect(rs[2].error).toMatch(/no está asignado/);
    expect(await Registro.exists({ _id: idDe(ok2, 'ana') })).toBeTruthy();
    expect(await Auditoria.exists({ accion: 'REGISTRO_SYNC_OFFLINE', usuarioId: 'ana' })).toBeTruthy();

    // reenviar el mismo lote no duplica
    const again = await request(app).post('/api/v1/registros/sync').set(auth(ana)).send({ registros: [ok1, ok2] });
    expect(again.body.resultados.every((x: { ok: boolean }) => x.ok)).toBe(true);
    expect(await Registro.countDocuments({ _id: { $in: [idDe(ok1, 'ana'), idDe(ok2, 'ana')] } })).toBe(2);
  });

  it('cuerpo vacío → 400', async () => {
    const res = await request(app).post('/api/v1/registros/sync').set(auth(ana)).send({ registros: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /registros/ultimo-inventario', () => {
  it('devuelve el registro Laboral anterior más reciente del punto (de cualquier persona) según orden de turnos', async () => {
    // Punto p2 (de Bea). Admin crea historial a nombre de Bea y de sí mismo.
    const d2 = diasAtras(2);
    const d1 = diasAtras(1);
    const mk = (fecha: string, turno: 'Mañana' | 'Tarde' | 'Completa', cant: number, tipoDia = 'Laboral', impulsadoraId = 'bea') =>
      registroBase({
        pdvId: 'p2',
        fecha,
        turno,
        tipoDia: tipoDia as 'Laboral',
        impulsadoraId,
        geo: tipoDia === 'Laboral' ? geoEn(4.6, -74.08) : null,
        items: {
          '33017': {
            lotesIni: [{ id: `i-${cant}`, cantidad: cant + 1, vto: diasAtras(-20) }],
            agot: false,
            lotesFin: [{ id: `f-${cant}`, cantidad: cant, vto: diasAtras(-20), novedad: { tipo: 'Vacío perdido', nota: '', fotos: [] } }],
          },
          '33062': { lotesIni: [{ id: `solo-ini-${cant}`, cantidad: 4, vto: null }], agot: false },
        },
      });
    for (const r of [
      mk(d2, 'Mañana', 1),
      mk(d2, 'Completa', 3, 'Laboral', 'admin'),
      mk(d2, 'Tarde', 2),
      mk(d1, 'Mañana', 9, 'Descanso'),
    ]) {
      const imp = r.impulsadoraId!;
      const res = await put(admin, idDe(r, imp), r);
      expect(res.status).toBe(200);
    }

    const q = (fecha: string, turno: string) =>
      request(app).get('/api/v1/registros/ultimo-inventario').query({ pdvId: 'p2', fecha, turno }).set(auth(bea));

    // Mañana de d1: el Descanso no cuenta → el último es Completa de d2 (del admin)
    const a = await q(d1, 'Tarde');
    expect(a.status).toBe(200);
    expect(a.body.previo.registroId).toBe(idDe({ fecha: d2, pdvId: 'p2', turno: 'Completa' }, 'admin'));
    expect(a.body.previo.lotes['33017']).toEqual([{ id: 'f-3', cantidad: 3, vto: diasAtras(-20) }]);
    // sin lotes de cierre → usa los iniciales
    expect(a.body.previo.lotes['33062'][0].cantidad).toBe(4);

    // Completa de d2 → el anterior es Tarde (Mañana < Tarde < Completa)
    const b = await q(d2, 'Completa');
    expect(b.body.previo.turno).toBe('Tarde');
    expect(b.body.previo.impulsadoraNombre).toBe('Bea Impulsadora');

    // Tarde de d2 → Mañana de d2
    const c = await q(d2, 'Tarde');
    expect(c.body.previo.turno).toBe('Mañana');

    // Mañana de d2 → el anterior es el que el admin creó hace 10 días
    const d = await q(d2, 'Mañana');
    expect(d.body.previo.fecha).toBe(diasAtras(10));

    // nada antes de hace 10 días
    const e = await q(diasAtras(10), 'Mañana');
    expect(e.body.previo).toBeNull();
  });

  it('parámetros faltantes → 400', async () => {
    const r = await request(app).get('/api/v1/registros/ultimo-inventario').query({ pdvId: 'p1' }).set(auth(ana));
    expect(r.status).toBe(400);
  });
});
