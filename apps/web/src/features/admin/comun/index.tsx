/**
 * Piezas de UI reutilizadas por el tablero y el panel de administración.
 * (No forman parte del kit compartido `components/ui`; viven aquí para no tocar archivos comunes.)
 */
import clsx from 'clsx';
import { MotionConfig, motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, RotateCw, Search, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Boton, HojaInferior } from '@/components/ui';
import { mensajeError } from '@/lib/api';

/* ───────── Contenedor de página (animación suave + respeta "reducir movimiento") ───────── */

export function Pagina({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={clsx('space-y-4', className)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

/* ───────── Select nativo con etiqueta ───────── */

export interface OpcionSelector {
  valor: string;
  texto: string;
}

export function Selector({
  etiqueta,
  valor,
  onChange,
  opciones,
  ayuda,
  className,
  disabled,
  ocultarEtiqueta,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: OpcionSelector[];
  ayuda?: string;
  className?: string;
  disabled?: boolean;
  ocultarEtiqueta?: boolean;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={clsx('etiqueta', ocultarEtiqueta && 'sr-only')}>
        {etiqueta}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={ayuda ? `${id}-d` : undefined}
          className="campo cursor-pointer appearance-none truncate pr-10"
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-tenue"
          aria-hidden
        />
      </div>
      {ayuda && (
        <p id={`${id}-d`} className="mt-1 text-sm text-tinta-tenue">
          {ayuda}
        </p>
      )}
    </div>
  );
}

/* ───────── Interruptor (switch) ───────── */

export function Interruptor({
  etiqueta,
  activo,
  onChange,
  descripcion,
  disabled,
}: {
  etiqueta: string;
  activo: boolean;
  onChange: (v: boolean) => void;
  descripcion?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-black/10 p-3">
      <div>
        <p id={id} className="font-medium text-tinta">
          {etiqueta}
        </p>
        {descripcion && <p className="text-sm text-tinta-suave">{descripcion}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!activo)}
        className={clsx(
          'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
          activo ? 'bg-marca-600' : 'bg-black/20',
        )}
      >
        <span
          className={clsx(
            'inline-block h-6 w-6 rounded-full bg-white shadow transition-transform',
            activo ? 'translate-x-7' : 'translate-x-1',
          )}
        />
        <span className="sr-only">{activo ? 'Sí' : 'No'}</span>
      </button>
    </div>
  );
}

/* ───────── Buscador ───────── */

export function Buscador({
  valor,
  onChange,
  placeholder = 'Buscar…',
  etiqueta = 'Buscar',
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  etiqueta?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={clsx('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-tenue"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="campo pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-tinta-tenue hover:bg-black/5"
          aria-label="Borrar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ───────── Diálogo de confirmación ───────── */

export function Confirmar({
  abierta,
  titulo,
  children,
  textoConfirmar = 'Confirmar',
  variante = 'primario',
  cargando,
  onConfirmar,
  onCerrar,
}: {
  abierta: boolean;
  titulo: string;
  children?: ReactNode;
  textoConfirmar?: string;
  variante?: 'primario' | 'peligro';
  cargando?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={titulo}
      pie={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="fantasma" onClick={onCerrar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante={variante} onClick={onConfirmar} cargando={cargando}>
            {textoConfirmar}
          </Boton>
        </div>
      }
    >
      <div className="space-y-3 text-[15px] leading-relaxed text-tinta-suave">{children}</div>
    </HojaInferior>
  );
}

/* ───────── Esqueletos de carga ───────── */

export function Esqueleto({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-black/[.06]', className)} aria-hidden />;
}

export function EsqueletoLista({ filas = 5 }: { filas?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <Esqueleto key={i} className="h-16" />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/* ───────── Error de carga con reintentar ───────── */

export function ErrorCarga({
  error,
  onReintentar,
  titulo = 'No se pudo cargar la información',
}: {
  error: unknown;
  onReintentar: () => void;
  titulo?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl2 bg-white px-6 py-10 text-center shadow-tarjeta"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-error-bg text-error">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-semibold text-tinta">{titulo}</p>
      <p className="max-w-sm text-sm text-tinta-suave">{mensajeError(error)}</p>
      <Boton variante="secundario" icono={<RotateCw className="h-4 w-4" />} onClick={onReintentar}>
        Reintentar
      </Boton>
    </div>
  );
}

/* ───────── Tabla que en celular se vuelve lista de tarjetas ───────── */

export interface Columna<T> {
  clave: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** número: alineado a la derecha */
  num?: boolean;
  /** se usa como título de la tarjeta en celular */
  principal?: boolean;
  /** se oculta en la vista de tarjetas */
  soloTabla?: boolean;
}

export function TablaResponsiva<T>({
  columnas,
  filas,
  clave,
  vacio = 'Sin datos en este rango.',
  etiqueta,
}: {
  columnas: Columna<T>[];
  filas: T[];
  clave: (f: T, i: number) => string;
  vacio?: string;
  /** descripción accesible de la tabla */
  etiqueta: string;
}) {
  if (!filas.length) return <p className="py-4 text-center text-sm text-tinta-tenue">{vacio}</p>;
  const principal = columnas.find((c) => c.principal) ?? columnas[0];
  const resto = columnas.filter((c) => c !== principal && !c.soloTabla);
  return (
    <>
      {/* Escritorio / tableta: tabla con scroll horizontal dentro del contenedor */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">{etiqueta}</caption>
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-tinta-tenue">
              {columnas.map((c) => (
                <th
                  key={c.clave}
                  scope="col"
                  className={clsx('px-3 py-2 font-semibold', c.num && 'text-right')}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr
                key={clave(f, i)}
                className="border-b border-black/5 last:border-0 hover:bg-marca-50/40"
              >
                {columnas.map((c) => (
                  <td
                    key={c.clave}
                    className={clsx('px-3 py-2.5 align-middle', c.num && 'text-right tabular-nums')}
                  >
                    {c.celda(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Celular: lista de tarjetas */}
      <ul className="space-y-2 md:hidden" aria-label={etiqueta}>
        {filas.map((f, i) => (
          <li key={clave(f, i)} className="rounded-xl border border-black/5 bg-fondo/60 p-3">
            <div className="mb-1.5 font-semibold text-tinta">{principal.celda(f)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {resto.map((c) => (
                <div key={c.clave} className="min-w-0">
                  <dt className="text-xs text-tinta-tenue">{c.titulo}</dt>
                  <dd className="truncate font-medium tabular-nums text-tinta">{c.celda(f)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ───────── Utilidades ───────── */

export function useDebounce<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/** Normaliza para búsquedas sin tildes ni mayúsculas. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Enlace a Google Maps. */
export function urlMapa(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Miniatura Cloudinary: inserta la transformación después de `/upload/`. */
export function miniaturaCloudinary(url: string, transformacion = 'c_fill,w_400,h_300'): string {
  return url.includes('/upload/') ? url.replace('/upload/', `/upload/${transformacion}/`) : url;
}

/** Contador con etiqueta (p. ej. "3 resultados"). */
export function plural(n: number, uno: string, varios: string): string {
  return `${new Intl.NumberFormat('es-CO').format(n)} ${n === 1 ? uno : varios}`;
}
