import clsx from 'clsx';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { aNumero } from '@/lib/formato';

const aTexto = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/**
 * Campo numérico amigable para celular: teclado numérico, acepta coma decimal ("1,5"),
 * nunca pierde lo que se está escribiendo ("1," queda en pantalla mientras se escribe).
 */
export function CampoNumero({
  etiqueta,
  etiquetaOculta,
  valor,
  onValor,
  entero,
  negativo,
  sufijo,
  ayuda,
  error,
  placeholder,
  className,
  compacto,
  id,
  autoFocus,
}: {
  etiqueta: string;
  /** la etiqueta solo la leen los lectores de pantalla */
  etiquetaOculta?: boolean;
  valor: number | null | undefined;
  onValor: (v: number | null) => void;
  entero?: boolean;
  negativo?: boolean;
  sufijo?: ReactNode;
  ayuda?: string;
  error?: string | null;
  placeholder?: string;
  className?: string;
  compacto?: boolean;
  id?: string;
  autoFocus?: boolean;
}) {
  const auto = useId();
  const cid = id ?? auto;
  const [texto, setTexto] = useState(aTexto(valor));

  // sincroniza si el valor cambia desde afuera (precarga, copiar lotes…)
  useEffect(() => {
    if (aNumero(texto) !== (valor ?? null)) setTexto(aTexto(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const cambiar = (bruto: string) => {
    const permitido = negativo ? /[^\d.,-]/g : /[^\d.,]/g;
    let t = bruto.replace(permitido, '');
    if (entero) t = t.replace(/[.,]/g, '');
    setTexto(t);
    if (t.trim() === '') return onValor(null);
    const n = aNumero(t);
    if (n === null || (!negativo && n < 0)) return;
    onValor(entero ? Math.trunc(n) : n);
  };

  return (
    <div className={className}>
      <label htmlFor={cid} className={clsx(etiquetaOculta ? 'sr-only' : 'etiqueta', compacto && !etiquetaOculta && '!text-xs')}>
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={cid}
          type="text"
          inputMode={entero ? 'numeric' : 'decimal'}
          autoComplete="off"
          enterKeyHint="done"
          value={texto}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => cambiar(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={!!error}
          aria-describedby={error || ayuda ? `${cid}-d` : undefined}
          className={clsx(
            'campo tabular-nums',
            sufijo && 'pr-12',
            error && 'border-error ring-2 ring-error/20',
          )}
        />
        {sufijo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-tinta-tenue">
            {sufijo}
          </span>
        )}
      </div>
      {(error || ayuda) && (
        <p id={`${cid}-d`} className={clsx('mt-1 text-xs', error ? 'text-error' : 'text-tinta-tenue')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}

/** Interruptor accesible (≥ 44 px) para sí/no. */
export function Interruptor({
  etiqueta,
  descripcion,
  activo,
  onCambio,
}: {
  etiqueta: string;
  descripcion?: string;
  activo: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambio(!activo)}
      className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-1 text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-tinta">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-tinta-tenue">{descripcion}</span>}
      </span>
      <span
        aria-hidden
        className={clsx(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
          activo ? 'bg-marca-600' : 'bg-black/15',
        )}
      >
        <span
          className={clsx(
            'inline-block h-6 w-6 rounded-full bg-white shadow transition-transform',
            activo ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </span>
    </button>
  );
}

/** Selector tipo píldora que permite deseleccionar (toca de nuevo para quitar). */
export function PildorasOpcionales<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta: string;
  opciones: readonly T[];
  valor: T | null | undefined;
  onCambio: (v: T | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta}>
      <span className="etiqueta">{etiqueta}</span>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={valor === o}
            onClick={() => onCambio(valor === o ? null : o)}
            className={clsx(
              'min-h-[44px] min-w-[64px] rounded-full border px-4 text-sm font-medium transition',
              valor === o
                ? 'border-marca-600 bg-marca-600 text-white'
                : 'border-black/10 bg-white text-tinta hover:border-marca-600/40',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
