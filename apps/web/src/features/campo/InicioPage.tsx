import {
  DIAS_EDICION,
  hoyBogota,
  INFO_NIVEL,
  riesgosItem,
  sumarDias,
  type NivelRiesgo,
  type Paginado,
  type Pdv,
  type Registro,
  type UltimoInventarioResponse,
} from '@merca/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  AlertOctagon,
  ChevronRight,
  CloudOff,
  ClipboardCheck,
  Pencil,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Store,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AyudaEnLinea, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { Boton, Cargando, Chip, NivelChip, Tarjeta, Vacio } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { db } from '@/offline/db';
import { useCola } from '@/offline/sincronizador';
import { estadoCierre } from './registro/modelo';
import { marcarTourVisto, TourBienvenida, tourVisto } from './TourBienvenida';
import { cantidadTxt, fechaLarga, nombreProducto, ordenTurno, puntosDisponibles, saludo, turnoPorHora } from './util';

type EstadoTurno = { turno: string; tipo: 'completo' | 'falta-cierre' | 'no-laboral' | 'pendiente' | 'error' | 'borrador' };

const ESTILO_ESTADO: Record<EstadoTurno['tipo'], { texto: string; tono: 'ok' | 'aviso' | 'error' | 'neutro' | 'marca' }> = {
  completo: { texto: 'Completo ✓', tono: 'ok' },
  'falta-cierre': { texto: 'Falta cierre', tono: 'aviso' },
  'no-laboral': { texto: 'Registrado ✓', tono: 'ok' },
  pendiente: { texto: 'Sin enviar ⏳', tono: 'aviso' },
  error: { texto: 'Con error ✕', tono: 'error' },
  borrador: { texto: 'En progreso ✎', tono: 'marca' },
};

