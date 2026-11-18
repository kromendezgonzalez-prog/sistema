import { semaforo, type Metas, type Semaforo, type TableroResponse } from '@merca/shared';
import { fmt, pct } from '@/lib/formato';

/**
 * Tarjetas de KPI del tablero. Los valores vienen TAL CUAL de `GET /tablero`;
 * aquí solo se formatean y se escoge el semáforo a mostrar.
 * Exhibición, precio y reporte a tiempo usan meta 90 % (igual que el prototipo).
 */
export const META_EJECUCION = 0.9;

export type GrupoKpi = 'resultado' | 'ejecucion' | 'reporte';

export interface KpiVista {
  id: string;
  grupo: GrupoKpi;
  titulo: string;
  valor: string;
  unidad?: string;
  detalle: string;
  estado: Semaforo;
}

export const GRUPOS_KPI: { id: GrupoKpi; titulo: string; descripcion: string }[] = [
  { id: 'resultado', titulo: 'Resultado', descripcion: 'Qué pasó con la venta y el inventario' },
  {
    id: 'ejecucion',
    titulo: 'Ejecución en góndola',
    descripcion: 'Lo que el equipo puede mover cada día',
  },
  {
    id: 'reporte',
    titulo: 'Calidad del reporte',
    descripcion: 'Trazabilidad y confiabilidad de los datos',
  },
];

export function construirKpis(t: TableroResponse, M: Metas): KpiVista[] {
  const r = t.resumen;
  const s = t.semaforos;
  return [
    {
      id: 'sellout',
      grupo: 'resultado',
      titulo: 'Sell-out',
      valor: fmt(r.ventaKg, 1),
      unidad: 'kg',
      detalle: `${r.dias} día${r.dias === 1 ? '' : 's'} con datos${r.ventaUndSinPeso ? ` · +${fmt(r.ventaUndSinPeso, 0)} und sin peso` : ''}`,
      estado: 'neu',
    },
    {
      id: 'ventaDiaria',
      grupo: 'resultado',
      titulo: 'Venta diaria',
      valor: fmt(r.ventaDiariaKg, 1),
      unidad: 'kg/día',
      detalle: 'Promedio de los días con registro',
      estado: 'neu',
    },
    {
      id: 'inventario',
      grupo: 'resultado',
      titulo: 'Inventario actual',
      valor: fmt(r.inventarioKg, 1),
      unidad: 'kg',
      detalle: 'Último cierre de cada referencia por punto',
      estado: 'neu',
    },
    {
      id: 'doh',
      grupo: 'resultado',
      titulo: 'Días de inventario',
      valor: fmt(r.doh, 1),
      unidad: r.doh === null ? undefined : 'días',
      detalle: `Meta ≤ ${fmt(M.doh, 1)} días`,
      estado: s.doh,
    },
    {
      id: 'merma',
      grupo: 'resultado',
      titulo: '% merma',
      valor: pct(r.merma, 1),
      detalle: `Avería ÷ (venta + avería) · meta ≤ ${pct(M.merma, 1)}`,
      estado: s.merma,
    },
    {
      id: 'osa',
      grupo: 'ejecucion',
      titulo: 'Disponibilidad (OSA)',
      valor: pct(r.osa),
      detalle: `Referencias sin agotado · meta ≥ ${pct(M.osa)}`,
      estado: s.osa,
    },
    {
      id: 'sos',
      grupo: 'ejecucion',
      titulo: 'Share of shelf',
      valor: pct(r.sos),
      detalle: `Frentes LOMUS ÷ total · meta ≥ ${pct(M.sos)}`,
      estado: s.sos,
    },
    {
      id: 'exhibicion',
      grupo: 'ejecucion',
      titulo: 'Exhibición cumplida',
      valor: pct(r.exhibicion),
      detalle: `Visitas con exhibición acordada · meta ≥ ${pct(META_EJECUCION)}`,
      estado: semaforo(r.exhibicion, META_EJECUCION, true),
    },
    {
      id: 'precio',
      grupo: 'ejecucion',
      titulo: 'Precio bien marcado',
      valor: pct(r.precioOk),
      detalle: `Visitas con precio correcto · meta ≥ ${pct(META_EJECUCION)}`,
      estado: semaforo(r.precioOk, META_EJECUCION, true),
    },
    {
      id: 'conversion',
      grupo: 'ejecucion',
      titulo: 'Conversión del impulso',
      valor: pct(r.conversion),
      detalle: `Compras ÷ personas abordadas · meta ≥ ${pct(M.conv)}`,
      estado: s.conversion,
    },
    {
      id: 'aTiempo',
      grupo: 'reporte',
      titulo: 'Reporte a tiempo',
      valor: pct(r.aTiempo),
      detalle: `Registros hechos el mismo día · meta ≥ ${pct(META_EJECUCION)}`,
      estado: semaforo(r.aTiempo, META_EJECUCION, true),
    },
    {
      id: 'inconsistencias',
      grupo: 'reporte',
      titulo: 'Inconsistencias',
      valor: fmt(r.inconsistencias, 0),
      detalle: r.inconsistencias
        ? 'Filas con venta negativa, excluidas de los cálculos'
        : 'Sin ventas negativas',
      estado: r.registrosLaborales === 0 ? 'neu' : r.inconsistencias === 0 ? 'good' : 'warn',
    },
    {
      id: 'fueraDeRango',
      grupo: 'reporte',
      titulo: 'Registros fuera de rango GPS',
      valor: fmt(r.fueraDeRango, 0),
      detalle: `De ${fmt(r.registrosLaborales, 0)} registros laborales`,
      estado: r.registrosLaborales === 0 ? 'neu' : r.fueraDeRango === 0 ? 'good' : 'crit',
    },
  ];
}
