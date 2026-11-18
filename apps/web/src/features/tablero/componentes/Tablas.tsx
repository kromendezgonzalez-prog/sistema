import { semaforo, TEMP_MAX_NEVERA, type Metas, type TableroResponse } from '@merca/shared';
import clsx from 'clsx';
import { ExternalLink, Thermometer } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Tarjeta } from '@/components/ui';
import { fechaCorta, fmt, pct, pesos } from '@/lib/formato';
import { Interruptor, TablaResponsiva, urlMapa, type Columna } from '@/features/admin/comun';

/* ───────── Celdas con semáforo (ícono + valor, nunca solo color) ───────── */

const ICONO = { good: '✓', warn: '!', crit: '✕' } as const;
const TONO = { good: 'ok', warn: 'aviso', crit: 'error' } as const;

export function ValorSemaforo({
  v,
  meta,
  mayorEsMejor,
  formato,
}: {
  v: number | null;
  meta: number;
  mayorEsMejor: boolean;
  formato: (n: number) => string;
}) {
  if (v === null || !Number.isFinite(v)) return <span className="text-tinta-tenue">–</span>;
  const s = semaforo(v, meta, mayorEsMejor);
  if (s === 'neu') return <>{formato(v)}</>;
  return (
    <Chip tono={TONO[s]}>
      <span aria-hidden>{ICONO[s]}</span> {formato(v)}
    </Chip>
  );
}

