import type { AuthResponse, Rol, UsuarioPublico } from '@merca/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, refrescarSesion, registrarHandlersSesion, setAccessToken } from './api';
import { leerLS, escribirLS, borrarLS } from './almacen';

const LS_USUARIO = 'merca.usuario';
const LS_ULTIMO_USUARIO = 'merca.ultimoUsuario';

interface AuthCtx {
  usuario: UsuarioPublico | null;
  /** true mientras se intenta restaurar la sesión al abrir la app */
  cargando: boolean;
  /** sesión restaurada desde el dispositivo sin poder validar con el servidor (sin señal) */
  sinConexion: boolean;
  login: (usuario: string, password: string) => Promise<UsuarioPublico>;
  logout: () => Promise<void>;
  aplicarAuth: (r: AuthResponse) => void;
  ultimoUsuario: string;
  tieneRol: (...roles: Rol[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);

  const aplicarAuth = useCallback((r: AuthResponse) => {
    setAccessToken(r.accessToken);
    setUsuario(r.usuario);
    setSinConexion(false);
    escribirLS(LS_USUARIO, r.usuario);
    escribirLS(LS_ULTIMO_USUARIO, r.usuario.usuario);
  }, []);

  const limpiar = useCallback(() => {
    setAccessToken(null);
    setUsuario(null);
    borrarLS(LS_USUARIO);
  }, []);

  useEffect(() => {
    registrarHandlersSesion({ perdida: limpiar, renovada: aplicarAuth });
    (async () => {
      const r = await refrescarSesion();
      if (r === 'sin-red') {
        // Offline-first: dejamos trabajar con el usuario guardado; se valida al volver la señal.
        const guardado = leerLS<UsuarioPublico | null>(LS_USUARIO, null);
        if (guardado) {
          setUsuario(guardado);
          setSinConexion(true);
        }
      } else if (r === 'invalida') limpiar();
      setCargando(false);
    })();
    const alVolver = () => {
      if (!sinConexion) return;
      refrescarSesion().then((x) => x === 'invalida' && limpiar());
    };
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (u: string, password: string) => {
      const r = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { usuario: u.trim().toLowerCase(), password },
        sinRefresh: true,
      });
      aplicarAuth(r);
      return r.usuario;
    },
    [aplicarAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', sinRefresh: true });
    } catch {
      /* sin red: igual cerramos localmente */
    }
    limpiar();
  }, [limpiar]);

  const valor = useMemo<AuthCtx>(
    () => ({
      usuario,
      cargando,
      sinConexion,
      login,
      logout,
      aplicarAuth,
      ultimoUsuario: leerLS<string>(LS_ULTIMO_USUARIO, ''),
      tieneRol: (...roles) => !!usuario && roles.includes(usuario.rol),
    }),
    [usuario, cargando, sinConexion, login, logout, aplicarAuth],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}

/** Protege rutas: exige sesión, cambio de contraseña pendiente y rol. */
export function Protegida({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const loc = useLocation();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  if (usuario.debeCambiarPassword && loc.pathname !== '/cambiar-password')
    return <Navigate to="/cambiar-password" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
