import type { TableroResponse } from '@merca/shared';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Tarjeta } from '@/components/ui';
import { fechaCorta, fmt } from '@/lib/formato';

/** Una sola serie, un solo color de marca. */
const COLOR = '#8f1d2c';
const EJE = { fontSize: 12, fill: '#8a8183' };

function useEsAncho(query = '(min-width: 768px)') {
  const [ok, setOk] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const f = () => setOk(m.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, [query]);
  return ok;
}

function TooltipKg({
  active,
  payload,
  label,
  etiqueta,
}: TooltipProps<number, string> & { etiqueta: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-tinta px-3 py-2 text-sm text-white shadow-lg">
      <p className="font-semibold">{etiqueta(String(label))}</p>
      <p className="tabular-nums">{fmt(payload[0].value as number, 1)} kg</p>
    </div>
  );
}

const sinDia = (f: string) => fechaCorta(f).split(' ').slice(1).join(' ');
const recortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function GraficoSellout({ t }: { t: TableroResponse }) {
  const datos = t.serieDiaria;
  return (
    <Tarjeta titulo="Sell-out diario (kg equivalentes)">
      {datos.length < 2 ? (
        <p className="py-8 text-center text-sm text-tinta-tenue">
          {datos.length === 1
            ? `Solo hay un día con venta (${fechaCorta(datos[0].fecha)}: ${fmt(datos[0].kg, 1)} kg). Amplía el rango para ver la tendencia.`
            : 'Sin venta registrada en este rango.'}
        </p>
      ) : (
        <figure aria-label="Gráfico de línea del sell-out diario en kg">
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ece6e3" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={sinDia}
                  tick={EJE}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tickFormatter={(v: number) => fmt(v, 0)}
                  tick={EJE}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  content={<TooltipKg etiqueta={fechaCorta} />}
                  cursor={{ stroke: '#bbb', strokeDasharray: '3 3' }}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  name="Sell-out"
                  stroke={COLOR}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COLOR, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  animationDuration={600}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <TablaOculta
            titulo="Sell-out por día"
            filas={datos.map((d) => [fechaCorta(d.fecha), `${fmt(d.kg, 1)} kg`])}
          />
        </figure>
      )}
    </Tarjeta>
  );
}

export function GraficoTopReferencias({ t }: { t: TableroResponse }) {
  const ancho = useEsAncho();
  const datos = t.topReferencias;
  const largo = ancho ? 30 : 16;
  return (
    <Tarjeta titulo="Top 10 referencias por venta (kg)">
      {!datos.length ? (
        <p className="py-8 text-center text-sm text-tinta-tenue">
          Sin venta registrada en este rango.
        </p>
      ) : (
        <figure aria-label="Gráfico de barras de las referencias más vendidas">
          <div style={{ height: datos.length * 34 + 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datos}
                layout="vertical"
                margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                barCategoryGap={8}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={ancho ? 220 : 128}
                  tick={{ ...EJE, fill: '#5b5254' }}
                  tickFormatter={(s: string) => recortar(s, largo)}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <Tooltip
                  content={<TooltipKg etiqueta={(l) => l} />}
                  cursor={{ fill: 'rgba(143,29,44,.06)' }}
                />
                <Bar
                  dataKey="kg"
                  name="Venta"
                  fill={COLOR}
                  radius={[0, 6, 6, 0]}
                  animationDuration={600}
                >
                  <LabelList
                    dataKey="kg"
                    position="right"
                    formatter={(v: number) => fmt(v, 1)}
                    style={{ fontSize: 12, fill: '#1f1a1b' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TablaOculta
            titulo="Venta por referencia"
            filas={datos.map((d) => [d.nombre, `${fmt(d.kg, 1)} kg`])}
          />
        </figure>
      )}
    </Tarjeta>
  );
}

/** Versión de texto para lectores de pantalla. */
function TablaOculta({ titulo, filas }: { titulo: string; filas: [string, string][] }) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <tbody>
        {filas.map(([a, b], i) => (
          <tr key={i}>
            <th scope="row">{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