function Pista({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-tinta-tenue">{children}</p>;
}

/* ───────── Cumplimiento de reporte ───────── */

export function TablaCumplimiento({
  t,
  titulo = 'Cumplimiento de reporte',
}: {
  t: TableroResponse;
  titulo?: string;
}) {
  const filas = [...t.cumplimiento].sort(
    (a, b) => Number(a.reportoHoy) - Number(b.reportoHoy) || b.diasSinReporte - a.diasSinReporte,
  );
  const cols: Columna<(typeof filas)[number]>[] = [
    { clave: 'nombre', titulo: 'Persona', celda: (f) => f.nombre, principal: true },
    {
      clave: 'hoy',
      titulo: '¿Reportó hoy?',
      celda: (f) => (f.reportoHoy ? <Chip tono="ok">✓ Sí</Chip> : <Chip tono="error">✕ No</Chip>),
    },
    {
      clave: 'dias',
      titulo: 'Días con registro',
      num: true,
      celda: (f) => `${f.diasReportados} / ${f.diasRango}`,
    },
    {
      clave: 'sin',
      titulo: 'Días sin reporte',
      num: true,
      celda: (f) => {
        const s = f.diasSinReporte === 0 ? 'good' : f.diasSinReporte <= 1 ? 'warn' : 'crit';
        return (
          <Chip tono={TONO[s]}>
            <span aria-hidden>{ICONO[s]}</span> {f.diasSinReporte}
          </Chip>
        );
      },
    },
    {
      clave: 'ultimo',
      titulo: 'Último registro',
      celda: (f) => (f.ultimoRegistro ? fechaCorta(f.ultimoRegistro) : 'Nunca'),
    },
  ];
  return (
    <Tarjeta titulo={titulo}>
      <TablaResponsiva
        etiqueta={titulo}
        columnas={cols}
        filas={filas}
        clave={(f) => f.impulsadoraId}
        vacio="No hay mercaimpulsadoras activas para este filtro."
      />
      <Pista>Descanso, festivo o incapacidad cuentan como día reportado si se registran.</Pista>
    </Tarjeta>
  );
}

/* ───────── Por mercaimpulsadora ───────── */

export function TablaPorImpulsadora({ t, M }: { t: TableroResponse; M: Metas }) {
  const filas = [...t.porImpulsadora].sort((a, b) => b.ventaKg - a.ventaKg);
  const cols: Columna<(typeof filas)[number]>[] = [
    { clave: 'nombre', titulo: 'Persona', celda: (f) => f.nombre, principal: true },
    { clave: 'regs', titulo: 'Registros', num: true, celda: (f) => fmt(f.registros, 0) },
    { clave: 'venta', titulo: 'Venta kg', num: true, celda: (f) => fmt(f.ventaKg, 1) },
    { clave: 'inv', titulo: 'Inventario kg', num: true, celda: (f) => fmt(f.inventarioKg, 1) },
    {
      clave: 'doh',
      titulo: 'Días inv.',
      num: true,
      celda: (f) => (
        <ValorSemaforo v={f.doh} meta={M.doh} mayorEsMejor={false} formato={(v) => fmt(v, 1)} />
      ),
    },
    {
      clave: 'merma',
      titulo: 'Merma',
      num: true,
      celda: (f) => (
        <ValorSemaforo v={f.merma} meta={M.merma} mayorEsMejor={false} formato={(v) => pct(v, 1)} />
      ),
    },
    {
      clave: 'osa',
      titulo: 'OSA',
      num: true,
      celda: (f) => <ValorSemaforo v={f.osa} meta={M.osa} mayorEsMejor formato={(v) => pct(v)} />,
    },
    {
      clave: 'conv',
      titulo: 'Conversión',
      num: true,
      celda: (f) => (
        <ValorSemaforo v={f.conversion} meta={M.conv} mayorEsMejor formato={(v) => pct(v)} />
      ),
    },
  ];
  return (
    <Tarjeta titulo="Por mercaimpulsadora">
      <TablaResponsiva
        etiqueta="Indicadores por mercaimpulsadora"
        columnas={cols}
        filas={filas}
        clave={(f) => f.id}
      />
    </Tarjeta>
  );
}

/* ───────── Por punto de venta ───────── */

export function TablaPorPdv({ t, M }: { t: TableroResponse; M: Metas }) {
  const filas = [...t.porPdv].sort((a, b) => b.ventaKg - a.ventaKg);
  const cols: Columna<(typeof filas)[number]>[] = [
    { clave: 'nombre', titulo: 'Punto', celda: (f) => f.nombre, principal: true },
    { clave: 'venta', titulo: 'Venta kg', num: true, celda: (f) => fmt(f.ventaKg, 1) },
    { clave: 'dia', titulo: 'kg/día', num: true, celda: (f) => fmt(f.kgDia, 1) },
    { clave: 'inv', titulo: 'Inventario kg', num: true, celda: (f) => fmt(f.inventarioKg, 1) },
    {
      clave: 'doh',
      titulo: 'Días inv.',
      num: true,
      celda: (f) => (
        <ValorSemaforo v={f.doh} meta={M.doh} mayorEsMejor={false} formato={(v) => fmt(v, 1)} />
      ),
    },
    {
      clave: 'merma',
      titulo: 'Merma',
      num: true,
      celda: (f) => (
        <ValorSemaforo v={f.merma} meta={M.merma} mayorEsMejor={false} formato={(v) => pct(v, 1)} />
      ),
    },
    {
      clave: 'fuera',
      titulo: 'Fuera de rango',
      num: true,
      celda: (f) =>
        f.fueraDeRango ? <Chip tono="error">✕ {f.fueraDeRango}</Chip> : <Chip tono="ok">✓ 0</Chip>,
    },
  ];
  return (
    <Tarjeta titulo="Por punto de venta">
      <TablaResponsiva
        etiqueta="Indicadores por punto de venta"
        columnas={cols}
        filas={filas}
        clave={(f) => f.id}
      />
      <Pista>
        Días de inventario altos + merma alta = pedir menos o cambiar la mezcla de referencias en
        ese punto. Días bajos + agotados = pedir más.
      </Pista>
    </Tarjeta>
  );
}

/* ───────── Rotación por referencia ───────── */

const LECTURA: Record<TableroResponse['porReferencia'][number]['lectura'], ReactNode> = {
  Lenta: <Chip tono="error">✕ Lenta</Chip>,
  'Riesgo de agotado': <Chip tono="aviso">! Riesgo de agotado</Chip>,
  Normal: <Chip tono="ok">✓ Normal</Chip>,
  'Sin datos': <Chip>· Sin datos</Chip>,
};

export function TablaReferencias({ t, M }: { t: TableroResponse; M: Metas }) {
  const cols: Columna<TableroResponse['porReferencia'][number]>[] = [
    { clave: 'nombre', titulo: 'Referencia', celda: (f) => f.nombre, principal: true },
    { clave: 'lectura', titulo: 'Lectura', celda: (f) => LECTURA[f.lectura] },
    { clave: 'venta', titulo: 'Venta kg', num: true, celda: (f) => fmt(f.ventaKg, 1) },
    { clave: 'inv', titulo: 'Inventario kg', num: true, celda: (f) => fmt(f.inventarioKg, 1) },
    {
      clave: 'doh',
      titulo: 'Días inv.',
      num: true,
      celda: (f) =>
        f.doh === null && f.ventaKg <= 0 && f.inventarioKg > 0 ? 'Sin venta' : fmt(f.doh, 1),
    },
    {
      clave: 'merma',
      titulo: 'Merma',
      num: true,
      celda: (f) => (
        <ValorSemaforo v={f.merma} meta={M.merma} mayorEsMejor={false} formato={(v) => pct(v, 1)} />
      ),
    },
  ];
  return (
    <Tarjeta titulo="Rotación por referencia">
      <TablaResponsiva
        etiqueta="Rotación por referencia"
        columnas={cols}
        filas={t.porReferencia}
        clave={(f) => f.cod}
      />
      <Pista>
        “Lenta”: más de {fmt(M.doh * 2, 0)} días de inventario o sin venta. “Riesgo de agotado”:
        menos de 1 día de inventario.
      </Pista>
    </Tarjeta>
  );
}

/* ───────── Competencia ───────── */

export function TablaCompetencia({ t }: { t: TableroResponse }) {
  const cols: Columna<TableroResponse['competencia'][number]>[] = [
    { clave: 'marca', titulo: 'Marca', celda: (f) => f.marca, principal: true },
    { clave: 'veces', titulo: 'Veces vista', num: true, celda: (f) => fmt(f.veces, 0) },
    {
      clave: 'precio',
      titulo: 'Precio prom. $/kg',
      num: true,
      celda: (f) => pesos(f.precioPromedio),
    },
    {
      clave: 'act',
      titulo: 'Actividades',
      celda: (f) => {
        const a = Object.entries(f.actividades).sort((x, y) => y[1] - x[1]);
        return a.length ? a.map(([k, n]) => `${k} (${n})`).join(', ') : '—';
      },
    },
  ];
  return (
    <Tarjeta titulo="Competencia observada">
      <TablaResponsiva
        etiqueta="Competencia observada"
        columnas={cols}
        filas={t.competencia}
        clave={(f) => f.marca}
        vacio="No se registró competencia en este rango."
      />
    </Tarjeta>
  );
}

/* ───────── Novedades por tipo + neveras ───────── */

function BarrasConteo({ titulo, datos }: { titulo: string; datos: Record<string, number> }) {
  const filas = Object.entries(datos).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...filas.map(([, n]) => n));
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-tinta">{titulo}</h3>
      {!filas.length ? (
        <p className="text-sm text-tinta-tenue">Ninguna en este rango.</p>
      ) : (
        <ul className="space-y-2" aria-label={titulo}>
          {filas.map(([k, n]) => (
            <li key={k}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{k}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-black/5" aria-hidden>
                <div
                  className="h-2 rounded-full bg-marca-600"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TarjetaNovedades({ t, conGaleria }: { t: TableroResponse; conGaleria: boolean }) {
  return (
    <Tarjeta
      titulo="Novedades por tipo"
      accion={
        conGaleria ? (
          <Link
            to="/novedades"
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50"
          >
            Ver galería
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <BarrasConteo titulo="Generales del registro" datos={t.novedades.generales} />
        <BarrasConteo titulo="De producto (por lote)" datos={t.novedades.producto} />
      </div>
    </Tarjeta>
  );
}

export function TarjetaNeveras({ t }: { t: TableroResponse }) {
  const filas = t.neverasCalientes;
  return (
    <Tarjeta titulo={`Neveras por encima de ${fmt(TEMP_MAX_NEVERA, 1)} °C`}>
      {!filas.length ? (
        <p className="flex items-center gap-2 py-2 text-sm text-ok">
          <span aria-hidden>✓</span> Todas las temperaturas registradas están en rango.
        </p>
      ) : (
        <ul className="divide-y divide-black/5">
          {filas.map((f, i) => (
            <li
              key={`${f.pdvNombre}-${f.fecha}-${i}`}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{f.pdvNombre}</span>
                <span className="text-xs text-tinta-tenue">{fechaCorta(f.fecha)}</span>
              </span>
              <Chip tono="error">
                <Thermometer className="h-3.5 w-3.5" aria-hidden /> ✕ {fmt(f.temp, 1)} °C
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ───────── Check-ins GPS ───────── */

function distancia(m: number | null) {
  if (m === null) return '–';
  return m >= 1000 ? `${fmt(m / 1000, 1)} km` : `${fmt(m, 0)} m`;
}

function EstadoCheckin({ d }: { d: boolean | null }) {
  if (d === true) return <Chip tono="ok">✓ En el punto</Chip>;
  if (d === false) return <Chip tono="error">✕ Fuera de rango</Chip>;
  return <Chip>· Punto sin ubicación</Chip>;
}

export function TablaCheckins({ t }: { t: TableroResponse }) {
  const [soloFuera, setSoloFuera] = useState(false);
  const filas = useMemo(
    () =>
      [...t.checkins]
        .filter((c) => !soloFuera || c.dentroDeRango === false)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [t, soloFuera],
  );
  const fuera = t.checkins.filter((c) => c.dentroDeRango === false).length;
  const cols: Columna<(typeof filas)[number]>[] = [
    {
      clave: 'quien',
      titulo: 'Persona y punto',
      principal: true,
      celda: (c) => (
        <span>
          {c.impulsadoraNombre}{' '}
          <span className="font-normal text-tinta-suave">· {c.pdvNombre}</span>
        </span>
      ),
    },
    { clave: 'fecha', titulo: 'Fecha', celda: (c) => `${fechaCorta(c.fecha)} · ${c.turno}` },
    {
      clave: 'dist',
      titulo: 'Distancia al punto',
      num: true,
      celda: (c) => distancia(c.distanciaPdvM),
    },
    { clave: 'estado', titulo: 'Estado', celda: (c) => <EstadoCheckin d={c.dentroDeRango} /> },
    {
      clave: 'mapa',
      titulo: 'Mapa',
      celda: (c) => (
        <a
          href={urlMapa(c.lat, c.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-marca-700 underline-offset-2 hover:underline"
          aria-label={`Ver en mapa el check-in de ${c.impulsadoraNombre} en ${c.pdvNombre}`}
        >
          Ver en mapa <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ),
    },
  ];
  return (
    <Tarjeta titulo="Check-ins con GPS">
      <p className={clsx('-mt-1 mb-3 text-sm', fuera ? 'text-error' : 'text-tinta-suave')}>
        {t.checkins.length
          ? `${fmt(t.checkins.length, 0)} check-in${t.checkins.length === 1 ? '' : 's'} · ${fuera ? `✕ ${fuera} fuera de rango` : '✓ todos dentro del rango o sin ubicación del punto'}`
          : 'No hay check-ins en este rango.'}
      </p>
      {fuera > 0 && (
        <div className="mb-3">
          <Interruptor
            etiqueta="Ver solo los fuera de rango"
            activo={soloFuera}
            onChange={setSoloFuera}
          />
        </div>
      )}
      {t.checkins.length > 0 && (
        <TablaResponsiva
          etiqueta="Check-ins con GPS"
          columnas={cols}
          filas={filas}
          clave={(c) => c.registroId}
        />
      )}
    </Tarjeta>
  );
}
