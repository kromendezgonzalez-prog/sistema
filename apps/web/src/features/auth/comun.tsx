import type { UsuarioPublico } from '@merca/shared';
import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

/** Logo LOMUS (texto, sin dependencias de imagen). */
export function LogoLomus({ grande }: { grande?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={clsx(
          'rounded-2xl bg-marca-600 font-black tracking-[0.2em] text-white shadow-lg shadow-marca-600/30',
          grande ? 'px-5 py-2 text-3xl' : 'px-3 py-1 text-lg',
        )}
      >
        LOMUS
      </span>
      <span className={clsx('font-semibold text-tinta-suave', grande ? 'text-base' : 'text-sm')}>Mercaimpulso</span>
    </div>
  );
}

/** Marco de pantalla para login y cambio de contraseña (fuera del AppShell). */
export function MarcoAuth({ children, esquina }: { children: ReactNode; esquina?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-marca-50 via-fondo to-fondo px-4 py-10">
      {esquina && <div className="absolute right-4 top-4">{esquina}</div>}
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

/** Campo de contraseña con botón mostrar/ocultar (≥ 44 px). */
export const CampoClave = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string | null; ayuda?: string }
>(function CampoClave({ etiqueta, error, ayuda, id, className, ...rest }, ref) {
  const auto = useId();
  const cid = id ?? auto;
  const [ver, setVer] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={cid} className="etiqueta">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={cid}
          type={ver ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error || ayuda ? `${cid}-d` : undefined}
          className={clsx('campo pr-12', error && 'border-error ring-2 ring-error/20')}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-tinta-tenue hover:text-tinta"
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={ver}
        >
          {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {(error || ayuda) && (
        <p id={`${cid}-d`} className={clsx('mt-1 text-sm', error ? 'text-error' : 'text-tinta-tenue')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
});

/** A dónde ir después de iniciar sesión. */
export function destinoTrasLogin(u: UsuarioPublico, desde?: string | null): string {
  if (u.debeCambiarPassword) return '/cambiar-password';
  if (u.rol === 'supervisor') return '/tablero';
  if (desde && desde !== '/login' && desde !== '/cambiar-password') return desde;
  return '/';
}
