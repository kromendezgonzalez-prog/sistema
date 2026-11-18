import {
  INFO_NIVEL,
  type FilaRiesgo,
  type TableroResponse,
  type UmbralesRiesgo,
} from '@merca/shared';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MapPin, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Boton, NivelChip, Pildoras, Tarjeta } from '@/components/ui';
import { fechaCorta, fmt } from '@/lib/formato';
import { ESTILO_NIVEL, NIVELES_CON_RIESGO, textoRangoNivel, type NivelConRiesgo } from '../niveles';

const LIMITE = 24;
const AGRUPAR = ['Por urgencia', 'Por punto'] as const;

export function RiesgoPorNivel({ t, umbrales }: { t: TableroResponse; umbrales: UmbralesRiesgo }) {
  const [filtro, setFiltro] = useState<NivelConRiesgo | null>(null);
  const [agrupar, setAgrupar] = useState<(typeof AGRUPAR)[number]>('Por urgencia');
  const [verTodo, setVerTodo] = useState(false);

  const lista = useMemo(
    () => (filtro ? t.riesgo.lista.filter((f) => f.nivel === filtro) : t.riesgo.lista),
    [t, filtro],
  );
  const grupos = useMemo(() => {
    if (agrupar === 'Por urgencia') return null;
    const m = new Map<string, FilaRiesgo[]>();
    for (const f of lista) m.set(f.pdvNombre, [...(m.get(f.pdvNombre) ?? []), f]);
    return [...m.entries()].sort((a, b) => a[1][0].dias - b[1][0].dias || a[0].localeCompare(b[0]));
  }, [lista, agrupar]);
  const visibles = verTodo ? lista : lista.slice(0, LIMITE);

  return (
    <Tarjeta titulo="Riesgo de vencimiento" className="scroll-mt-20">
      <p className="-mt-1 mb-3 text-sm text-tinta-suave">
        Lotes en góndola según su fecha de vencimiento (último conteo de cada punto). Toca un nivel
        para filtrar la lista.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {NIVELES_CON_RIESGO.map((n) => {
          const d = t.riesgo.porNivel[n];
          const activo = filtro === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                setFiltro(activo ? null : n);
                setVerTodo(false);
              }}
              data-testid={`riesgo-${n}`}
              className={clsx(
                'flex flex-col items-start gap-1 rounded-xl border-t-4 p-3 text-left transition',
                ESTILO_NIVEL[n].borde,
                ESTILO_NIVEL[n].fondo,
                activo ? 'ring-2 ring-marca-600 ring-offset-2' : 'hover:brightness-[.98]',
                d.lotes === 0 && !activo && 'opacity-70',
              )}
            >
              <NivelChip nivel={n} largo />
              <span className="mt-1 text-2xl font-extrabold tabular-nums text-tinta">
                {fmt(d.lotes, 0)}{' '}
                <span className="text-sm font-semibold text-tinta-suave">
                  lote{d.lotes === 1 ? '' : 's'}
                </span>
              </span>
              <span className="text-sm font-medium tabular-nums text-tinta-suave">
                ≈ {fmt(d.kg, 1)} kg
              </span>
              <span className="text-xs text-tinta-tenue">{textoRangoNivel(n, umbrales)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Acción hoy</h3>
          <p className="text-sm text-tinta-suave">
            {lista.length
              ? `${fmt(lista.length, 0)} lote${lista.length === 1 ? '' : 's'}${filtro ? ` en nivel “${INFO_NIVEL[filtro].corto}”` : ''}, del más urgente al menos urgente.`
              : filtro
                ? 'No hay lotes en este nivel.'
                : 'No hay lotes en riesgo. ¡Muy bien!'}
          </p>
        </div>
        {lista.length > 0 && (
          <Pildoras
            etiqueta="Agrupar lista"
            opciones={AGRUPAR}
            valor={agrupar}
            onChange={(v) => setAgrupar(v)}
          />
        )}
      </div>

      {lista.length > 0 && (
        <div className="mt-3">
          {grupos ? (
            <div className="space-y-4">
              {grupos.map(([pdv, filas]) => (
                <section key={pdv} aria-label={pdv}>
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-tinta">
                    <MapPin className="h-4 w-4 text-marca-600" aria-hidden /> {pdv}
                    <span className="font-normal text-tinta-tenue">· {filas.length}</span>
                  </h4>
                  <ListaFilas filas={filas} mostrarPunto={false} />
                </section>
              ))}
            </div>
          ) : (
            <>
              <ListaFilas filas={visibles} mostrarPunto />
              {lista.length > LIMITE && (
                <div className="mt-3 text-center">
                  <Boton variante="fantasma" tam="sm" onClick={() => setVerTodo((v) => !v)}>
                    {verTodo ? 'Ver menos' : `Ver todos (${lista.length})`}
                  </Boton>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

function ListaFilas({ filas, mostrarPunto }: { filas: FilaRiesgo[]; mostrarPunto: boolean }) {
  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      <AnimatePresence initial={false}>
        {filas.map((f) => (
          <motion.li
            key={`${f.pdvId}-${f.cod}-${f.loteId}`}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={clsx('rounded-xl border-l-4 bg-fondo/70 p-3', ESTILO_NIVEL[f.nivel].borde)}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold leading-tight text-tinta">{f.producto}</p>
                <p className="text-sm text-tinta-suave">
                  {fmt(f.cantidad, f.unidad === 'und' ? 0 : 2)} {f.unidad === 'und' ? 'und' : 'kg'}
                  {f.unidad === 'und' && f.kg !== null && ` (≈ ${fmt(f.kg, 1)} kg)`} · vence{' '}
                  {fechaCorta(f.vto)}
                </p>
              </div>
              <NivelChip nivel={f.nivel} dias={f.dias} />
            </div>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-tinta">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-marca-600" aria-hidden />
              {INFO_NIVEL[f.nivel].accion}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-tinta-tenue">
              {mostrarPunto && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {f.pdvNombre}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" aria-hidden /> {f.impulsadoraNombre}
              </span>
              <span>Conteo: {fechaCorta(f.fechaConteo)}</span>
            </p>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
