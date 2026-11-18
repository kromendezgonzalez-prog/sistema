import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Boton } from '@/components/ui';
import { normalizar } from './index';

/** Lista de textos editable: agregar, quitar y reordenar. */
export function ListaEditable({
  etiqueta,
  items,
  onChange,
  max = 30,
  maxLargo = 60,
  placeholder = 'Escribe y toca Agregar',
  ayuda,
}: {
  etiqueta: string;
  items: string[];
  onChange: (v: string[]) => void;
  max?: number;
  maxLargo?: number;
  placeholder?: string;
  ayuda?: string;
}) {
  const id = useId();
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const agregar = () => {
    const t = nuevo.trim().replace(/\s+/g, ' ');
    if (!t) return;
    if (items.some((x) => normalizar(x) === normalizar(t)))
      return setError(`“${t}” ya está en la lista.`);
    if (items.length >= max) return setError(`Máximo ${max} elementos.`);
    onChange([...items, t]);
    setNuevo('');
    setError(null);
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const c = [...items];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };

  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}{' '}
        <span className="font-normal text-tinta-tenue">
          ({items.length}/{max})
        </span>
      </label>
      {ayuda && <p className="-mt-0.5 mb-2 text-sm text-tinta-tenue">{ayuda}</p>}
      <ul className="mb-2 space-y-1.5" aria-label={etiqueta}>
        <AnimatePresence initial={false}>
          {items.map((t, i) => (
            <motion.li
              key={t}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1 rounded-xl border border-black/10 bg-white py-1 pl-3 pr-1"
            >
              <span className="w-6 shrink-0 text-xs tabular-nums text-tinta-tenue">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t}</span>
              <button
                type="button"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                className="grid h-10 w-10 place-items-center rounded-full text-tinta-suave hover:bg-black/5 disabled:opacity-30"
                aria-label={`Subir “${t}”`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === items.length - 1}
                className="grid h-10 w-10 place-items-center rounded-full text-tinta-suave hover:bg-black/5 disabled:opacity-30"
                aria-label={`Bajar “${t}”`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                className="grid h-10 w-10 place-items-center rounded-full text-error hover:bg-error-bg"
                aria-label={`Quitar “${t}”`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {!items.length && (
          <li className="rounded-xl border border-dashed border-black/15 p-3 text-center text-sm text-tinta-tenue">
            Lista vacía
          </li>
        )}
      </ul>
      <div className="flex gap-2">
        <input
          id={id}
          className="campo"
          value={nuevo}
          maxLength={maxLargo}
          placeholder={placeholder}
          onChange={(e) => {
            setNuevo(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
          aria-invalid={!!error}
        />
        <Boton
          type="button"
          variante="secundario"
          onClick={agregar}
          disabled={!nuevo.trim()}
          icono={<Plus className="h-4 w-4" />}
        >
          Agregar
        </Boton>
      </div>
      {error && (
        <p className="mt-1 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
