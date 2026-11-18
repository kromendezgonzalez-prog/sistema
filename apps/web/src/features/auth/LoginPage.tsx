import type { AuthResponse } from '@merca/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertOctagon, Lock, LogIn, User, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BotonAyuda, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { Boton, Campo } from '@/components/ui';
import { api, ErrorApi, ErrorRed } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CampoClave, destinoTrasLogin, LogoLomus, MarcoAuth } from './comun';
import { SITEKEY_TURNSTILE, Turnstile, type TurnstileRef } from './Turnstile';

interface ErrorLogin {
  titulo: string;
  texto: string;
  icono?: 'red' | 'candado';
}

export function interpretarErrorLogin(e: unknown): ErrorLogin {
  if (e instanceof ErrorRed)
    return {
      titulo: 'Sin conexión',
      texto: 'Necesitas señal para iniciar sesión. Si ya habías entrado en este celular, la app abre sin señal.',
      icono: 'red',
    };
  if (e instanceof ErrorApi) {
    if (e.codigo === 'BLOQUEADO' || e.status === 423)
      return {
        titulo: 'Usuario bloqueado por seguridad',
        texto: `${e.message} Espera 15 minutos o pide a administración que te desbloquee.`,
        icono: 'candado',
      };
    if (e.codigo === 'INACTIVO' || e.status === 403)
      return { titulo: 'Usuario inactivo', texto: e.message || 'Tu usuario está desactivado. Habla con administración.', icono: 'candado' };
    if (e.status === 401 || e.codigo === 'CREDENCIALES')
      return {
        titulo: 'Usuario o contraseña incorrectos',
        texto: 'Revisa que no haya espacios y las mayúsculas de la contraseña. Tras 5 intentos fallidos el usuario se bloquea 15 minutos.',
      };
    if (e.status === 429) return { titulo: 'Demasiados intentos', texto: 'Espera unos minutos y vuelve a intentar.' };
    return { titulo: 'No pudimos iniciar sesión', texto: e.message };
  }
  return { titulo: 'No pudimos iniciar sesión', texto: 'Ocurrió un error inesperado. Intenta de nuevo.' };
}

export default function LoginPage() {
  useTemaAyuda('login');
  const { usuario, cargando, ultimoUsuario, aplicarAuth } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const desde = (loc.state as { desde?: string } | null)?.desde;
  const [u, setU] = useState(ultimoUsuario);
  const [p, setP] = useState('');
  const [error, setError] = useState<ErrorLogin | null>(null);
  const [faltan, setFaltan] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const ts = useRef<TurnstileRef>(null);
  const refClave = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cargando && usuario) nav(destinoTrasLogin(usuario, desde), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, usuario]);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!u.trim() || !p) {
      setFaltan(true);
      return;
    }
    setEnviando(true);
    try {
      const r = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { usuario: u.trim().toLowerCase(), password: p, ...(token ? { turnstileToken: token } : {}) },
        sinRefresh: true,
      });
      aplicarAuth(r);
      nav(destinoTrasLogin(r.usuario, desde), { replace: true });
    } catch (e) {
      setError(interpretarErrorLogin(e));
      if (e instanceof ErrorApi && e.status === 401) {
        setP('');
        refClave.current?.focus();
      }
      ts.current?.reset();
    } finally {
      setEnviando(false);
    }
  };

  const esperandoCaptcha = !!SITEKEY_TURNSTILE && !token;

  return (
    <MarcoAuth esquina={<BotonAyuda />}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-8">
          <LogoLomus grande />
        </div>
        <form onSubmit={enviar} noValidate className="tarjeta space-y-4 !p-5">
          <div>
            <h1 className="text-xl font-extrabold text-tinta">Iniciar sesión</h1>
            <p className="text-sm text-tinta-suave">{ultimoUsuario ? '¡Hola de nuevo! Escribe tu contraseña.' : 'Usa el usuario que te dio tu supervisora.'}</p>
          </div>

          <Campo
            etiqueta="Usuario"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            value={u}
            onChange={(e) => setU(e.target.value)}
            error={faltan && !u.trim() ? 'Escribe tu usuario.' : null}
            sufijo={<User className="h-5 w-5" aria-hidden />}
            autoFocus={!ultimoUsuario}
            placeholder="ej. maria.gomez"
          />
          <CampoClave
            ref={refClave}
            etiqueta="Contraseña"
            name="password"
            autoComplete="current-password"
            value={p}
            onChange={(e) => setP(e.target.value)}
            error={faltan && !p ? 'Escribe tu contraseña.' : null}
            autoFocus={!!ultimoUsuario}
          />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-3 rounded-xl bg-error-bg p-3 text-sm text-error" role="alert">
                  {error.icono === 'red' ? (
                    <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  ) : error.icono === 'candado' ? (
                    <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  ) : (
                    <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  )}
                  <div>
                    <p className="font-semibold">{error.titulo}</p>
                    <p>{error.texto}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {SITEKEY_TURNSTILE && <Turnstile ref={ts} sitekey={SITEKEY_TURNSTILE} onToken={setToken} />}

          <Boton type="submit" bloque tam="lg" cargando={enviando} disabled={esperandoCaptcha} icono={<LogIn className="h-5 w-5" />}>
            {enviando ? 'Entrando…' : esperandoCaptcha ? 'Verificando…' : 'Entrar'}
          </Boton>

          <p className="text-center text-xs text-tinta-tenue">
            ¿Olvidaste tu contraseña? Pídele a administración que te asigne una nueva.
          </p>
        </form>
      </motion.div>
    </MarcoAuth>
  );
}
