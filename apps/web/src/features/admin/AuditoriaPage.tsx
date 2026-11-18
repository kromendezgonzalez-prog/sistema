import { hoyBogota, sumarDias, type AuditoriaResponse, type EventoAuditoria } from '@merca/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ScrollText,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Boton, Campo, Chip, Encabezado, Vacio } from '@/components/ui';
import { useTemaAyuda } from '@/components/ayuda/Ayuda';
import { api } from '@/lib/api';
import { fechaHora, fmt } from '@/lib/formato';
import {
  Buscador,
  ErrorCarga,
  EsqueletoLista,
  Pagina,
  Selector,
  urlMapa,
  useDebounce,
} from './comun';
import {
  accionesPorGrupo,
  etiquetaCampo,
  infoAccion,
  valorLegible,
  type TonoAccion,
} from './auditoria';
import { ROL_TEXTO, useUsuariosAdmin } from './datos';

const POR_PAGINA = 25;

const CIRCULO: Record<TonoAccion, string> = {
  neutro: 'bg-black/5 text-tinta-suave',
  ok: 'bg-ok-bg text-ok',
  aviso: 'bg-aviso-bg text-aviso',
  error: 'bg-error-bg text-error',
  marca: 'bg-marca-50 text-marca-700',
};

/** "Mozilla/5.0 (Linux; Android 13; …) Chrome/120…" → "Android · Chrome" */
export function dispositivoLegible(ua: string | null): string {
  if (!ua) return '—';
  const so = /iPhone|iPad/.test(ua)
    ? 'iPhone/iPad'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  const nav = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  return [so, nav].filter(Boolean).join(' · ') || ua.slice(0, 60);
}

