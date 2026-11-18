import { TEMP_MAX_NEVERA, TURNOS, type Metas, type UmbralesRiesgo } from './constantes.js';
import { diffDias } from './fechas.js';
import { finOf, kgEq, lotesVigentes, ventaOf } from './calculo.js';
import { nivelPorFecha, type NivelRiesgo } from './riesgo.js';
import type { Item, Producto } from './schemas.js';

/* ───────────── Semáforo ───────────── */

export type Semaforo = 'good' | 'warn' | 'crit' | 'neu';

/** "mayor es mejor": verde ≥ meta, ámbar ≥ 85 % meta. "menor es mejor": verde ≤ meta, ámbar ≤ 1,5×meta. */
export function semaforo(v: number | null | undefined, meta: number, mayorEsMejor: boolean): Semaforo {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'neu';
  if (mayorEsMejor) return v >= meta ? 'good' : v >= meta * 0.85 ? 'warn' : 'crit';
  return v <= meta ? 'good' : v <= meta * 1.5 ? 'warn' : 'crit';
}

export const SEMAFORO_TEXTO: Record<Semaforo, { icono: string; texto: string }> = {
  good: { icono: '✓', texto: 'En meta' },
  warn: { icono: '!', texto: 'Atención' },
  crit: { icono: '✕', texto: 'Crítico' },
  neu: { icono: '·', texto: 'Sin datos' },
};

/* ───────────── Entrada ───────────── */

/** Lo mínimo de un registro que necesita el cálculo. */
export interface RegistroCalc {
  fecha: string;
  turno: string;
  tipoDia: string;
  impulsadoraId: string;
  impulsadoraNombre: string;
  pdvId: string;
  pdvNombre: string;
  items: Record<string, Partial<Item>>;
  ejec?: {
    exhib?: string | null;
    frentesL?: number | null;
    frentesC?: number | null;
    precioOk?: string | null;
    temp?: number | null;
  };
  comp?: Record<string, { precio?: number | null; act?: string }>;
  impulso?: { abordados?: number | null; degust?: number | null; compras?: number | null };
  nov?: string[];
  mismoDia?: boolean;
  geo?: { dentroDeRango: boolean | null } | null;
}

export interface ContextoTablero {
  productos: Record<string, Pick<Producto, 'nombre' | 'unidad' | 'pesoKg'>>;
  /** Impulsadoras activas (para cumplimiento de reporte). */
  equipo: { _id: string; nombre: string }[];
  metas: Metas;
  riesgoVto: UmbralesRiesgo;
  desde: string;
  hasta: string;
  hoy: string;
}

/* ───────────── Salida ───────────── */

export interface FilaRiesgo {
  pdvId: string;
  pdvNombre: string;
  impulsadoraNombre: string;
  cod: string;
  producto: string;
  unidad: string;
  loteId: string;
  cantidad: number;
  kg: number | null;
  vto: string;
  dias: number;
  nivel: Exclude<NivelRiesgo, 'ok'>;
  fechaConteo: string;
}

export interface Tablero {
  resumen: {
    registros: number;
    registrosLaborales: number;
    dias: number;
    ventaKg: number;
    ventaDiariaKg: number | null;
    ventaUndSinPeso: number;
    inventarioKg: number;
    doh: number | null;
    merma: number | null;
    osa: number | null;
    sos: number | null;
    exhibicion: number | null;
    precioOk: number | null;
    conversion: number | null;
    aTiempo: number | null;
    inconsistencias: number;
    fueraDeRango: number;
  };
  semaforos: Record<'doh' | 'merma' | 'osa' | 'sos' | 'conversion', Semaforo>;
  serieDiaria: { fecha: string; kg: number }[];
  topReferencias: { cod: string; nombre: string; kg: number }[];
  riesgo: {
    porNivel: Record<Exclude<NivelRiesgo, 'ok'>, { lotes: number; kg: number }>;
    lista: FilaRiesgo[];
  };
  cumplimiento: {
    impulsadoraId: string;
    nombre: string;
    diasReportados: number;
    diasRango: number;
    diasSinReporte: number;
    reportoHoy: boolean;
    ultimoRegistro: string | null;
  }[];
  porImpulsadora: {
    id: string;
    nombre: string;
    registros: number;
    ventaKg: number;
    inventarioKg: number;
    doh: number | null;
    merma: number | null;
    osa: number | null;
    conversion: number | null;
  }[];
  porPdv: {
    id: string;
    nombre: string;
    ventaKg: number;
    kgDia: number | null;
    inventarioKg: number;
    doh: number | null;
    merma: number | null;
    fueraDeRango: number;
  }[];
  porReferencia: {
    cod: string;
    nombre: string;
    ventaKg: number;
    inventarioKg: number;
    doh: number | null;
    merma: number | null;
    lectura: 'Lenta' | 'Riesgo de agotado' | 'Normal' | 'Sin datos';
  }[];
  competencia: {
    marca: string;
    veces: number;
    precioPromedio: number | null;
    actividades: Record<string, number>;
  }[];
  novedades: { generales: Record<string, number>; producto: Record<string, number> };
  neverasCalientes: { pdvNombre: string; fecha: string; temp: number }[];
}

