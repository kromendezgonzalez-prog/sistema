import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/offline/db';
import { cargarContexto } from '../registro/cargar';
import { aplicarPrecarga, construirInput, estadoCierre, formNuevo, metaVacia } from '../registro/modelo';

const resp = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const PREVIO = {
  registroId: 'x',
  fecha: '2026-11-15',
  turno: 'Tarde',
  impulsadoraNombre: 'Ana',
  lotes: {
    '33017': [
      { id: 'v1', cantidad: 1.2, vto: '2026-11-20', novedad: { tipo: 'Golpe / daño', nota: '', fotos: [] } },
      { id: 'v2', cantidad: 0, vto: '2026-11-21' },
    ],
    '99999': [{ id: 'v3', cantidad: 3, vto: '2026-11-30' }],
  },
};

describe('modelo del registro', () => {
  it('precarga los lotes de llegada del último cierre (ids nuevos, sin novedades, sin cantidades en 0)', () => {
    const f = formNuevo({ fecha: '2026-11-16', turno: 'Mañana', pdvId: 'p' });
    const { form, precargados } = aplicarPrecarga(f, PREVIO, (c) => c === '33017');
    expect(precargados).toEqual(['33017']);
    const ls = form.items['33017'].lotesIni!;
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ cantidad: 1.2, vto: '2026-11-20', novedad: null });
    expect(ls[0].id).not.toBe('v1');
    expect(form.items['99999']).toBeUndefined();
  });

  it('no pisa lotes de llegada ya digitados', () => {
    const f = formNuevo({ fecha: '2026-11-16', turno: 'Mañana', pdvId: 'p' });
    f.items['33017'] = { agot: false, lotesIni: [] };
    const { precargados, form } = aplicarPrecarga(f, PREVIO, () => true);
    expect(precargados).toEqual(['99999']);
    expect(form.items['33017'].lotesIni).toEqual([]);
  });

  it('construirInput omite productos sin datos', () => {
    const f = formNuevo({ fecha: '2026-11-16', turno: 'Mañana', pdvId: 'p' });
    f.items = { a: { agot: false }, b: { agot: false, rec: 2 }, c: { agot: true } };
    expect(Object.keys(construirInput(f).items)).toEqual(['b', 'c']);
  });

  it('estadoCierre detecta cuando falta el cierre', () => {
    expect(estadoCierre({ tipoDia: 'Laboral', items: { a: { lotesIni: [] } } })).toBe('falta-cierre');
    expect(estadoCierre({ tipoDia: 'Laboral', items: { a: { lotesIni: [], lotesFin: [] } } })).toBe('completo');
    expect(estadoCierre({ tipoDia: 'Festivo', items: {} })).toBe('no-laboral');
  });
});

describe('cargarContexto', () => {
  const base = { fecha: '2026-11-16', turno: 'Mañana' as const, pdvId: 'p1', tipoDia: 'Laboral' as const, geo: null };
  const id = '2026-11-16_u1_p1_Mañana';
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    await Promise.all([db.cola.clear(), db.borradores.clear()]);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('1º el borrador del celular', async () => {
    const form = { ...formNuevo(base), obs: 'borrador' };
    await db.borradores.put({ clave: id, usuarioId: 'u1', form, meta: metaVacia(), actualizadoEn: 1 });
    const r = await cargarContexto({ usuarioId: 'u1', base, existeProducto: () => true });
    expect(r.origen).toBe('borrador');
    expect(r.form.obs).toBe('borrador');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2º el registro existente en el servidor (modo edición)', async () => {
    fetchMock.mockResolvedValueOnce(
      resp({ registro: { ...formNuevo(base), _id: id, obs: 'del servidor', geo: { lat: 1, lng: 2, precisionM: 3, capturadoEn: 'x', distanciaPdvM: 5, dentroDeRango: true } } }),
    );
    const r = await cargarContexto({ usuarioId: 'u1', base, existeProducto: () => true });
    expect(r.origen).toBe('servidor');
    expect(r.meta.existente).toBe(true);
    expect(r.form.geo).toEqual({ lat: 1, lng: 2, precisionM: 3, capturadoEn: 'x' });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/registros/${encodeURIComponent(id)}`);
  });

  it('3º si no existe, precarga el último inventario', async () => {
    fetchMock
      .mockResolvedValueOnce(resp({ error: 'No encontrado', codigo: 'NO_ENCONTRADO' }, 404))
      .mockResolvedValueOnce(resp({ previo: PREVIO }));
    const r = await cargarContexto({ usuarioId: 'u1', base, existeProducto: (c) => c === '33017' });
    expect(r.origen).toBe('precarga');
    expect(r.meta.precarga).toEqual({ fecha: '2026-11-15', turno: 'Tarde', impulsadoraNombre: 'Ana' });
    expect(r.meta.sinConfirmar).toEqual(['33017']);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/ultimo-inventario\?pdvId=p1&fecha=2026-11-16&turno=Ma%C3%B1ana/);
  });

  it('sin señal: formulario nuevo marcado como sin-red', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await cargarContexto({ usuarioId: 'u1', base, existeProducto: () => true });
    expect(r.origen).toBe('sin-red');
    expect(r.form.items).toEqual({});
  });
});
