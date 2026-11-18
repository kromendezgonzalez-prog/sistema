import { RIESGO_DEF, VTO_MAX_DIAS, type UmbralesRiesgo } from './constantes.js';
import { diffDias } from './fechas.js';
import { nivelPorFecha, peorNivel, type NivelRiesgo } from './riesgo.js';
import type { Item, Lote, Producto, RiesgoLote } from './schemas.js';

type ProdLike = Pick<Producto, 'unidad' | 'pesoKg'>;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Suma de cantidades de lotes. undefined → null (no registrado). */
export function sumaLotes(lotes: Lote[] | undefined | null): number | null {
  if (!lotes) return null;
  return r3(lotes.reduce((a, l) => a + (Number.isFinite(l.cantidad) ? l.cantidad : 0), 0));
}

export const iniOf = (it: Partial<Item>) => sumaLotes(it.lotesIni);
export const finOf = (it: Partial<Item>) => sumaLotes(it.lotesFin);

/** venta = ini + rec − fin − ave. null si falta ini o fin. */
export function ventaOf(it: Partial<Item>): number | null {
  const ini = iniOf(it);
  const fin = finOf(it);
  if (ini === null || fin === null) return null;
  return r3(ini + (it.rec ?? 0) - fin - (it.ave ?? 0));
}

/** Convierte cantidad a kg equivalentes. null si es "und" sin peso. */
export function kgEq(prod: ProdLike | undefined | null, q: number | null | undefined): number | null {
  if (q === null || q === undefined || !prod) return null;
  if (prod.unidad === 'kg') return q;
  return prod.pesoKg ? r3(q * prod.pesoKg) : null;
}

/** Lotes que representan lo que hay en góndola: finales si existen, si no los iniciales. */
export function lotesVigentes(it: Partial<Item>): Lote[] {
  return it.lotesFin ?? it.lotesIni ?? [];
}

/** Vencimiento más próximo entre los lotes vigentes con cantidad > 0. */
export function vtoMinOf(it: Partial<Item>): string | null {
  let min: string | null = null;
  for (const l of lotesVigentes(it)) {
    if (l.cantidad > 0 && l.vto && (min === null || l.vto < min)) min = l.vto;
  }
  return min;
}

/** Riesgos (≠ ok) de los lotes vigentes de un ítem. */
export function riesgosItem(
  cod: string,
  it: Partial<Item>,
  hoy: string,
  u: UmbralesRiesgo = RIESGO_DEF,
): RiesgoLote[] {
  const out: RiesgoLote[] = [];
  for (const l of lotesVigentes(it)) {
    if (!(l.cantidad > 0) || !l.vto) continue;
    const { dias, nivel } = nivelPorFecha(l.vto, hoy, u);
    if (nivel !== 'ok') out.push({ cod, loteId: l.id, cantidad: l.cantidad, vto: l.vto, dias, nivel });
  }
  return out.sort((a, b) => a.dias - b.dias);
}

export function riesgosRegistro(
  items: Record<string, Partial<Item>>,
  hoy: string,
  u: UmbralesRiesgo = RIESGO_DEF,
): RiesgoLote[] {
  return Object.entries(items)
    .flatMap(([cod, it]) => riesgosItem(cod, it, hoy, u))
    .sort((a, b) => a.dias - b.dias);
}

export function nivelItem(it: Partial<Item>, hoy: string, u: UmbralesRiesgo = RIESGO_DEF): NivelRiesgo {
  return peorNivel(riesgosItem('', it, hoy, u).map((r) => r.nivel));
}

export interface Alerta {
  tipo: 'venta-negativa' | 'vto-pasado' | 'vto-lejano' | 'lote-sin-fecha';
  mensaje: string;
  loteId?: string;
}

/**
 * Validaciones "suaves" (en rojo, se permite enviar con doble confirmación).
 * `fechaRegistro` es la fecha del registro.
 */
export function alertasItem(it: Partial<Item>, fechaRegistro: string): Alerta[] {
  const out: Alerta[] = [];
  const v = ventaOf(it);
  if (v !== null && v < 0)
    out.push({
      tipo: 'venta-negativa',
      mensaje: `Venta negativa (${v}). Revisa inicial, recibido, final y avería.`,
    });
  for (const l of [...(it.lotesIni ?? []), ...(it.lotesFin ?? [])]) {
    if (!l.vto) {
      if (l.cantidad > 0)
        out.push({ tipo: 'lote-sin-fecha', mensaje: 'Lote sin fecha de vencimiento.', loteId: l.id });
      continue;
    }
    const d = diffDias(l.vto, fechaRegistro);
    if (d < 0)
      out.push({ tipo: 'vto-pasado', mensaje: `Lote vencido hace ${-d} día(s).`, loteId: l.id });
    else if (d > VTO_MAX_DIAS)
      out.push({
        tipo: 'vto-lejano',
        mensaje: `Vence en ${d} días: ¿fecha bien escrita?`,
        loteId: l.id,
      });
  }
  return out;
}
