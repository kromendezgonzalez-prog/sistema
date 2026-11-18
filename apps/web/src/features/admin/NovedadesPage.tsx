import { hoyBogota, type Foto, type NovedadesResponse, type NovedadFila } from '@merca/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  Images,
  MapPin,
  Package,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton, Chip, Encabezado, Pildoras, Vacio } from '@/components/ui';
import { useTemaAyuda } from '@/components/ayuda/Ayuda';
import { api } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { fechaCorta, fmt } from '@/lib/formato';
import {
  claveDeTexto,
  esClaveRango,
  fechasRango,
  RANGOS,
  textoRango,
  type ClaveRango,
} from '@/features/tablero/rango';
import { ErrorCarga, Esqueleto, miniaturaCloudinary, Pagina, plural, Selector } from './comun';

const RANGO_DEF: ClaveRango = '30';

export default function NovedadesPage() {
  useTemaAyuda('novedades');
  const cfg = useConfig();
  const [sp, setSp] = useSearchParams();
  const pr = sp.get('rango');
  const rango: ClaveRango = esClaveRango(pr) ? pr : RANGO_DEF;
  const pdvId = sp.get('punto') ?? '';
  const tipo = sp.get('tipo') ?? '';
  const { desde, hasta } = fechasRango(rango, hoyBogota());
  const [visor, setVisor] = useState<{ fila: NovedadFila; i: number } | null>(null);

  const cambiar = (k: string, v: string, def = '') => {
    const n = new URLSearchParams(sp);
    if (v && v !== def) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };

  const q = useInfiniteQuery({
    queryKey: ['admin', 'novedades', desde, hasta, pdvId || null, tipo || null],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<NovedadesResponse>('/admin/novedades', {
        query: {
          desde,
          hasta,
          pdvId: pdvId || undefined,
          tipo: tipo || undefined,
          pagina: pageParam,
        },
      }),
    getNextPageParam: (u) => (u.pagina * u.porPagina < u.total ? u.pagina + 1 : undefined),
  });

  const filas = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;

  const opcionesPunto = useMemo(
    () => [
      { valor: '', texto: 'Todos los puntos' },
      ...(cfg.data?.pdvs ?? [])
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((p) => ({ valor: p._id, texto: p.nombre })),
    ],
    [cfg.data],
  );
  const opcionesTipo = useMemo(
    () => [
      { valor: '', texto: 'Todos los tipos' },
      ...(cfg.data?.config.novedadesProducto ?? []).map((t) => ({ valor: t, texto: t })),
    ],
    [cfg.data],
  );

  return (
    <Pagina>
      <Encabezado
        titulo="Galería de novedades"
        subtitulo="Fotos de producto con novedad reportadas por el equipo"
      />

      <div className="tarjeta flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <Pildoras
          etiqueta="Periodo"
          opciones={RANGOS.map((r) => r.texto)}
          valor={textoRango(rango)}
          onChange={(v) => cambiar('rango', claveDeTexto(v), RANGO_DEF)}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[32rem]">
          <Selector
            etiqueta="Punto de venta"
            valor={pdvId}
            onChange={(v) => cambiar('punto', v)}
            opciones={opcionesPunto}
          />
          <Selector
            etiqueta="Tipo de novedad"
            valor={tipo}
            onChange={(v) => cambiar('tipo', v)}
            opciones={opcionesTipo}
          />
        </div>
      </div>

      {q.isPending ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          role="status"
          aria-label="Cargando novedades"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <Esqueleto key={i} className="h-80" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorCarga
          error={q.error}
          onReintentar={() => q.refetch()}
          titulo="No se pudieron cargar las novedades"
        />
      ) : !filas.length ? (
        <div className="tarjeta">
          <Vacio
            icono={<Images className="h-12 w-12" />}
            titulo="No hay novedades con estos filtros"
            texto="Prueba con un periodo más largo o con otro punto o tipo."
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-tinta-suave" aria-live="polite">
            {plural(total, 'novedad', 'novedades')} · mostrando {filas.length}
          </p>
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Novedades"
          >
            {filas.map((n, i) => (
              <motion.li
                key={`${n.registroId}-${n.cod}-${n.loteId}-${n.momento}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i % 24, 12) * 0.02 }}
              >
                <TarjetaNovedad
                  n={n}
                  unidad={cfg.productosPorCod[n.cod]?.unidad}
                  onFoto={(k) => setVisor({ fila: n, i: k })}
                />
              </motion.li>
            ))}
          </ul>
          {q.hasNextPage && (
            <div className="text-center">
              <Boton
                variante="secundario"
                onClick={() => q.fetchNextPage()}
                cargando={q.isFetchingNextPage}
              >
                Ver más novedades
              </Boton>
            </div>
          )}
        </>
      )}

      <Visor
        estado={visor}
        onCambiar={(i) => setVisor((v) => (v ? { ...v, i } : v))}
        onCerrar={() => setVisor(null)}
      />
    </Pagina>
  );
}

function TarjetaNovedad({
  n,
  unidad,
  onFoto,
}: {
  n: NovedadFila;
  unidad?: string;
  onFoto: (i: number) => void;
}) {
  const foto = n.fotos[0];
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-xl2 bg-white shadow-tarjeta"
      aria-label={`${n.tipo}: ${n.producto}`}
    >
      {foto ? (
        <button
          type="button"
          onClick={() => onFoto(0)}
          className="group relative block aspect-[4/3] overflow-hidden bg-black/5"
          aria-label={`Ver foto de ${n.producto} en pantalla completa`}
        >
          <img
            src={miniaturaCloudinary(foto.url)}
            alt={`${n.tipo} · ${n.producto}`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          {n.fotos.length > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
              <Images className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {n.fotos.length}
            </span>
          )}
        </button>
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-black/[.04] text-tinta-tenue">
          <span className="flex flex-col items-center gap-1 text-sm">
            <ImageOff className="h-8 w-8" aria-hidden /> Sin foto
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip tono="error">! {n.tipo}</Chip>
          <Chip>{n.momento === 'llegada' ? 'Al llegar' : 'Al cierre'}</Chip>
        </div>
        <p className="flex items-start gap-1.5 font-semibold leading-tight text-tinta">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-marca-600" aria-hidden />
          <span>
            {n.producto}{' '}
            <span className="font-mono text-xs font-normal text-tinta-tenue">{n.cod}</span>
          </span>
        </p>
        <p className="text-sm text-tinta-suave">
          Lote: {fmt(n.cantidad, unidad === 'und' ? 0 : 2)} {unidad ?? ''} ·{' '}
          {n.vto ? `vence ${fechaCorta(n.vto)}` : 'sin fecha'}
        </p>
        {n.nota && (
          <p className="rounded-lg bg-fondo px-2 py-1.5 text-sm italic text-tinta">“{n.nota}”</p>
        )}
        <div className="mt-auto space-y-0.5 border-t border-black/5 pt-2 text-xs text-tinta-tenue">
          <p className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {n.pdvNombre}
          </p>
          <p className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" aria-hidden /> {n.impulsadoraNombre}
          </p>
          <p className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {fechaCorta(n.fecha)} · {n.turno}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ───────── Visor de fotos a pantalla completa ───────── */

function Visor({
  estado,
  onCambiar,
  onCerrar,
}: {
  estado: { fila: NovedadFila; i: number } | null;
  onCambiar: (i: number) => void;
  onCerrar: () => void;
}) {
  const cerrar = useRef<HTMLButtonElement>(null);
  const fotos: Foto[] = estado?.fila.fotos ?? [];
  const i = estado?.i ?? 0;
  const mover = useCallback(
    (d: number) => fotos.length > 1 && onCambiar((i + d + fotos.length) % fotos.length),
    [fotos.length, i, onCambiar],
  );

  useEffect(() => {
    if (!estado) return;
    cerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', tecla);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = prev;
    };
  }, [estado, mover, onCerrar]);

  return (
    <AnimatePresence>
      {estado && fotos[i] && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${estado.fila.producto}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between gap-2 p-3 text-white">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {estado.fila.tipo} · {estado.fila.producto}
              </p>
              <p className="truncate text-sm text-white/70">
                {estado.fila.pdvNombre} · {fechaCorta(estado.fila.fecha)}
                {fotos.length > 1 && ` · foto ${i + 1} de ${fotos.length}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={fotos[i].url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"
                aria-label="Abrir foto original en otra pestaña"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
              <button
                ref={cerrar}
                type="button"
                onClick={onCerrar}
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"
                aria-label="Cerrar foto"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-2"
            onClick={onCerrar}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={fotos[i].url}
                src={fotos[i].url}
                alt={`${estado.fila.tipo} · ${estado.fila.producto}`}
                className="max-h-full max-w-full rounded-lg object-contain"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              />
            </AnimatePresence>
            {fotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(-1);
                  }}
                  className="absolute left-2 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(1);
                  }}
                  className="absolute right-2 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {estado.fila.nota && (
            <p className="p-3 text-center text-sm italic text-white/80">“{estado.fila.nota}”</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