function TarjetaPunto({
  pdv,
  estados,
  hoy,
  i,
}: {
  pdv: Pdv;
  estados: EstadoTurno[];
  hoy: string;
  i: number;
}) {
  const nav = useNavigate();
  const sugerido = turnoPorHora();
  const abierto = estados.find((e) => e.tipo === 'falta-cierre' || e.tipo === 'borrador');
  const destino = abierto?.turno ?? sugerido;
  const url = `/registrar?pdvId=${encodeURIComponent(pdv._id)}&fecha=${hoy}&turno=${encodeURIComponent(destino)}`;
  const textoBoton =
    abierto?.tipo === 'falta-cierre'
      ? `Completar cierre · ${abierto.turno}`
      : abierto?.tipo === 'borrador'
        ? `Continuar conteo · ${abierto.turno}`
        : 'Iniciar conteo';

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="tarjeta"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-marca-50 text-marca-600">
          <Store className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight text-tinta">{pdv.nombre}</h3>
          <p className="text-sm text-tinta-tenue">{[pdv.cadena, pdv.ciudad].filter(Boolean).join(' · ') || 'Punto de venta'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {estados.length === 0 ? (
              <Chip>Pendiente hoy</Chip>
            ) : (
              estados.map((e) => (
                <Chip key={e.turno + e.tipo} tono={ESTILO_ESTADO[e.tipo].tono}>
                  {e.turno}: {ESTILO_ESTADO[e.tipo].texto}
                </Chip>
              ))
            )}
          </div>
        </div>
      </div>
      <Boton
        bloque
        tam="lg"
        className="mt-3"
        variante={abierto || estados.length === 0 ? 'primario' : 'secundario'}
        icono={abierto ? <Pencil className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
        onClick={() => nav(url)}
      >
        {textoBoton}
      </Boton>
    </motion.article>
  );
}

const ORDEN_NIVELES: NivelRiesgo[] = ['vencido', 'emergencia', 'critico', 'medio'];

function RiesgoPuntos({ puntos, hoy }: { puntos: Pdv[]; hoy: string }) {
  const cfg = useConfig();
  const umbrales = cfg.data?.config.riesgoVto;
  const [verTodos, setVerTodos] = useState(false);
  const manana = sumarDias(hoy, 1);
  const qs = useQueries({
    queries: puntos.slice(0, 8).map((p) => ({
      queryKey: ['registros', 'ultimo-inventario', p._id, manana],
      queryFn: () =>
        api<UltimoInventarioResponse>('/registros/ultimo-inventario', { query: { pdvId: p._id, fecha: manana, turno: 'Mañana' } }),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
  });
  const cargando = qs.some((q) => q.isLoading);
  const sinRed = qs.length > 0 && qs.every((q) => q.isError);

  const filas = useMemo(() => {
    const out: { key: string; pdv: string; cod: string; cantidad: number; nivel: NivelRiesgo; dias: number; fecha: string }[] = [];
    qs.forEach((q, i) => {
      const previo = q.data?.previo;
      if (!previo) return;
      for (const [cod, lotes] of Object.entries(previo.lotes ?? {}))
        for (const r of riesgosItem(cod, { lotesFin: lotes }, hoy, umbrales))
          out.push({ key: `${puntos[i]._id}-${cod}-${r.loteId}`, pdv: puntos[i].nombre, cod, cantidad: r.cantidad, nivel: r.nivel, dias: r.dias, fecha: previo.fecha });
    });
    return out.sort((a, b) => a.dias - b.dias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs.map((q) => q.dataUpdatedAt).join(','), hoy, umbrales]);

  const conteo = ORDEN_NIVELES.map((n) => ({ n, c: filas.filter((f) => f.nivel === n).length })).filter((x) => x.c > 0);
  const visibles = verTodos ? filas : filas.slice(0, 5);

  return (
    <Tarjeta
      titulo="Lotes en riesgo en tus puntos"
      accion={<AyudaEnLinea tema="niveles-riesgo" etiqueta="Qué significan los niveles de riesgo" />}
    >
      <p className="-mt-2 mb-3 text-sm text-tinta-suave">Según el último conteo de cada punto.</p>
      {cargando ? (
        <Cargando texto="Revisando vencimientos…" />
      ) : sinRed ? (
        <p className="flex items-center gap-2 rounded-xl bg-black/[.04] p-3 text-sm text-tinta-suave">
          <WifiOff className="h-4 w-4" aria-hidden /> Sin señal para revisar los vencimientos ahora.
        </p>
      ) : filas.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-ok-bg p-3 text-sm font-medium text-ok">
          <ShieldCheck className="h-5 w-5" aria-hidden /> Sin lotes en riesgo. ¡Muy bien!
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {conteo.map(({ n, c }) => (
              <span key={n} className="inline-flex items-center gap-1 text-sm font-semibold text-tinta-suave">
                <NivelChip nivel={n} /> ×{c}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-black/5">
            {visibles.map((f) => (
              <li key={f.key} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{nombreProducto(cfg.productosPorCod[f.cod], f.cod)}</p>
                  <p className="truncate text-xs text-tinta-tenue">
                    {f.pdv} · {cantidadTxt(f.cantidad, cfg.productosPorCod[f.cod])}
                  </p>
                </div>
                <NivelChip nivel={f.nivel} dias={f.dias} />
              </li>
            ))}
          </ul>
          {filas.length > 5 && (
            <Boton variante="fantasma" bloque onClick={() => setVerTodos((v) => !v)}>
              {verTodos ? 'Ver menos' : `Ver todos (${filas.length})`}
            </Boton>
          )}
          {filas.some((f) => f.nivel === 'vencido' || f.nivel === 'emergencia') && (
            <p className="mt-2 flex gap-2 rounded-xl bg-error-bg p-3 text-sm text-error">
              <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {INFO_NIVEL.emergencia.accion}
            </p>
          )}
        </>
      )}
    </Tarjeta>
  );
}

export default function InicioPage() {
  useTemaAyuda('inicio');
  const { usuario, sinConexion } = useAuth();
  const cfg = useConfig();
  const loc = useLocation();
  const nav = useNavigate();
  const hoy = hoyBogota();
  const [tour, setTour] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    if ((loc.state as { tour?: boolean } | null)?.tour || !tourVisto(usuario._id)) setTour(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?._id]);

  const cerrarTour = () => {
    if (usuario) marcarTourVisto(usuario._id);
    setTour(false);
    if ((loc.state as { tour?: boolean } | null)?.tour) nav('.', { replace: true, state: null });
  };

  const regsHoy = useQuery({
    queryKey: ['registros', 'hoy', usuario?._id, hoy],
    enabled: !!usuario,
    queryFn: () =>
      api<Paginado<Registro>>('/registros', {
        query: { desde: hoy, hasta: hoy, impulsadoraId: usuario?._id, porPagina: 50 },
      }),
    staleTime: 60_000,
  });
  const cola = useCola() ?? [];
  const borradores =
    useLiveQuery(
      () => (usuario ? db.borradores.where('usuarioId').equals(usuario._id).toArray() : []),
      [usuario?._id],
    ) ?? [];

  const { asignados, otros } = useMemo(() => puntosDisponibles(usuario, cfg.data?.pdvs ?? []), [usuario, cfg.data]);
  const puntos = asignados.length ? asignados : usuario?.rol === 'admin' ? [] : otros;

  const estadosPorPunto = useMemo(() => {
    const m: Record<string, Map<string, EstadoTurno>> = {};
    const poner = (pdvId: string, e: EstadoTurno) => {
      (m[pdvId] ??= new Map()).set(e.turno, e);
    };
    for (const r of regsHoy.data?.items ?? [])
      if (r.impulsadoraId === usuario?._id && r.fecha === hoy) poner(r.pdvId, { turno: r.turno, tipo: estadoCierre(r) });
    for (const c of cola)
      if (c.input.fecha === hoy) poner(c.input.pdvId, { turno: c.input.turno, tipo: c.estado === 'error' && c.errorDeDatos ? 'error' : 'pendiente' });
    for (const b of borradores)
      if (b.form.fecha === hoy && !m[b.form.pdvId]?.has(b.form.turno)) poner(b.form.pdvId, { turno: b.form.turno, tipo: 'borrador' });
    // un turno "sin enviar" que aún no tiene cierre se puede completar
    const out: Record<string, EstadoTurno[]> = {};
    for (const [k, v] of Object.entries(m)) out[k] = [...v.values()].sort((a, b) => ordenTurno(a.turno) - ordenTurno(b.turno));
    return out;
  }, [regsHoy.data, cola, borradores, hoy, usuario?._id]);

  if (!usuario) return null;
  const nombre = usuario.nombre.split(' ')[0];

  return (
    <div className="space-y-5 pb-8">
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-tinta-suave first-letter:uppercase">{fechaLarga(hoy)}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-tinta">
            {saludo()}, {nombre} 👋
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setTour(true)}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-marca-700 hover:bg-marca-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden /> Ver tour
        </button>
      </motion.header>

      {sinConexion && (
        <p className="flex items-center gap-2 rounded-xl bg-black/[.05] p-3 text-sm text-tinta-suave">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> Estás sin señal. Puedes registrar igual: todo se guarda en el
          celular.
        </p>
      )}

      {cola.length > 0 && (
        <Link
          to="/mis-registros"
          className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-aviso-bg px-4 py-3 text-aviso transition hover:brightness-95"
        >
          <CloudOff className="h-6 w-6 shrink-0" aria-hidden />
          <span className="flex-1 text-sm">
            <b>
              {cola.length} registro{cola.length === 1 ? '' : 's'} guardado{cola.length === 1 ? '' : 's'} en el celular
            </b>
            <br />
            Se envían solos cuando hay señal. Toca para ver.
          </span>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Link>
      )}

      <section aria-labelledby="mis-puntos" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="mis-puntos" className="text-lg font-bold">
            {asignados.length ? 'Mis puntos de venta' : 'Puntos de venta'}
          </h2>
          {regsHoy.isFetching && <span className="text-xs text-tinta-tenue">Actualizando…</span>}
        </div>

        {cfg.isLoading && !cfg.data ? (
          <Cargando texto="Cargando tus puntos…" />
        ) : puntos.length === 0 ? (
          <div className="tarjeta">
            <Vacio
              icono={<Store className="h-10 w-10" />}
              titulo={usuario.rol === 'admin' ? 'No tienes puntos asignados' : 'Aún no tienes puntos asignados'}
              texto={
                usuario.rol === 'admin'
                  ? 'Como administradora puedes registrar en cualquier punto desde "Registrar".'
                  : 'Pídele a tu supervisora que te asigne tus puntos de venta.'
              }
              accion={
                usuario.rol === 'admin' ? (
                  <Boton onClick={() => nav('/registrar')} icono={<PlayCircle className="h-5 w-5" />}>
                    Registrar
                  </Boton>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {!asignados.length && usuario.rol !== 'admin' && (
              <p className="rounded-xl bg-aviso-bg p-3 text-sm text-aviso">
                No tienes puntos asignados todavía; te mostramos todos. Avísale a tu supervisora.
              </p>
            )}
            {puntos.map((p, i) => (
              <TarjetaPunto key={p._id} pdv={p} estados={estadosPorPunto[p._id] ?? []} hoy={hoy} i={i} />
            ))}
          </>
        )}
      </section>

      {puntos.length > 0 && <RiesgoPuntos puntos={puntos} hoy={hoy} />}

      <Link
        to="/mis-registros"
        className="tarjeta flex min-h-[56px] items-center gap-3 transition hover:bg-marca-50/40"
      >
        <ClipboardCheck className="h-6 w-6 text-marca-600" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">Mis registros</span>
          <span className="block text-sm text-tinta-tenue">
            Revisa o corrige lo de los últimos {DIAS_EDICION} días
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-tinta-tenue" aria-hidden />
      </Link>

      <TourBienvenida abierto={tour} onCerrar={cerrarTour} />
    </div>
  );
}
