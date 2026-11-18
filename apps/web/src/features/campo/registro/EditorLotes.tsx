import { nivelPorFecha, sumaLotes, type Lote, type Producto, type UmbralesRiesgo } from '@merca/shared';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CircleSlash, Copy, Plus, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Boton, Chip, NivelChip } from '@/components/ui';
import { CampoNumero } from '../componentes/CampoNumero';
import { cantidadTxt, unidadCorta } from '../util';
import { campoLotes, type Momento } from './modelo';
import { useRegistro } from './store';

const SIN_LOTES: Lote[] = [];

/** Chip de nivel en vivo para una fecha (o "Sin fecha"). */
export function ChipVto({ vto, hoy, umbrales }: { vto: string | null; hoy: string; umbrales?: UmbralesRiesgo }) {
  if (!vto) return <Chip tono="error">Sin fecha</Chip>;
  const { nivel, dias } = nivelPorFecha(vto, hoy, umbrales);
  return <NivelChip nivel={nivel} dias={dias} />;
}

function FilaLote({
  n,
  lote,
  producto,
  hoy,
  umbrales,
  onCambio,
  onQuitar,
  onNovedad,
}: {
  n: number;
  lote: Lote;
  producto?: Producto;
  hoy: string;
  umbrales?: UmbralesRiesgo;
  onCambio: (p: Partial<Lote>) => void;
  onQuitar: () => void;
  onNovedad: () => void;
}) {
  const u = unidadCorta(producto);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}
      className="rounded-xl border border-black/10 bg-white p-2.5"
      data-testid="fila-lote"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-tinta-tenue">Lote {n}</span>
        <ChipVto vto={lote.vto} hoy={hoy} umbrales={umbrales} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={onNovedad}
          className={clsx(
            'inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-xs font-semibold transition',
            lote.novedad ? 'bg-error-bg text-error' : 'text-marca-700 hover:bg-marca-50',
          )}
          aria-label={lote.novedad ? `Novedad del lote ${n}: ${lote.novedad.tipo}` : `Reportar novedad del lote ${n}`}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <span className="max-w-[7rem] truncate">{lote.novedad ? lote.novedad.tipo : 'Reportar novedad'}</span>
        </button>
        <button
          type="button"
          onClick={onQuitar}
          className="grid h-11 w-11 place-items-center rounded-full text-tinta-tenue hover:bg-error-bg hover:text-error"
          aria-label={`Quitar lote ${n}`}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-2">
        <CampoNumero
          etiqueta={`Cantidad del lote ${n} (${u})`}
          etiquetaOculta
          valor={lote.cantidad}
          onValor={(v) => v !== null && onCambio({ cantidad: v })}
          entero={u === 'und'}
          sufijo={u}
        />
        <div>
          <label className="sr-only" htmlFor={`vto-${lote.id}`}>
            Fecha de vencimiento del lote {n}
          </label>
          <input
            id={`vto-${lote.id}`}
            type="date"
            className="campo"
            value={lote.vto ?? ''}
            onChange={(e) => onCambio({ vto: e.target.value || null })}
          />
        </div>
      </div>
    </motion.li>
  );
}

