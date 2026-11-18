import type { RegistroInput } from '@merca/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encolar, guardarOEncolar, sincronizar, TAM_LOTE_SYNC } from '../cola';
import { db, type ResumenCola } from '../db';

const U = 'u1';
const RESUMEN: ResumenCola = { pdvNombre: 'Mercacentro 4', nProductos: 1, peorNivel: 'ok', fueraDeRango: false };

function registro(i = 0, extra: Partial<RegistroInput> = {}): RegistroInput {
  return {
    fecha: '2026-11-16',
    turno: 'Mañana',
    tipoDia: 'Laboral',
    pdvId: `punto-${i}`,
    items: { '33017': { agot: false, lotesIni: [{ id: `l${i}`, cantidad: 2.5, vto: '2026-12-01', novedad: null }] } },
    ejec: {},
    comp: {},
    impulso: {},
    nov: [],
    obs: '',
    fotosGondola: [],
    geo: { lat: 4.43, lng: -75.23, precisionM: 10, capturadoEn: '2026-11-16T13:00:00.000Z' },
    ...extra,
  };
}
const idDe = (r: RegistroInput) => `${r.fecha}_${U}_${r.pdvId}_${r.turno}`;

/** Respuesta mínima compatible con lo que usa `api()` */
const resp = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  await Promise.all([db.cola.clear(), db.borradores.clear(), db.fotosPendientes.clear()]);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const cuerpo = (n: number) => JSON.parse(fetchMock.mock.calls[n][1].body as string);

describe('cola offline', () => {
  it('encola y sincroniza con POST /registros/sync', async () => {
    const r = registro();
    await encolar(idDe(r), U, r, RESUMEN);
    expect(await db.cola.count()).toBe(1);

    fetchMock.mockResolvedValueOnce(resp({ resultados: [{ id: idDe(r), ok: true }] }));
    const res = await sincronizar(U);

    expect(res).toEqual({ enviados: 1, errores: 0, sinRed: false });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/registros\/sync$/);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(cuerpo(0).registros).toHaveLength(1);
    expect(cuerpo(0).registros[0].pdvId).toBe('punto-0');
    expect(await db.cola.count()).toBe(0);
  });

  it('sin señal: el registro sigue pendiente y suma un intento', async () => {
    const r = registro();
    await encolar(idDe(r), U, r, RESUMEN);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await sincronizar(U);
    expect(res.sinRed).toBe(true);
    const enCola = await db.cola.get(idDe(r));
    expect(enCola).toMatchObject({ estado: 'pendiente', intentos: 1 });
    expect(enCola?.ultimoError).toMatch(/conexión/);
  });

  it('error de validación del servidor: queda visible para corregir y no se reintenta solo', async () => {
    const r = registro();
    await encolar(idDe(r), U, r, RESUMEN);
    fetchMock.mockResolvedValueOnce(
      resp({ resultados: [{ id: idDe(r), ok: false, error: 'Solo se puede editar hasta 3 días atrás' }] }),
    );
    const res = await sincronizar(U);
    expect(res.errores).toBe(1);
    expect(await db.cola.get(idDe(r))).toMatchObject({
      estado: 'error',
      errorDeDatos: true,
      ultimoError: 'Solo se puede editar hasta 3 días atrás',
    });

    await sincronizar(U);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(resp({ resultados: [{ id: idDe(r), ok: true }] }));
    await sincronizar(U, { incluirErrores: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await db.cola.count()).toBe(0);
  });

  it('valida en el celular antes de enviar', async () => {
    const r = registro(0, { geo: null });
    await encolar(idDe(r), U, r, RESUMEN);
    const res = await sincronizar(U);
    expect(res.errores).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await db.cola.get(idDe(r)))?.ultimoError).toMatch(/ubicación es obligatoria/);
  });

  it(`envía en lotes de hasta ${TAM_LOTE_SYNC}`, async () => {
    const regs = Array.from({ length: 60 }, (_, i) => registro(i));
    for (const r of regs) await encolar(idDe(r), U, r, RESUMEN);
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const { registros } = JSON.parse(init.body as string) as { registros: RegistroInput[] };
      return resp({ resultados: registros.map((x) => ({ id: idDe(x), ok: true })) });
    });
    const res = await sincronizar(U);
    expect(res.enviados).toBe(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cuerpo(0).registros).toHaveLength(50);
    expect(cuerpo(1).registros).toHaveLength(10);
  });

  it('si el lote completo es rechazado (400), envía uno por uno para aislar el error', async () => {
    const a = registro(1);
    const b = registro(2);
    await encolar(idDe(a), U, a, RESUMEN);
    await encolar(idDe(b), U, b, RESUMEN);
    fetchMock
      .mockResolvedValueOnce(resp({ error: 'Datos inválidos', codigo: 'VALIDACION' }, 400))
      .mockResolvedValueOnce(resp({ registro: {}, creado: true }))
      .mockResolvedValueOnce(resp({ error: 'Punto no asignado', codigo: 'SIN_PERMISO' }, 403));
    const res = await sincronizar(U);
    expect(res).toMatchObject({ enviados: 1, errores: 1 });
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(await db.cola.get(idDe(a))).toBeUndefined();
    expect(await db.cola.get(idDe(b))).toMatchObject({ estado: 'error', ultimoError: 'Punto no asignado' });
  });

  it('solo sincroniza los registros del usuario actual', async () => {
    const r = registro();
    await encolar(idDe(r), 'otra', r, RESUMEN);
    const res = await sincronizar(U);
    expect(res.enviados).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('guardarOEncolar', () => {
  it('con señal: PUT /registros/:id y borra el borrador', async () => {
    const r = registro();
    const id = idDe(r);
    await db.borradores.put({ clave: id, usuarioId: U, form: {} as never, meta: {} as never, actualizadoEn: 1 });
    fetchMock.mockResolvedValueOnce(resp({ registro: { _id: id }, creado: true }));
    const res = await guardarOEncolar(id, U, r, RESUMEN);
    expect(res.tipo).toBe('enviado');
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/registros/${encodeURIComponent(id)}`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(await db.borradores.count()).toBe(0);
  });

  it('sin señal: queda en la cola del celular', async () => {
    const r = registro();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await guardarOEncolar(idDe(r), U, r, RESUMEN);
    expect(res.tipo).toBe('encolado');
    expect(await db.cola.get(idDe(r))).toMatchObject({ estado: 'pendiente', usuarioId: U, resumen: RESUMEN });
  });

  it('servidor dormido (503): también se encola', async () => {
    const r = registro();
    fetchMock.mockResolvedValue(resp({ error: 'Servicio no disponible' }, 503));
    const res = await guardarOEncolar(idDe(r), U, r, RESUMEN);
    expect(res.tipo).toBe('encolado');
  });

  it('error de datos: se lanza para mostrarlo (no se encola)', async () => {
    const r = registro();
    fetchMock.mockResolvedValue(resp({ error: 'Fuera de plazo', codigo: 'FUERA_DE_PLAZO' }, 422));
    await expect(guardarOEncolar(idDe(r), U, r, RESUMEN)).rejects.toThrow('Fuera de plazo');
    expect(await db.cola.count()).toBe(0);
  });
});
