/**
 * Kit de UI base. Compartido por todos los módulos: NO cambiar firmas existentes;
 * si se necesita algo nuevo, crear un componente en la carpeta del módulo.
 */
import { INFO_NIVEL, SEMAFORO_TEXTO, type NivelRiesgo, type Semaforo } from '@merca/shared';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

/* ───────── Botón ───────── */

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';
export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tam?: 'md' | 'lg' | 'sm';
  cargando?: boolean;
  icono?: ReactNode;
  bloque?: boolean;
}
export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'primario', tam = 'md', cargando, icono, bloque, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || cargando}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:active:scale-100',
        tam === 'lg' && 'h-14 px-6 text-lg',
        tam === 'md' && 'h-12 px-5 text-base',
        tam === 'sm' && 'h-9 px-3 text-sm',
        variante === 'primario' && 'bg-marca-600 text-white shadow-sm hover:bg-marca-700',
        variante === 'secundario' && 'border border-marca-600/30 bg-white text-marca-700 hover:bg-marca-50',
        variante === 'fantasma' && 'text-tinta-suave hover:bg-black/5',
        variante === 'peligro' && 'bg-error text-white hover:brightness-95',
        bloque && 'w-full',
        className,
      )}
      {...rest}
    >
      {cargando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : icono}
      {children}
    </button>
  );
});

/* ───────── Tarjeta ───────── */

export function Tarjeta({
  titulo,
  numero,
  accion,
  className,
  children,
}: {
  titulo?: ReactNode;
  /** número de sección (1, 2, 3…) como en el prototipo */
  numero?: number;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx('tarjeta', className)}>
      {(titulo || accion) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-tinta">
            {numero !== undefined && (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-marca-600 text-sm text-white">
                {numero}
              </span>
            )}
            {titulo}
          </h2>
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

/* ───────── Campo de texto con etiqueta ───────── */

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  sufijo?: ReactNode;
}
export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { etiqueta, ayuda, error, sufijo, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={cid} className="etiqueta">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={cid}
          aria-invalid={!!error}
          aria-describedby={error || ayuda ? `${cid}-d` : undefined}
          className={clsx('campo', sufijo && 'pr-12', error && 'border-error ring-2 ring-error/20')}
          {...rest}
        />
        {sufijo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-tinta-tenue">
            {sufijo}
          </span>
        )}
      </div>
      {(error || ayuda) && (
        <p id={`${cid}-d`} className={clsx('mt-1 text-sm', error ? 'text-error' : 'text-tinta-tenue')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
});

/* ───────── Selector de opciones tipo píldora ───────── */

export function Pildoras<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  multiple,
}: {
  opciones: readonly T[];
  valor: T | T[] | null | undefined;
  onChange: (v: T) => void;
  etiqueta?: string;
  multiple?: boolean;
}) {
  const activo = (o: T) => (Array.isArray(valor) ? valor.includes(o) : valor === o);
  return (
    <div role="group" aria-label={etiqueta}>
      {etiqueta && <span className="etiqueta">{etiqueta}</span>}
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={activo(o)}
            onClick={() => onChange(o)}
            className={clsx(
              'min-h-[44px] rounded-full border px-4 text-sm font-medium transition',
              activo(o)
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

/* ───────── Chips ───────── */

export function Chip({
  tono = 'neutro',
  children,
  className,
}: {
  tono?: 'neutro' | 'ok' | 'aviso' | 'error' | 'marca';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tono === 'neutro' && 'bg-black/5 text-tinta-suave',
        tono === 'ok' && 'bg-ok-bg text-ok',
        tono === 'aviso' && 'bg-aviso-bg text-aviso',
        tono === 'error' && 'bg-error-bg text-error',
        tono === 'marca' && 'bg-marca-50 text-marca-700',
        className,
      )}
    >
      {children}
    </span>
  );
}

const CLASE_NIVEL: Record<NivelRiesgo, string> = {
  vencido: 'bg-riesgo-vencido text-white',
  emergencia: 'bg-riesgo-emergencia text-white',
  critico: 'bg-riesgo-critico text-white',
  medio: 'bg-riesgo-medio text-tinta',
  ok: 'bg-ok-bg text-ok',
};

/** Chip de nivel de riesgo de vencimiento (ícono + texto, nunca solo color). */
export function NivelChip({
  nivel,
  dias,
  largo,
  className,
}: {
  nivel: NivelRiesgo;
  dias?: number;
  largo?: boolean;
  className?: string;
}) {
  const i = INFO_NIVEL[nivel];
  const d =
    dias === undefined ? '' : dias < 0 ? ` · hace ${-dias} d` : dias === 0 ? ' · hoy' : ` · ${dias} d`;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
        CLASE_NIVEL[nivel],
        className,
      )}
    >
      <span aria-hidden>{i.icono}</span>
      {largo ? i.etiqueta : i.corto}
      {d}
    </span>
  );
}

/** Chip de semáforo de KPI. */
export function SemaforoChip({ estado }: { estado: Semaforo }) {
  if (estado === 'neu') return null;
  const t = SEMAFORO_TEXTO[estado];
  return (
    <Chip tono={estado === 'good' ? 'ok' : estado === 'warn' ? 'aviso' : 'error'}>
      <span aria-hidden>{t.icono}</span> {t.texto}
    </Chip>
  );
}

/* ───────── Estados ───────── */

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-tinta-tenue" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {texto}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }: { icono?: ReactNode; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icono && <div className="text-marca-600/60">{icono}</div>}
      <p className="font-semibold text-tinta">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-tinta-suave">{texto}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export function Aviso({
  tono = 'aviso',
  titulo,
  children,
  icono,
}: {
  tono?: 'aviso' | 'error' | 'ok' | 'info';
  titulo?: ReactNode;
  children?: ReactNode;
  icono?: ReactNode;
}) {
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={clsx(
        'flex gap-3 rounded-xl p-3 text-sm',
        tono === 'aviso' && 'bg-aviso-bg text-aviso',
        tono === 'error' && 'bg-error-bg text-error',
        tono === 'ok' && 'bg-ok-bg text-ok',
        tono === 'info' && 'bg-marca-50 text-marca-800',
      )}
    >
      {icono && <span className="mt-0.5 shrink-0">{icono}</span>}
      <div>
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children}
      </div>
    </div>
  );
}

/* ───────── Hoja inferior (bottom sheet) ───────── */

export function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  children,
  pie,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [abierta, onCerrar]);

  return (
    <AnimatePresence>
      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCerrar}
          />
          <motion.div
            className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/15 sm:hidden" aria-hidden />
            <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
              <h2 className="text-lg font-bold">{titulo}</h2>
              <button
                type="button"
                onClick={onCerrar}
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 pb-5">{children}</div>
            {pie && <footer className="border-t border-black/5 px-5 py-3">{pie}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ───────── Encabezado de página ───────── */

export function Encabezado({ titulo, subtitulo, accion }: { titulo: string; subtitulo?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-tinta">{titulo}</h1>
        {subtitulo && <p className="text-sm text-tinta-suave">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  );
}
