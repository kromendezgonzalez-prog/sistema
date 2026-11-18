import {
  hoyBogota,
  METAS_DEF,
  RIESGO_DEF,
  type Metas,
  type TableroResponse,
  type UmbralesRiesgo,
} from '@merca/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertOctagon, BarChart3, BookOpen, Download, RefreshCw, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Aviso, Boton, Encabezado, Pildoras, Tarjeta, Vacio } from '@/components/ui';
import { useTemaAyuda } from '@/components/ayuda/Ayuda';
import { api, descargar, mensajeError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { fechaCorta, fmt } from '@/lib/formato';
import { ErrorCarga, Esqueleto, Pagina, Selector } from '@/features/admin/comun';
import { construirKpis, GRUPOS_KPI } from './kpis';
import {
  claveDeTexto,
  esClaveRango,
  fechasRango,
  RANGO_DEF,
  RANGOS,
  textoRango,
  type ClaveRango,
} from './rango';
import { KpiTarjeta } from './componentes/KpiTarjeta';
import { RiesgoPorNivel } from './componentes/Riesgo';
import { GraficoSellout, GraficoTopReferencias } from './componentes/Graficos';
import {
  TablaCheckins,
  TablaCompetencia,
  TablaCumplimiento,
  TablaPorImpulsadora,
  TablaPorPdv,
  TablaReferencias,
  TarjetaNeveras,
  TarjetaNovedades,
} from './componentes/Tablas';

const SECCIONES = [
  { id: 'kpis', texto: 'Indicadores' },
  { id: 'riesgo', texto: 'Vencimientos' },
  { id: 'graficos', texto: 'Gráficos' },
  { id: 'equipo', texto: 'Reporte' },
  { id: 'puntos', texto: 'Puntos' },
  { id: 'referencias', texto: 'Referencias' },
  { id: 'mercado', texto: 'Competencia y novedades' },
  { id: 'checkins', texto: 'Check-ins' },
];

export default function TableroPage() {
  useTemaAyuda('tablero');
  const { usuario, tieneRol } = useAuth();
  const esEquipo = tieneRol('admin', 'supervisor');
  const cfg = useConfig();
  const metas = cfg.data?.config.metas ?? METAS_DEF;
  const umbrales = cfg.data?.config.riesgoVto ?? RIESGO_DEF;

  const [sp, setSp] = useSearchParams();
  const pr = sp.get('rango');
  const rango: ClaveRango = esClaveRango(pr) ? pr : RANGO_DEF;
  const persona = esEquipo ? (sp.get('persona') ?? '') : '';
  const punto = esEquipo ? (sp.get('punto') ?? '') : '';
  const hoy = hoyBogota();
  const { desde, hasta } = fechasRango(rango, hoy);

  const cambiar = (k: string, v: string, def = '') => {
    const n = new URLSearchParams(sp);
    if (v && v !== def) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };

  const q = useQuery({
    queryKey: ['tablero', desde, hasta, persona || null, punto || null],
    queryFn: () =>
      api<TableroResponse>('/tablero', {
        query: { desde, hasta, impulsadoraId: persona || undefined, pdvId: punto || undefined },
      }),
    placeholderData: keepPreviousData,
    enabled: !!usuario,
  });

  const opcionesPersona = useMemo(
    () => [
      { valor: '', texto: 'Todo el equipo' },
      ...(cfg.data?.equipo ?? [])
        .filter((e) => e.rol === 'impulsadora')
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((e) => ({ valor: e._id, texto: e.activo ? e.nombre : `${e.nombre} (inactiva)` })),
    ],
    [cfg.data],
  );
  const opcionesPunto = useMemo(
    () => [
      { valor: '', texto: 'Todos los puntos' },
      ...(cfg.data?.pdvs ?? [])
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((p) => ({ valor: p._id, texto: p.ciudad ? `${p.nombre} · ${p.ciudad}` : p.nombre })),
    ],
    [cfg.data],
  );

  const [descargando, setDescargando] = useState(false);
  const descargarExcel = async () => {
    setDescargando(true);
    try {
      await descargar('/export', `mercaimpulso-${desde}-a-${hasta}.xlsx`, { desde, hasta });
      toast.success('Excel descargado', {
        description: `Registros del ${fechaCorta(desde)} al ${fechaCorta(hasta)}.`,
      });
    } catch (e) {
      toast.error('No se pudo descargar el Excel', { description: mensajeError(e) });
    } finally {
      setDescargando(false);
    }
  };

  const t = q.data;

  return (
    <Pagina>
      <Encabezado
        titulo={esEquipo ? 'Tablero del equipo' : 'Mi tablero'}
        subtitulo={`${fechaCorta(desde)}${desde !== hasta ? ` – ${fechaCorta(hasta)}` : ''} · ${textoRango(rango)}`}
        accion={
          <Link
            to="/indicadores"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-marca-700 hover:bg-marca-50"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">¿Cómo se calculan?</span>
            <span className="sm:hidden">Indicadores</span>
          </Link>
        }
      />

      {/* ── Filtros (se guardan en la URL) ── */}
      <Tarjeta>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <Pildoras
            etiqueta="Periodo"
            opciones={RANGOS.map((r) => r.texto)}
            valor={textoRango(rango)}
            onChange={(v) => cambiar('rango', claveDeTexto(v), RANGO_DEF)}
          />
          {esEquipo && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end xl:min-w-[40rem]">
              <Selector
                etiqueta="Mercaimpulsadora"
                valor={persona}
                onChange={(v) => cambiar('persona', v)}
                opciones={opcionesPersona}
              />
              <Selector
                etiqueta="Punto de venta"
                valor={punto}
                onChange={(v) => cambiar('punto', v)}
                opciones={opcionesPunto}
              />
              <Boton
                variante="secundario"
                onClick={descargarExcel}
                cargando={descargando}
                icono={<Download className="h-5 w-5" />}
              >
                Descargar Excel
              </Boton>
            </div>
          )}
        </div>
        {(persona || punto) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tinta-suave">
            Filtrando por
            {persona && (
              <b className="text-tinta">
                {opcionesPersona.find((o) => o.valor === persona)?.texto ?? 'persona'}
              </b>
            )}
            {persona && punto && 'y'}
            {punto && (
              <b className="text-tinta">
                {opcionesPunto.find((o) => o.valor === punto)?.texto ?? 'punto'}
              </b>
            )}
            <button
              type="button"
              className="rounded-full px-2 py-1 font-semibold text-marca-700 hover:bg-marca-50"
              onClick={() => {
                const n = new URLSearchParams(sp);
                n.delete('persona');
                n.delete('punto');
                setSp(n, { replace: true });
              }}
            >
              Quitar filtros
            </button>
          </div>
        )}
      </Tarjeta>

      {q.isPending ? (
        <EsqueletoTablero />
      ) : q.isError && !t ? (
        <ErrorCarga
          error={q.error}
          onReintentar={() => q.refetch()}
          titulo="No se pudo cargar el tablero"
        />
      ) : t ? (
        <div
          className={clsx('space-y-4 transition-opacity', q.isPlaceholderData && 'opacity-60')}
          aria-busy={q.isFetching}
        >
          {q.isFetching && (
            <p className="flex items-center gap-2 text-sm text-tinta-tenue" role="status">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Actualizando…
            </p>
          )}
          {q.isError && (
            <Aviso tono="error" titulo="No se pudieron traer datos nuevos">
              Se muestran los últimos datos cargados. {mensajeError(q.error)}{' '}
              <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>
                Reintentar
              </button>
            </Aviso>
          )}
          <ContenidoTablero
            t={t}
            esEquipo={esEquipo}
            filtroPersona={!!persona}
            hoyEnRango={hasta === hoy}
            metas={metas}
            umbrales={umbrales}
          />
        </div>
      ) : null}
    </Pagina>
  );
}