export default function AuditoriaPage() {
  useTemaAyuda('admin.auditoria');
  const hoy = hoyBogota();
  const [desde, setDesde] = useState(sumarDias(hoy, -6));
  const [hasta, setHasta] = useState(hoy);
  const [usuarioId, setUsuarioId] = useState('');
  const [accion, setAccion] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const q = useDebounce(texto.trim(), 400);
  const usuarios = useUsuariosAdmin();
  const idAccion = useId();

  const filtros = { desde, hasta, usuarioId, accion, q };
  const consulta = useQuery({
    queryKey: ['admin', 'auditoria', filtros, pagina],
    queryFn: () =>
      api<AuditoriaResponse>('/admin/auditoria', {
        query: {
          desde,
          hasta,
          usuarioId: usuarioId || undefined,
          accion: accion || undefined,
          q: q || undefined,
          pagina,
          porPagina: POR_PAGINA,
        },
      }),
    placeholderData: keepPreviousData,
    enabled: !!desde && !!hasta && desde <= hasta,
  });

  const cambiar =
    <T,>(f: (v: T) => void) =>
    (v: T) => {
      f(v);
      setPagina(1);
    };

  const opcionesUsuario = useMemo(
    () => [
      { valor: '', texto: 'Todas las personas' },
      ...(usuarios.data ?? [])
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((u) => ({ valor: u._id, texto: `${u.nombre} (${u.usuario})` })),
    ],
    [usuarios.data],
  );

  const d = consulta.data;
  const totalPaginas = d ? Math.max(1, Math.ceil(d.total / d.porPagina)) : 1;
  const rangoMal = desde > hasta;

  return (
    <Pagina>
      <Encabezado
        titulo="Auditoría"
        subtitulo="Todo lo que pasa en la app. Solo lo ve administración y no se puede editar ni borrar."
      />

      <div className="tarjeta space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            etiqueta="Desde"
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => cambiar(setDesde)(e.target.value)}
            error={rangoMal ? 'Debe ser antes de “Hasta”' : null}
          />
          <Campo
            etiqueta="Hasta"
            type="date"
            value={hasta}
            max={hoy}
            onChange={(e) => cambiar(setHasta)(e.target.value)}
          />
          <Selector
            etiqueta="Persona"
            valor={usuarioId}
            onChange={cambiar(setUsuarioId)}
            opciones={opcionesUsuario}
          />
          <div>
            <label htmlFor={idAccion} className="etiqueta">
              Acción
            </label>
            <div className="relative">
              <select
                id={idAccion}
                value={accion}
                onChange={(e) => cambiar(setAccion)(e.target.value)}
                className="campo cursor-pointer appearance-none pr-10"
              >
                <option value="">Todas las acciones</option>
                {accionesPorGrupo().map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.acciones.map((a) => (
                      <option key={a.valor} value={a.valor}>
                        {a.texto}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-tenue"
                aria-hidden
              />
            </div>
          </div>
        </div>
        <Buscador
          valor={texto}
          onChange={cambiar(setTexto)}
          placeholder="Buscar en el resumen (ej.: Mercacentro, contraseña…)"
          etiqueta="Buscar en la auditoría"
        />
      </div>

      {consulta.isPending && !rangoMal ? (
        <EsqueletoLista filas={8} />
      ) : consulta.isError && !d ? (
        <ErrorCarga
          error={consulta.error}
          onReintentar={() => consulta.refetch()}
          titulo="No se pudo cargar la auditoría"
        />
      ) : !d || !d.items.length ? (
        <div className="tarjeta">
          <Vacio
            icono={<ScrollText className="h-12 w-12" />}
            titulo="Sin eventos"
            texto="No hay eventos con estos filtros. Prueba con otras fechas o quita filtros."
          />
        </div>
      ) : (
        <div
          className={clsx(
            'space-y-3 transition-opacity',
            consulta.isPlaceholderData && 'opacity-60',
          )}
          aria-busy={consulta.isFetching}
        >
          <p className="text-sm text-tinta-suave" aria-live="polite">
            {fmt(d.total, 0)} evento{d.total === 1 ? '' : 's'} · página {d.pagina} de {totalPaginas}
          </p>
          <ul
            className="overflow-hidden rounded-xl2 bg-white shadow-tarjeta"
            aria-label="Eventos de auditoría"
          >
            {d.items.map((ev) => (
              <FilaEvento key={ev._id} ev={ev} />
            ))}
          </ul>
          {totalPaginas > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
              <Boton
                variante="secundario"
                tam="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
                icono={<ChevronLeft className="h-4 w-4" />}
              >
                Anterior
              </Boton>
              <span className="text-sm text-tinta-suave">
                {d.pagina} / {totalPaginas}
              </span>
              <Boton
                variante="secundario"
                tam="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente <ChevronRight className="h-4 w-4" aria-hidden />
              </Boton>
            </nav>
          )}
        </div>
      )}
    </Pagina>
  );
}

function FilaEvento({ ev }: { ev: EventoAuditoria }) {
  const [abierto, setAbierto] = useState(false);
  const info = infoAccion(ev.accion);
  const idDet = useId();
  const cambios = ev.cambios ? Object.entries(ev.cambios) : [];
  return (
    <li className="border-b border-black/5 last:border-0">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idDet}
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-marca-50/40"
      >
        <span
          className={clsx(
            'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full',
            CIRCULO[info.tono],
          )}
          aria-hidden
        >
          <info.Icono className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Chip tono={info.tono}>{info.etiqueta}</Chip>
            <span className="text-xs text-tinta-tenue">{fechaHora(ev.en)}</span>
          </span>
          <span className="mt-1 block text-[15px] font-medium leading-snug text-tinta">
            {ev.resumen || info.etiqueta}
          </span>
          <span className="block text-sm text-tinta-suave">
            {ev.usuarioNombre || 'Sistema'}
            {ev.rol && ` · ${ROL_TEXTO[ev.rol as keyof typeof ROL_TEXTO] ?? ev.rol}`}
          </span>
        </span>
        <ChevronDown
          className={clsx(
            'mt-2 h-5 w-5 shrink-0 text-tinta-tenue transition-transform',
            abierto && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            id={idDet}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 bg-fondo/70 px-4 pb-4 pt-1 sm:pl-16">
              {cambios.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                    Cambios
                  </p>
                  <ul className="space-y-1.5">
                    {cambios.map(([campo, c]) => (
                      <li
                        key={campo}
                        className="rounded-lg bg-white p-2 text-sm ring-1 ring-black/5"
                      >
                        <p className="font-semibold text-tinta">{etiquetaCampo(campo)}</p>
                        <div className="mt-0.5 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                          <span className="min-w-0 whitespace-pre-wrap break-words rounded bg-error-bg/60 px-1.5 text-tinta-suave line-through decoration-error/40">
                            {valorLegible(c.antes)}
                          </span>
                          <ArrowRight
                            className="hidden h-4 w-4 shrink-0 text-tinta-tenue sm:mt-0.5 sm:block"
                            aria-label="cambió a"
                          />
                          <span className="min-w-0 whitespace-pre-wrap break-words rounded bg-ok-bg px-1.5 font-medium text-tinta">
                            {valorLegible(c.despues)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                {ev.entidad && (
                  <div>
                    <dt className="text-xs text-tinta-tenue">Sobre</dt>
                    <dd className="break-all text-tinta">
                      {ev.entidad}
                      {ev.entidadId && (
                        <span className="font-mono text-xs text-tinta-suave">
                          {' '}
                          · {ev.entidadId}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-tinta-tenue">Fecha y hora</dt>
                  <dd className="text-tinta">{fechaHora(ev.en)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-tinta-tenue">IP</dt>
                  <dd className="font-mono text-tinta">{ev.ip ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-tinta-tenue">Dispositivo</dt>
                  <dd className="text-tinta" title={ev.dispositivo ?? undefined}>
                    {dispositivoLegible(ev.dispositivo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-tinta-tenue">Ubicación</dt>
                  <dd>
                    {ev.geo ? (
                      <a
                        href={urlMapa(ev.geo.lat, ev.geo.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-marca-700 hover:underline"
                      >
                        Ver en mapa <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-tinta">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