/** Formulario para agregar lotes uno tras otro (la fecha se conserva para el siguiente). */
function AgregarLote({
  producto,
  hoy,
  umbrales,
  fechaInicial,
  onAgregar,
  onCerrar,
}: {
  producto?: Producto;
  hoy: string;
  umbrales?: UmbralesRiesgo;
  fechaInicial: string;
  onAgregar: (l: { cantidad: number; vto: string | null }) => void;
  onCerrar: () => void;
}) {
  const u = unidadCorta(producto);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [vto, setVto] = useState(fechaInicial);
  const [sinFecha, setSinFecha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState(0);

  const agregar = () => {
    if (!cantidad || cantidad <= 0) return setError(u === 'kg' ? 'Escribe el peso en kg.' : 'Escribe cuántas unidades.');
    if (!sinFecha && !vto) return setError('Escribe la fecha de vencimiento o marca "Sin fecha legible".');
    onAgregar({ cantidad, vto: sinFecha ? null : vto });
    setCantidad(null);
    setError(null);
    setClave((k) => k + 1); // re-monta el campo para volver a enfocarlo
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 space-y-2 rounded-xl border-2 border-dashed border-marca-600/30 bg-marca-50/40 p-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-marca-700">Nuevo lote</p>
        <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-2">
          <CampoNumero
            key={clave}
            etiqueta={u === 'kg' ? 'Peso (kg)' : 'Unidades'}
            compacto
            valor={cantidad}
            onValor={setCantidad}
            entero={u === 'und'}
            sufijo={u}
            autoFocus
          />
          <div>
            <label className="etiqueta !text-xs" htmlFor={`nuevo-vto-${producto?._id}`}>
              Vence
            </label>
            <input
              id={`nuevo-vto-${producto?._id}`}
              type="date"
              className="campo"
              value={sinFecha ? '' : vto}
              disabled={sinFecha}
              onChange={(e) => setVto(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-tinta-suave">
            <input
              type="checkbox"
              className="h-5 w-5 accent-marca-600"
              checked={sinFecha}
              onChange={(e) => setSinFecha(e.target.checked)}
            />
            Sin fecha legible
          </label>
          {!sinFecha && vto && <ChipVto vto={vto} hoy={hoy} umbrales={umbrales} />}
        </div>
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Boton type="button" className="flex-1" icono={<Plus className="h-5 w-5" />} onClick={agregar}>
            Agregar
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Listo
          </Boton>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Editor de lotes de un producto en un momento (al llegar / al cierre).
 * undefined = sin registrar; [] = inventario 0.
 */
export function EditorLotes({
  cod,
  momento,
  producto,
  hoy,
  umbrales,
  onNovedad,
}: {
  cod: string;
  momento: Momento;
  producto?: Producto;
  hoy: string;
  umbrales?: UmbralesRiesgo;
  onNovedad: (loteId: string) => void;
}) {
  const k = campoLotes(momento);
  const lotes = useRegistro((s) => s.form.items[cod]?.[k]);
  const hayLlegada = useRegistro((s) => (s.form.items[cod]?.lotesIni?.length ?? 0) > 0);
  const { agregarLote, actualizarLote, fijarLotes, copiarLlegada } = useRegistro.getState();
  const [agregando, setAgregando] = useState(false);
  const lista = lotes ?? SIN_LOTES;
  const total = sumaLotes(lotes);
  const titulo = momento === 'ini' ? 'Al llegar' : 'Al cierre';
  const fechaSugerida = lista.length ? (lista[lista.length - 1].vto ?? '') : '';

  const quitar = (id: string) => {
    const antes = lista;
    useRegistro.getState().quitarLote(cod, momento, id);
    toast('Lote quitado', {
      action: { label: 'Deshacer', onClick: () => fijarLotes(cod, momento, antes) },
      duration: 4000,
    });
  };

  return (
    <div className="space-y-2" data-testid={`lotes-${momento}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-tinta">
          {titulo}{' '}
          <span className="font-normal text-tinta-tenue">· {momento === 'ini' ? 'lotes iniciales' : 'lotes finales'}</span>
        </h4>
        <span className="text-sm font-semibold tabular-nums text-tinta" data-testid={`total-${momento}`}>
          {lotes === undefined ? 'Sin registrar' : `${cantidadTxt(total, producto)} · ${lista.length} lote${lista.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {lotes !== undefined && lista.length === 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-black/[.04] px-3 py-2 text-sm text-tinta-suave">
          <span className="inline-flex items-center gap-2">
            <CircleSlash className="h-4 w-4" aria-hidden /> No hay producto (inventario en 0)
          </span>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-1 px-2 font-semibold text-marca-700"
            onClick={() => fijarLotes(cod, momento, undefined)}
          >
            <Undo2 className="h-4 w-4" aria-hidden /> Deshacer
          </button>
        </div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {lista.map((l, i) => (
            <FilaLote
              key={l.id}
              n={i + 1}
              lote={l}
              producto={producto}
              hoy={hoy}
              umbrales={umbrales}
              onCambio={(p) => actualizarLote(cod, momento, l.id, p)}
              onQuitar={() => quitar(l.id)}
              onNovedad={() => onNovedad(l.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {agregando && (
          <AgregarLote
            producto={producto}
            hoy={hoy}
            umbrales={umbrales}
            fechaInicial={fechaSugerida}
            onAgregar={(l) => agregarLote(cod, momento, l)}
            onCerrar={() => setAgregando(false)}
          />
        )}
      </AnimatePresence>

      {!agregando && (
        <div className="flex flex-wrap gap-2">
          <Boton type="button" variante="secundario" tam="md" icono={<Plus className="h-5 w-5" />} onClick={() => setAgregando(true)}>
            Agregar lote
          </Boton>
          {momento === 'fin' && hayLlegada && (
            <Boton
              type="button"
              variante="secundario"
              icono={<Copy className="h-4 w-4" />}
              onClick={() => {
                const antes = lotes;
                copiarLlegada(cod);
                toast.success('Copiamos los lotes de llegada. Ajusta lo que se vendió.', {
                  action: { label: 'Deshacer', onClick: () => fijarLotes(cod, momento, antes) },
                  duration: 4000,
                });
              }}
            >
              Copiar lotes de llegada
            </Boton>
          )}
          {lotes === undefined && (
            <Boton type="button" variante="fantasma" icono={<CircleSlash className="h-4 w-4" />} onClick={() => fijarLotes(cod, momento, [])}>
              {momento === 'ini' ? 'No había (0)' : 'No quedó (0)'}
            </Boton>
          )}
        </div>
      )}
    </div>
  );
}
