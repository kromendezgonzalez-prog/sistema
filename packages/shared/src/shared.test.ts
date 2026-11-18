import { describe, expect, it } from 'vitest';
import {
  alertasItem,
  calcularTablero,
  diffDias,
  distanciaM,
  evaluarGeo,
  hoyBogota,
  kgEq,
  METAS_DEF,
  nivelPorDias,
  peorNivel,
  RegistroInputSchema,
  RIESGO_DEF,
  riesgosRegistro,
  semaforo,
  sumaLotes,
  ventaOf,
  type RegistroCalc,
} from './index.js';

const L = (id: string, cantidad: number, vto: string | null = '2026-12-31') => ({ id, cantidad, vto });

describe('fechas', () => {
  it('hoy en Bogotá (UTC-5)', () => {
    // 2026-11-17 03:00 UTC = 2026-11-16 22:00 Bogotá
    expect(hoyBogota(new Date('2026-11-17T03:00:00Z'))).toBe('2026-11-16');
  });
  it('diffDias', () => {
    expect(diffDias('2026-11-20', '2026-11-16')).toBe(4);
    expect(diffDias('2026-03-01', '2026-02-28')).toBe(1);
  });
});

describe('niveles de riesgo', () => {
  it.each([
    [-1, 'vencido'],
    [0, 'emergencia'],
    [5, 'emergencia'],
    [6, 'critico'],
    [7, 'critico'],
    [8, 'medio'],
    [10, 'medio'],
    [11, 'ok'],
  ])('%i días → %s', (d, n) => expect(nivelPorDias(d, RIESGO_DEF)).toBe(n));
  it('peor nivel', () => {
    expect(peorNivel(['ok', 'medio', 'critico'])).toBe('critico');
    expect(peorNivel([])).toBe('ok');
  });
});

describe('lotes y venta', () => {
  it('suma lotes; undefined = null, [] = 0', () => {
    expect(sumaLotes(undefined)).toBeNull();
    expect(sumaLotes([])).toBe(0);
    expect(sumaLotes([L('a', 1.2), L('b', 0.9)])).toBe(2.1);
  });
  it('venta = ini + rec − fin − ave', () => {
    expect(ventaOf({ lotesIni: [L('a', 5)], rec: 3, lotesFin: [L('b', 4)], ave: 1 })).toBe(3);
  });
  it('venta null si turno no cerrado', () => {
    expect(ventaOf({ lotesIni: [L('a', 5)] })).toBeNull();
  });
  it('kgEq: und sin peso → null', () => {
    expect(kgEq({ unidad: 'kg', pesoKg: null }, 2)).toBe(2);
    expect(kgEq({ unidad: 'und', pesoKg: 0.5 }, 3)).toBe(1.5);
    expect(kgEq({ unidad: 'und', pesoKg: null }, 3)).toBeNull();
  });
  it('alertas: venta negativa, vencido, lejano, sin fecha', () => {
    const a = alertasItem(
      {
        lotesIni: [L('a', 1, '2026-11-10')],
        lotesFin: [L('b', 5, '2027-06-01'), L('c', 1, null)],
      },
      '2026-11-16',
    );
    expect(a.map((x) => x.tipo).sort()).toEqual(
      ['lote-sin-fecha', 'venta-negativa', 'vto-lejano', 'vto-pasado'].sort(),
    );
  });
  it('riesgos usa lotes finales si existen', () => {
    const r = riesgosRegistro(
      { '33017': { lotesIni: [L('a', 1, '2026-11-17')], lotesFin: [L('b', 1, '2026-11-24')] } },
      '2026-11-16',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ loteId: 'b', dias: 8, nivel: 'medio' });
  });
});

describe('geo', () => {
  it('distancia aproximada', () => {
    // ~111 m por 0.001° de latitud
    expect(distanciaM(4.0, -75.0, 4.001, -75.0)).toBeGreaterThan(100);
    expect(distanciaM(4.0, -75.0, 4.001, -75.0)).toBeLessThan(120);
  });
  it('fuera de rango y sin ubicación', () => {
    expect(evaluarGeo({ lat: 4, lng: -75 }, { ubicacion: { lat: 4.01, lng: -75 } }).dentroDeRango).toBe(false);
    expect(evaluarGeo({ lat: 4, lng: -75 }, { ubicacion: null })).toEqual({ distanciaPdvM: null, dentroDeRango: null });
  });
});

describe('schema registro', () => {
  const base = { fecha: '2026-11-16', turno: 'Mañana', tipoDia: 'Laboral', pdvId: 'alkosto' };
  it('laboral sin GPS es inválido', () => {
    expect(RegistroInputSchema.safeParse(base).success).toBe(false);
  });
  it('descanso sin GPS es válido', () => {
    expect(RegistroInputSchema.safeParse({ ...base, tipoDia: 'Descanso' }).success).toBe(true);
  });
  it('laboral con GPS y lotes es válido', () => {
    const r = RegistroInputSchema.safeParse({
      ...base,
      geo: { lat: 4, lng: -75, precisionM: 10, capturadoEn: '2026-11-16T13:00:00.000Z' },
      items: { '33017': { lotesIni: [L('a', 1.2)], rec: null, ave: null } },
    });
    expect(r.success).toBe(true);
  });
  it('rechaza cantidad negativa', () => {
    const r = RegistroInputSchema.safeParse({
      ...base,
      tipoDia: 'Descanso',
      items: { '33017': { lotesIni: [L('a', -1)] } },
    });
    expect(r.success).toBe(false);
  });
});

