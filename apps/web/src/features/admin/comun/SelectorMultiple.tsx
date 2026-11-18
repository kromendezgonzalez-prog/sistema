import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Buscador, normalizar } from './index';

export interface OpcionMultiple {
  valor: string;
  texto: string;
  detalle?: string;
}

/** Selector múltiple con buscador: lista de casillas grandes (fácil de tocar en celular). */
export function SelectorMultiple({
  etiqueta,
  opciones,
  seleccion,
  onChange,
  ayuda,
  textoVacio = 'Ninguno seleccionado',
}: {
  etiqueta: string;
  opciones: OpcionMultiple[];
  seleccion: string[];
  onChange: (v: string[]) => void;
  ayuda?: string;
  textoVacio?: string;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const visibles = useMemo(() => {
    const n = normalizar(q);
    if (!n) return opciones;
    return opciones.filter((o) =>
      normalizar(`${o.texto} ${o.detalle ?? ''} ${o.valor}`).includes(n),
    );
  }, [opciones, q]);
  const set = new Set(seleccion);
  const alternar = (v: string) =>
    onChange(set.has(v) ? seleccion.filter((x) => x !== v) : [...seleccion, v]);
  const todosVisibles = visibles.length > 0 && visibles.every((o) => set.has(o.valor));

  return (
    <fieldset aria-describedby={ayuda ? `${id}-d` : undefined}>
      <legend className="etiqueta flex w-full items-center justify-between">
        <span>{etiqueta}</span>
        <span className="text-xs font-semibold text-marca-700">
          {seleccion.length
            ? `${seleccion.length} seleccionado${seleccion.length === 1 ? '' : 's'}`
            : textoVacio}
        </span>
      </legend>
      {ayuda && (
        <p id={`${id}-d`} className="-mt-0.5 mb-2 text-sm text-tinta-tenue">
          {ayuda}
        </p>
      )}
      {opciones.length > 6 && (
        <Buscador
          valor={q}
          onChange={setQ}
          placeholder="Buscar…"
          etiqueta={`Buscar en ${etiqueta}`}
          className="mb-2"
        />
      )}
      <div className="mb-2 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className="rounded-full px-3 py-1.5 font-medium text-marca-700 hover:bg-marca-50"
          onClick={() =>
            todosVisibles
              ? onChange(seleccion.filter((v) => !visibles.some((o) => o.valor === v)))
              : onChange([...new Set([...seleccion, ...visibles.map((o) => o.valor)])])
          }
        >
          {todosVisibles ? 'Quitar visibles' : 'Marcar visibles'}
        </button>
        {seleccion.length > 0 && (
          <button
            type="button"
            className="rounded-full px-3 py-1.5 font-medium text-tinta-suave hover:bg-black/5"
            onClick={() => onChange([])}
          >
            Limpiar
          </button>
        )}
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-black/10 p-1">
        {visibles.map((o) => {
          const activo = set.has(o.valor);
          return (
            <li key={o.valor}>
              <label
                className={clsx(
                  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition',
                  activo ? 'bg-marca-50' : 'hover:bg-black/[.03]',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={activo}
                  onChange={() => alternar(o.valor)}
                />
                <span
                  aria-hidden
                  className={clsx(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                    activo
                      ? 'border-marca-600 bg-marca-600 text-white'
                      : 'border-black/25 bg-white',
                  )}
                >
                  {activo && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-tinta">{o.texto}</span>
                  {o.detalle && (
                    <span className="block truncate text-xs text-tinta-tenue">{o.detalle}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
        {!visibles.length && (
          <li className="px-3 py-4 text-center text-sm text-tinta-tenue">
            Sin resultados para “{q}”.
          </li>
        )}
      </ul>
    </fieldset>
  );
}
