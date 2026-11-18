import { INFO_NIVEL, METAS_DEF, RIESGO_DEF, SEMAFORO_TEXTO, TEMP_MAX_NEVERA } from '@merca/shared';
import clsx from 'clsx';
import { ArrowLeft, Clock, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Chip, Encabezado, NivelChip, Tarjeta } from '@/components/ui';
import { useTemaAyuda } from '@/components/ayuda/Ayuda';
import { useConfig } from '@/lib/config';
import { fmt, pct } from '@/lib/formato';
import { Pagina } from '@/features/admin/comun';
import { META_EJECUCION } from './kpis';
import { ESTILO_NIVEL, NIVELES_CON_RIESGO, textoRangoNivel } from './niveles';

export default function IndicadoresPage() {
  useTemaAyuda('indicadores');
  const cfg = useConfig();
  const M = cfg.data?.config.metas ?? METAS_DEF;
  const U = cfg.data?.config.riesgoVto ?? RIESGO_DEF;

  const defs: {
    titulo: string;
    tipo: 'Resultado' | 'Ejecución' | 'Reporte';
    texto: string;
    meta?: string;
  }[] = [
    {
      titulo: 'Sell-out (venta al consumidor)',
      tipo: 'Resultado',
      texto:
        'Inventario inicial + recibido − inventario final − avería. Se suma en kg equivalentes (paquetes de 500 g = 0,5 kg). Los productos por unidad sin peso configurado se muestran aparte.',
    },
    {
      titulo: 'Venta diaria',
      tipo: 'Resultado',
      texto: 'Sell-out ÷ días con registro laboral en el periodo.',
    },
    {
      titulo: 'Inventario actual',
      tipo: 'Resultado',
      texto:
        'Suma del último inventario final (cierre) de cada referencia en cada punto, en kg equivalentes.',
    },
    {
      titulo: 'Días de inventario (rotación)',
      tipo: 'Resultado',
      texto:
        'Inventario actual en góndola ÷ venta promedio diaria. Si sube, el producto envejece en nevera y termina en devolución.',
      meta: `Meta ≤ ${fmt(M.doh, 1)} días`,
    },
    {
      titulo: '% merma / devolución',
      tipo: 'Resultado',
      texto: 'Avería y devolución ÷ (venta + avería).',
      meta: `Meta ≤ ${pct(M.merma, 1)}`,
    },
    {
      titulo: 'Disponibilidad en góndola (OSA)',
      tipo: 'Ejecución',
      texto: 'Referencias no agotadas ÷ referencias revisadas. Un agotado es venta perdida.',
      meta: `Meta ≥ ${pct(M.osa)}`,
    },
    {
      titulo: 'Share of shelf',
      tipo: 'Ejecución',
      texto: 'Frentes LOMUS ÷ (frentes LOMUS + competencia).',
      meta: `Meta ≥ ${pct(M.sos)}`,
    },
    {
      titulo: 'Exhibición y precio',
      tipo: 'Ejecución',
      texto:
        '% de visitas con la exhibición acordada y % con el precio bien marcado, con foto como evidencia.',
      meta: `Meta ≥ ${pct(META_EJECUCION)}`,
    },
    {
      titulo: 'Conversión del impulso',
      tipo: 'Ejecución',
      texto: 'Compras logradas ÷ personas abordadas.',
      meta: `Meta ≥ ${pct(M.conv)}`,
    },
    {
      titulo: 'Trazabilidad del reporte',
      tipo: 'Reporte',
      texto:
        'Días con registro ÷ días del periodo, y % de registros hechos el mismo día. Descanso, festivo o incapacidad se registran como tipo de día.',
      meta: `Meta ≥ ${pct(META_EJECUCION)} a tiempo`,
    },
    {
      titulo: 'Inconsistencias',
      tipo: 'Reporte',
      texto:
        'Filas donde la venta da negativa (el final es mayor que lo que había). Se excluyen de los cálculos y se deben revisar con la persona.',
      meta: 'Meta: 0',
    },
    {
      titulo: 'Registros fuera de rango GPS',
      tipo: 'Reporte',
      texto:
        'Conteos guardados a más distancia del punto que su radio permitido (300 m por defecto). Se guardan con marca roja para revisión.',
      meta: 'Meta: 0',
    },
    {
      titulo: 'Neveras calientes',
      tipo: 'Ejecución',
      texto: `Registros con temperatura de nevera por encima de ${fmt(TEMP_MAX_NEVERA, 1)} °C. Riesgo de cadena de frío: avisar al jefe de sección.`,
    },
  ];

  return (
    <Pagina className="mx-auto max-w-3xl">
      <Link
        to="/tablero"
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-marca-700 hover:bg-marca-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al tablero
      </Link>
      <Encabezado titulo="Indicadores" subtitulo="Cómo medimos la gestión en góndola" />

      <Tarjeta titulo="Cómo medimos la gestión">
        <p className="mb-4 text-[15px] leading-relaxed text-tinta-suave">
          Cada indicador sale de lo que se registra cada día. Los de{' '}
          <b className="text-tinta">resultado</b> dicen qué pasó; los de{' '}
          <b className="text-tinta">ejecución</b> dicen por qué y son los que la mercaimpulsadora
          puede mover.
        </p>
        <ol className="space-y-3">
          {defs.map((d, i) => (
            <li key={d.titulo} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-marca-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-tinta">{d.titulo}</h3>
                  <Chip tono={d.tipo === 'Ejecución' ? 'marca' : 'neutro'}>{d.tipo}</Chip>
                  {d.meta && <Chip tono="ok">{d.meta}</Chip>}
                </div>
                <p className="text-[15px] leading-relaxed text-tinta-suave">{d.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta titulo="Cómo leer el semáforo">
        <ul className="grid gap-2 sm:grid-cols-3">
          {(['good', 'warn', 'crit'] as const).map((s) => (
            <li key={s} className="rounded-xl bg-fondo p-3">
              <Chip tono={s === 'good' ? 'ok' : s === 'warn' ? 'aviso' : 'error'}>
                <span aria-hidden>{SEMAFORO_TEXTO[s].icono}</span> {SEMAFORO_TEXTO[s].texto}
              </Chip>
              <p className="mt-1.5 text-sm text-tinta-suave">
                {s === 'good' && 'Cumple la meta.'}
                {s === 'warn' &&
                  'Cerca: al menos 85 % de la meta (o hasta 1,5 veces el máximo en merma y días de inventario).'}
                {s === 'crit' && 'Lejos de la meta: requiere acción.'}
              </p>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Niveles de riesgo de vencimiento">
        <p className="mb-3 text-[15px] leading-relaxed text-tinta-suave">
          Se calculan por <b className="text-tinta">lote</b> con los días que faltan para la fecha
          de vencimiento (hora Colombia). Un producto toma el peor nivel de sus lotes. Es la alerta
          temprana de la devolución.
        </p>
        <ul className="space-y-2">
          {NIVELES_CON_RIESGO.map((n) => (
            <li
              key={n}
              className={clsx(
                'rounded-xl border-l-4 p-3',
                ESTILO_NIVEL[n].borde,
                ESTILO_NIVEL[n].fondo,
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <NivelChip nivel={n} largo />
                <span className="text-sm font-semibold text-tinta">{textoRangoNivel(n, U)}</span>
              </div>
              <p className="mt-1 text-[15px] text-tinta-suave">
                <b className="text-tinta">Acción:</b> {INFO_NIVEL[n].accion}
              </p>
            </li>
          ))}
          <li
            className={clsx(
              'rounded-xl border-l-4 p-3',
              ESTILO_NIVEL.ok.borde,
              ESTILO_NIVEL.ok.fondo,
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <NivelChip nivel="ok" largo />
              <span className="text-sm font-semibold text-tinta">{textoRangoNivel('ok', U)}</span>
            </div>
          </li>
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Rutina diaria sugerida">
        <ol className="space-y-3">
          {[
            {
              icono: <Sun className="h-5 w-5" />,
              t: 'Al llegar (turno mañana)',
              d: 'Revisa el inventario inicial (viene precargado con los lotes del último cierre), las fechas de vencimiento y la temperatura. Rota FEFO: lo que vence primero, adelante.',
            },
            {
              icono: <Clock className="h-5 w-5" />,
              t: 'Durante el turno',
              d: 'Exhibición, precio, abordaje y degustación sobre las referencias con más días de inventario o que vencen pronto.',
            },
            {
              icono: <Moon className="h-5 w-5" />,
              t: 'Al cierre',
              d: 'Inventario final lote por lote, avería, competencia y novedades. Guarda antes de salir.',
            },
          ].map((p) => (
            <li key={p.t} className="flex gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marca-50 text-marca-600"
                aria-hidden
              >
                {p.icono}
              </span>
              <div>
                <h3 className="font-semibold text-tinta">{p.t}</h3>
                <p className="text-[15px] leading-relaxed text-tinta-suave">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>
    </Pagina>
  );
}