/* ───────────── Cálculo ───────────── */

const div = (a: number, b: number) => (b > 0 ? a / b : null);
const ordTurno = (t: string) => {
  const i = TURNOS.indexOf(t as (typeof TURNOS)[number]);
  return i < 0 ? 9 : i;
};
const ordReg = (r: RegistroCalc) => `${r.fecha}#${ordTurno(r.turno)}`;

export function calcularTablero(regs: RegistroCalc[], ctx: ContextoTablero): Tablero {
  const { productos: P, metas: M } = ctx;
  const lab = regs.filter((r) => r.tipoDia === 'Laboral');

  const dias = new Set<string>();
  let ventaKg = 0,
    ventaUndSinPeso = 0,
    aveKg = 0,
    items = 0,
    agot = 0,
    neg = 0,
    fl = 0,
    fc = 0,
    exS = 0,
    exT = 0,
    prS = 0,
    prT = 0,
    ab = 0,
    co = 0,
    aTiempo = 0,
    fueraDeRango = 0;

  const porDia: Record<string, number> = {};
  type Acc = { venta: number; ave: number; inv: number; items: number; agot: number; ab: number; co: number; regs: number; dias: Set<string>; fuera: number; nombre: string };
  const nuevoAcc = (nombre: string): Acc => ({ venta: 0, ave: 0, inv: 0, items: 0, agot: 0, ab: 0, co: 0, regs: 0, dias: new Set(), fuera: 0, nombre });
  const porImp: Record<string, Acc> = {};
  const porPdv: Record<string, Acc> = {};
  const porSku: Record<string, { venta: number; ave: number; inv: number }> = {};
  const sku = (cod: string) => (porSku[cod] ??= { venta: 0, ave: 0, inv: 0 });

  /** último registro con cierre (fin) por pdv|cod → inventario */
  const ultFin: Record<string, { ord: string; r: RegistroCalc; cod: string; fin: number }> = {};
  /** último registro con lotes vigentes por pdv|cod → riesgo */
  const ultLotes: Record<string, { ord: string; r: RegistroCalc; cod: string; it: Partial<Item> }> = {};

  const comp: Record<string, { veces: number; precios: number[]; act: Record<string, number> }> = {};
  const neveras: Tablero['neverasCalientes'] = [];

  for (const r of lab) {
    dias.add(r.fecha);
    if (r.mismoDia !== false) aTiempo++;
    if (r.geo && r.geo.dentroDeRango === false) fueraDeRango++;

    const pi = (porImp[r.impulsadoraId] ??= nuevoAcc(r.impulsadoraNombre));
    const pp = (porPdv[r.pdvId] ??= nuevoAcc(r.pdvNombre));
    pi.regs++;
    pi.dias.add(r.fecha);
    pp.regs++;
    pp.dias.add(r.fecha);
    if (r.geo && r.geo.dentroDeRango === false) pp.fuera++;
    const ord = ordReg(r);

    for (const [cod, it] of Object.entries(r.items ?? {})) {
      const prod = P[cod];
      items++;
      pi.items++;
      if (it.agot) {
        agot++;
        pi.agot++;
      }
      const key = `${r.pdvId}|${cod}`;
      const fin = finOf(it);
      if (fin !== null && (!ultFin[key] || ultFin[key].ord < ord)) ultFin[key] = { ord, r, cod, fin };
      if ((it.lotesFin || it.lotesIni) && (!ultLotes[key] || ultLotes[key].ord < ord))
        ultLotes[key] = { ord, r, cod, it };

      const v = ventaOf(it);
      if (v !== null && v < 0) {
        neg++;
        continue;
      }
      if (v !== null) {
        const kv = kgEq(prod, v);
        if (kv !== null) {
          ventaKg += kv;
          pi.venta += kv;
          pp.venta += kv;
          sku(cod).venta += kv;
          porDia[r.fecha] = (porDia[r.fecha] ?? 0) + kv;
        } else ventaUndSinPeso += v;
      }
      const ka = kgEq(prod, it.ave ?? 0);
      if (ka) {
        aveKg += ka;
        pi.ave += ka;
        pp.ave += ka;
        sku(cod).ave += ka;
      }
    }

    const e = r.ejec ?? {};
    if (e.frentesL != null && e.frentesC != null) {
      fl += e.frentesL;
      fc += e.frentesC;
    }
    if (e.exhib) {
      exT++;
      if (e.exhib === 'Sí') exS++;
    }
    if (e.precioOk) {
      prT++;
      if (e.precioOk === 'Sí') prS++;
    }
    if (e.temp != null && e.temp > TEMP_MAX_NEVERA)
      neveras.push({ pdvNombre: r.pdvNombre, fecha: r.fecha, temp: e.temp });

    const imp = r.impulso ?? {};
    if ((imp.abordados ?? 0) > 0) {
      ab += imp.abordados!;
      co += imp.compras ?? 0;
      pi.ab += imp.abordados!;
      pi.co += imp.compras ?? 0;
    }

    for (const [marca, c] of Object.entries(r.comp ?? {})) {
      const x = (comp[marca] ??= { veces: 0, precios: [], act: {} });
      x.veces++;
      if (c.precio) x.precios.push(c.precio);
      if (c.act && c.act !== 'Ninguna') x.act[c.act] = (x.act[c.act] ?? 0) + 1;
    }
  }

  // Inventario actual
  let inventarioKg = 0;
  for (const u of Object.values(ultFin)) {
    const k = kgEq(P[u.cod], u.fin);
    if (k === null) continue;
    inventarioKg += k;
    porPdv[u.r.pdvId] && (porPdv[u.r.pdvId].inv += k);
    porImp[u.r.impulsadoraId] && (porImp[u.r.impulsadoraId].inv += k);
    sku(u.cod).inv += k;
  }

  // Riesgo de vencimiento (respecto a hoy)
  const porNivel: Tablero['riesgo']['porNivel'] = {
    vencido: { lotes: 0, kg: 0 },
    emergencia: { lotes: 0, kg: 0 },
    critico: { lotes: 0, kg: 0 },
    medio: { lotes: 0, kg: 0 },
  };
  const lista: FilaRiesgo[] = [];
  for (const u of Object.values(ultLotes)) {
    const prod = P[u.cod];
    for (const l of lotesVigentes(u.it)) {
      if (!(l.cantidad > 0) || !l.vto) continue;
      const { dias: d, nivel } = nivelPorFecha(l.vto, ctx.hoy, ctx.riesgoVto);
      if (nivel === 'ok') continue;
      const kg = kgEq(prod, l.cantidad);
      porNivel[nivel].lotes++;
      porNivel[nivel].kg += kg ?? 0;
      lista.push({
        pdvId: u.r.pdvId,
        pdvNombre: u.r.pdvNombre,
        impulsadoraNombre: u.r.impulsadoraNombre,
        cod: u.cod,
        producto: prod?.nombre ?? u.cod,
        unidad: prod?.unidad ?? '',
        loteId: l.id,
        cantidad: l.cantidad,
        kg,
        vto: l.vto,
        dias: d,
        nivel,
        fechaConteo: u.r.fecha,
      });
    }
  }
  lista.sort((a, b) => a.dias - b.dias || a.pdvNombre.localeCompare(b.pdvNombre));

  const D = dias.size;
  const ventaDiariaKg = D ? ventaKg / D : null;
  const doh = ventaDiariaKg && ventaDiariaKg > 0 ? inventarioKg / ventaDiariaKg : null;
  const merma = div(aveKg, ventaKg + aveKg);
  const osa = items ? 1 - agot / items : null;
  const sos = div(fl, fl + fc);
  const conversion = div(co, ab);

  // Cumplimiento de reporte (cualquier tipo de día cuenta)
  const hastaEf = ctx.hasta < ctx.hoy ? ctx.hasta : ctx.hoy;
  const diasRango = Math.max(0, diffDias(hastaEf, ctx.desde) + 1);
  const cumplimiento = ctx.equipo.map((e) => {
    const mios = regs.filter((r) => r.impulsadoraId === e._id);
    const ds = new Set(mios.map((r) => r.fecha));
    const ultimo = mios.map((r) => r.fecha).sort().pop() ?? null;
    return {
      impulsadoraId: e._id,
      nombre: e.nombre,
      diasReportados: ds.size,
      diasRango,
      diasSinReporte: Math.max(0, diasRango - ds.size),
      reportoHoy: ds.has(ctx.hoy),
      ultimoRegistro: ultimo,
    };
  });

  const dohDe = (inv: number, venta: number, nd: number) => {
    const vd = nd ? venta / nd : 0;
    return vd > 0 ? inv / vd : null;
  };

  const nombreProd = (cod: string) => P[cod]?.nombre ?? cod;
  const novGen: Record<string, number> = {};
  const novProd: Record<string, number> = {};
  for (const r of regs) {
    for (const n of r.nov ?? []) novGen[n] = (novGen[n] ?? 0) + 1;
    for (const it of Object.values(r.items ?? {}))
      for (const l of [...(it.lotesIni ?? []), ...(it.lotesFin ?? [])])
        if (l.novedad) novProd[l.novedad.tipo] = (novProd[l.novedad.tipo] ?? 0) + 1;
  }

  return {
    resumen: {
      registros: regs.length,
      registrosLaborales: lab.length,
      dias: D,
      ventaKg,
      ventaDiariaKg,
      ventaUndSinPeso,
      inventarioKg,
      doh,
      merma,
      osa,
      sos,
      exhibicion: div(exS, exT),
      precioOk: div(prS, prT),
      conversion,
      aTiempo: div(aTiempo, lab.length),
      inconsistencias: neg,
      fueraDeRango,
    },
    semaforos: {
      doh: semaforo(doh, M.doh, false),
      merma: semaforo(merma, M.merma, false),
      osa: semaforo(osa, M.osa, true),
      sos: semaforo(sos, M.sos, true),
      conversion: semaforo(conversion, M.conv, true),
    },
    serieDiaria: Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, kg]) => ({ fecha, kg })),
    topReferencias: Object.entries(porSku)
      .filter(([, s]) => s.venta > 0)
      .sort(([, a], [, b]) => b.venta - a.venta)
      .slice(0, 10)
      .map(([cod, s]) => ({ cod, nombre: nombreProd(cod), kg: s.venta })),
    riesgo: { porNivel, lista },
    cumplimiento,
    porImpulsadora: Object.entries(porImp).map(([id, a]) => ({
      id,
      nombre: a.nombre,
      registros: a.regs,
      ventaKg: a.venta,
      inventarioKg: a.inv,
      doh: dohDe(a.inv, a.venta, a.dias.size),
      merma: div(a.ave, a.venta + a.ave),
      osa: a.items ? 1 - a.agot / a.items : null,
      conversion: div(a.co, a.ab),
    })),
    porPdv: Object.entries(porPdv).map(([id, a]) => ({
      id,
      nombre: a.nombre,
      ventaKg: a.venta,
      kgDia: a.dias.size ? a.venta / a.dias.size : null,
      inventarioKg: a.inv,
      doh: dohDe(a.inv, a.venta, a.dias.size),
      merma: div(a.ave, a.venta + a.ave),
      fueraDeRango: a.fuera,
    })),
    porReferencia: Object.entries(porSku)
      .map(([cod, s]) => {
        const d = dohDe(s.inv, s.venta, D);
        const lectura: Tablero['porReferencia'][number]['lectura'] =
          s.venta <= 0 && s.inv > 0
            ? 'Lenta'
            : d === null
              ? 'Sin datos'
              : d > 2 * M.doh
                ? 'Lenta'
                : d < 1
                  ? 'Riesgo de agotado'
                  : 'Normal';
        return {
          cod,
          nombre: nombreProd(cod),
          ventaKg: s.venta,
          inventarioKg: s.inv,
          doh: d,
          merma: div(s.ave, s.venta + s.ave),
          lectura,
        };
      })
      .sort((a, b) => b.ventaKg - a.ventaKg),
    competencia: Object.entries(comp)
      .map(([marca, c]) => ({
        marca,
        veces: c.veces,
        precioPromedio: c.precios.length ? c.precios.reduce((a, b) => a + b, 0) / c.precios.length : null,
        actividades: c.act,
      }))
      .sort((a, b) => b.veces - a.veces),
    novedades: { generales: novGen, producto: novProd },
    neverasCalientes: neveras.sort((a, b) => b.temp - a.temp),
  };
}
