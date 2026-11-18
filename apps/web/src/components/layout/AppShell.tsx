import clsx from 'clsx';
import {
  BarChart3,
  ClipboardList,
  Home,
  LogOut,
  PlusCircle,
  Settings,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Rol } from '@merca/shared';
import { useAuth } from '@/lib/auth';
import { BotonAyuda } from '../ayuda/Ayuda';
import { BannerPendientes } from '@/features/campo/BannerPendientes';

interface ItemNav {
  a: string;
  texto: string;
  icono: ReactNode;
  roles: Rol[];
}

const NAV: ItemNav[] = [
  { a: '/', texto: 'Inicio', icono: <Home />, roles: ['impulsadora', 'admin'] },
  { a: '/registrar', texto: 'Registrar', icono: <PlusCircle />, roles: ['impulsadora', 'admin'] },
  { a: '/mis-registros', texto: 'Registros', icono: <ClipboardList />, roles: ['impulsadora'] },
  {
    a: '/tablero',
    texto: 'Tablero',
    icono: <BarChart3 />,
    roles: ['impulsadora', 'supervisor', 'admin'],
  },
  { a: '/novedades', texto: 'Novedades', icono: <ClipboardList />, roles: ['supervisor'] },
  { a: '/admin', texto: 'Admin', icono: <Settings />, roles: ['admin'] },
];

function useEnLinea() {
  const [en, setEn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setEn(true);
    const off = () => setEn(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return en;
}

export function AppShell() {
  const { usuario, logout } = useAuth();
  const nav = useNavigate();
  const enLinea = useEnLinea();
  const { pathname } = useLocation();
  if (!usuario) return null;
  const items = NAV.filter((i) => i.roles.includes(usuario.rol));
  // Tablero, admin y galería aprovechan el ancho en PC; el resto sigue en columna de celular.
  const ancho = /^\/(tablero|admin|novedades)(\/|$)/.test(pathname) ? 'max-w-7xl' : 'max-w-3xl';

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className={clsx('mx-auto flex h-14 items-center justify-between gap-2 px-4', ancho)}>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-marca-600 px-2 py-0.5 text-sm font-black tracking-wider text-white">
              LOMUS
            </span>
            <span className="text-sm font-semibold text-tinta-suave">Mercaimpulso</span>
          </div>
          <div className="flex items-center gap-1">
            {usuario.rol === 'admin' && (
              <span className="hidden items-center gap-1 text-xs text-tinta-tenue sm:flex">
                <ShieldCheck className="h-4 w-4" /> Admin
              </span>
            )}
            <span className="max-w-[9rem] truncate text-sm font-medium" title={usuario.nombre}>
              {usuario.nombre.split(' ')[0]}
            </span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                nav('/login');
              }}
              className="grid h-11 w-11 place-items-center rounded-full text-tinta-suave hover:bg-black/5"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        {!enLinea && (
          <div
            className="flex items-center justify-center gap-2 bg-tinta px-4 py-1.5 text-sm text-white"
            role="status"
          >
            <WifiOff className="h-4 w-4" /> Sin señal: puedes seguir registrando, se enviará
            después.
          </div>
        )}
        <BannerPendientes />
      </header>

      <main className={clsx('mx-auto px-4 py-4', ancho)}>
        <Outlet />
      </main>

      {/* --ayuda-bottom: una página puede subir el botón (p. ej. Registrar, por su barra de guardar) */}
      <BotonAyuda className="fixed bottom-[var(--ayuda-bottom,6rem)] right-4 z-30 transition-[bottom]" />

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        <ul className="mx-auto flex max-w-3xl justify-around">
          {items.map((i) => (
            <li key={i.a} className="flex-1">
              <NavLink
                to={i.a}
                end={i.a === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition [&>svg]:h-6 [&>svg]:w-6',
                    isActive ? 'text-marca-600' : 'text-tinta-tenue hover:text-tinta',
                  )
                }
              >
                {i.icono}
                {i.texto}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