describe('semáforo', () => {
  it('mayor es mejor', () => {
    expect(semaforo(0.96, 0.95, true)).toBe('good');
    expect(semaforo(0.85, 0.95, true)).toBe('warn');
    expect(semaforo(0.5, 0.95, true)).toBe('crit');
  });
  it('menor es mejor', () => {
    expect(semaforo(4, 4, false)).toBe('good');
    expect(semaforo(6, 4, false)).toBe('warn');
    expect(semaforo(7, 4, false)).toBe('crit');
    expect(semaforo(null, 4, false)).toBe('neu');
  });
});

describe('tablero', () => {
  const productos = {
    '33017': { nombre: 'PUNTA DE ANCA', unidad: 'kg' as const, pesoKg: null },
    '33066': { nombre: 'COSTILLA 500 g', unidad: 'und' as const, pesoKg: 0.5 },
    '33076': { nombre: 'COSTICHI', unidad: 'und' as const, pesoKg: null },
  };
  const ctx = {
    productos,
    equipo: [
      { _id: 'kena', nombre: 'Kena' },
      { _id: 'niyi', nombre: 'Niyi' },
    ],
    metas: METAS_DEF,
    riesgoVto: RIESGO_DEF,
    desde: '2026-11-15',
    hasta: '2026-11-16',
    hoy: '2026-11-16',
  };
  const reg = (p: Partial<RegistroCalc>): RegistroCalc => ({
    fecha: '2026-11-15',
    turno: 'Mañana',
    tipoDia: 'Laboral',
    impulsadoraId: 'kena',
    impulsadoraNombre: 'Kena',
    pdvId: 'mercacentro-4',
    pdvNombre: 'Mercacentro 4',
    items: {},
    mismoDia: true,
    ...p,
  });

  it('sin datos no revienta', () => {
    const t = calcularTablero([], ctx);
    expect(t.resumen.ventaKg).toBe(0);
    expect(t.resumen.doh).toBeNull();
    expect(t.resumen.merma).toBeNull();
    expect(t.cumplimiento[0].diasSinReporte).toBe(2);
  });

  it('KPIs principales', () => {
    const regs = [
      reg({
        items: {
          '33017': { lotesIni: [L('a', 10, '2026-11-20')], rec: 0, ave: 0.5, lotesFin: [L('b', 6, '2026-11-20')], agot: false },
          '33066': { lotesIni: [L('c', 10)], lotesFin: [L('d', 6)], agot: false },
          '33076': { lotesIni: [L('e', 5)], lotesFin: [L('f', 2)], agot: true },
        },
        ejec: { exhib: 'Sí', frentesL: 3, frentesC: 7, precioOk: 'No', temp: 6 },
        impulso: { abordados: 20, compras: 4 },
        comp: { Colanta: { precio: 20000, act: 'Degustación' } },
        nov: ['Precio errado'],
      }),
      reg({
        fecha: '2026-11-16',
        impulsadoraId: 'kena',
        items: {
          // venta negativa → inconsistencia
          '33017': { lotesIni: [L('g', 6, '2026-11-20')], rec: 0, lotesFin: [L('h', 8, '2026-11-20')] },
        },
        geo: { dentroDeRango: false },
      }),
      reg({ fecha: '2026-11-16', tipoDia: 'Descanso', impulsadoraId: 'niyi', impulsadoraNombre: 'Niyi' }),
    ];
    const t = calcularTablero(regs, ctx);
    // venta: punta 10-6-0.5 = 3.5 kg; costilla 4 und × 0.5 = 2 kg; costichi 3 und sin peso
    expect(t.resumen.ventaKg).toBeCloseTo(5.5);
    expect(t.resumen.ventaUndSinPeso).toBe(3);
    expect(t.resumen.inconsistencias).toBe(1);
    expect(t.resumen.dias).toBe(2);
    // inventario: último fin punta = 8 (16-nov), costilla 6 und = 3 kg
    expect(t.resumen.inventarioKg).toBeCloseTo(11);
    expect(t.resumen.merma).toBeCloseTo(0.5 / 6);
    expect(t.resumen.osa).toBeCloseTo(1 - 1 / 4);
    expect(t.resumen.sos).toBeCloseTo(0.3);
    expect(t.resumen.conversion).toBeCloseTo(0.2);
    expect(t.resumen.fueraDeRango).toBe(1);
    expect(t.neverasCalientes).toHaveLength(1);
    // riesgo: lote h (8 und kg) vence 20-nov → 4 días → emergencia
    expect(t.riesgo.porNivel.emergencia.lotes).toBe(1);
    expect(t.riesgo.lista[0]).toMatchObject({ loteId: 'h', dias: 4, nivel: 'emergencia' });
    // descanso cuenta como reportado
    const niyi = t.cumplimiento.find((c) => c.impulsadoraId === 'niyi')!;
    expect(niyi.diasReportados).toBe(1);
    expect(niyi.reportoHoy).toBe(true);
    expect(t.competencia[0]).toMatchObject({ marca: 'Colanta', veces: 1, precioPromedio: 20000 });
  });
});