export function ContenidoTablero({
  t,
  esEquipo,
  filtroPersona,
  hoyEnRango,
  metas,
  umbrales,
}: {
  t: TableroResponse;
  esEquipo: boolean;
  filtroPersona: boolean;
  hoyEnRango: boolean;
  metas: Metas;
  umbrales: UmbralesRiesgo;
}) {
  const kpis = useMemo(() => construirKpis(t, metas), [t, metas]);
  const r = t.resumen;
  const pn = t.riesgo.porNivel;
  const urgentes = pn.vencido.lotes + pn.emergencia.lotes;
  const kgUrgentes = pn.vencido.kg + pn.emergencia.kg;
  const sinHoy = hoyEnRango && esEquipo ? t.cumplimiento.filter((c) => !c.reportoHoy) : [];

  const banners = (
    <>
      {urgentes > 0 && (
        <a
          href="#riesgo"
          className="block rounded-xl transition hover:brightness-[.98]"
          data-testid="banner-riesgo"
        >
          <Aviso
            tono="error"
            icono={<AlertOctagon className="h-5 w-5" />}
            titulo={`${urgentes} lote${urgentes === 1 ? '' : 's'} vencido${urgentes === 1 ? '' : 's'} o en emergencia (≈ ${fmt(kgUrgentes, 1)} kg)`}
          >
            {pn.vencido.lotes > 0 &&
              `⛔ ${pn.vencido.lotes} vencido${pn.vencido.lotes === 1 ? '' : 's'}: retiro inmediato. `}
            {pn.emergencia.lotes > 0 &&
              `✕ ${pn.emergencia.lotes} en emergencia: gestionar la salida hoy. `}
            <span className="font-semibold underline">Ver lista de acción</span>
          </Aviso>
        </a>
      )}
      {sinHoy.length > 0 && (
        <Aviso tono="aviso" icono={<UserX className="h-5 w-5" />} titulo="Sin registro hoy">
          {sinHoy.map((c) => c.nombre).join(', ')}.
        </Aviso>
      )}
      {r.inconsistencias > 0 && (
        <Aviso
          tono="aviso"
          titulo={`! ${r.inconsistencias} fila${r.inconsistencias === 1 ? '' : 's'} con venta negativa`}
        >
          Se excluyeron de los cálculos. Revísalas con la persona que registró.
        </Aviso>
      )}
    </>
  );

  if (r.registros === 0) {
    return (
      <>
        {banners}
        <Tarjeta>
          <Vacio
            icono={<BarChart3 className="h-12 w-12" />}
            titulo="No hay registros en este rango"
            texto="Prueba con un periodo más largo o quita los filtros de persona y punto."
          />
        </Tarjeta>
        {esEquipo && <TablaCumplimiento t={t} />}
      </>
    );
  }

  return (
    <>
      {banners}

      <nav
        aria-label="Secciones del tablero"
        className="-mx-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0"
      >
        <ul className="flex gap-2 whitespace-nowrap">
          {SECCIONES.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-[36px] items-center rounded-full bg-white px-3 text-sm font-medium text-tinta-suave shadow-tarjeta ring-1 ring-black/5 hover:text-marca-700"
              >
                {s.texto}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── KPIs ── */}
      <section id="kpis" className="scroll-mt-20 space-y-4" aria-label="Indicadores">
        {GRUPOS_KPI.map((g) => (
          <div key={g.id}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-tinta">{g.titulo}</h2>
              <p className="hidden text-xs text-tinta-tenue sm:block">{g.descripcion}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {kpis
                .filter((k) => k.grupo === g.id)
                .map((k, i) => (
                  <KpiTarjeta key={k.id} k={k} indice={i} />
                ))}
            </div>
          </div>
        ))}
      </section>

      <section id="riesgo" className="scroll-mt-20">
        <RiesgoPorNivel t={t} umbrales={umbrales} />
      </section>

      <section id="graficos" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <GraficoSellout t={t} />
        <GraficoTopReferencias t={t} />
      </section>

      <section
        id="equipo"
        className={clsx('grid scroll-mt-20 gap-4', esEquipo && !filtroPersona && 'xl:grid-cols-2')}
      >
        <TablaCumplimiento
          t={t}
          titulo={esEquipo ? 'Cumplimiento de reporte' : 'Mi cumplimiento de reporte'}
        />
        {esEquipo && !filtroPersona && <TablaPorImpulsadora t={t} M={metas} />}
      </section>

      <section id="puntos" className="scroll-mt-20">
        <TablaPorPdv t={t} M={metas} />
      </section>

      <section id="referencias" className="scroll-mt-20">
        <TablaReferencias t={t} M={metas} />
      </section>

      <section id="mercado" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <TablaCompetencia t={t} />
        <div className="space-y-4">
          <TarjetaNovedades t={t} conGaleria={esEquipo} />
          <TarjetaNeveras t={t} />
        </div>
      </section>

      <section id="checkins" className="scroll-mt-20">
        <TablaCheckins t={t} />
      </section>
    </>
  );
}

function EsqueletoTablero() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando tablero">
      <span className="sr-only">Cargando tablero…</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Esqueleto key={i} className="h-36" />
        ))}
      </div>
      <Esqueleto className="h-56" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Esqueleto className="h-72" />
        <Esqueleto className="h-72" />
      </div>
      <Esqueleto className="h-64" />
    </div>
  );
}
