import type { AuthResponse } from '@merca/shared';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Check, Circle, KeyRound, LogOut } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BotonAyuda, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { Aviso, Boton } from '@/components/ui';
import { api, ErrorApi, mensajeError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CampoClave, LogoLomus, MarcoAuth } from './comun';

export default function CambiarPasswordPage() {
  useTemaAyuda('login');
  const { usuario, aplicarAuth, logout } = useAuth();
  const nav = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const obligatoria = !!usuario?.debeCambiarPassword;

  const reglas = [
    { ok: nueva.length >= 6, texto: 'Mínimo 6 caracteres' },
    { ok: !!nueva && nueva === confirmar, texto: 'Las dos contraseñas nuevas coinciden' },
    { ok: !!nueva && !!actual && nueva !== actual, texto: obligatoria ? 'Diferente a la temporal' : 'Diferente a la actual' },
  ];
  const valida = reglas.every((r) => r.ok) && !!actual;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!valida) {
      setError('Revisa las reglas de la contraseña (deben quedar todas en verde).');
      return;
    }
    setEnviando(true);
    try {
      const r = await api<AuthResponse>('/auth/cambiar-password', { method: 'POST', body: { actual, nueva } });
      aplicarAuth(r);
      toast.success('¡Listo! Tu contraseña quedó cambiada.');
      nav(r.usuario.rol === 'supervisor' ? '/tablero' : '/', { replace: true, state: { tour: obligatoria } });
    } catch (err) {
      setError(
        err instanceof ErrorApi && (err.status === 401 || err.codigo === 'CREDENCIALES')
          ? `La contraseña ${obligatoria ? 'temporal' : 'actual'} no es correcta.`
          : mensajeError(err),
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <MarcoAuth esquina={<BotonAyuda />}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <LogoLomus />
        </div>
        <form onSubmit={enviar} noValidate className="tarjeta space-y-4 !p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-marca-50 text-marca-600">
              <KeyRound className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-tinta">{obligatoria ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h1>
              <p className="text-sm text-tinta-suave">
                {obligatoria
                  ? `Hola${usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}. Cambia la contraseña temporal por una que solo tú sepas.`
                  : 'Nadie más puede verla, ni administración.'}
              </p>
            </div>
          </div>

          <CampoClave
            etiqueta={obligatoria ? 'Contraseña temporal' : 'Contraseña actual'}
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoFocus
          />
          <CampoClave etiqueta="Nueva contraseña" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <CampoClave
            etiqueta="Repite la nueva contraseña"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />

          <ul className="space-y-1.5 rounded-xl bg-black/[.03] p-3 text-sm" aria-label="Reglas de la contraseña">
            {reglas.map((r) => (
              <li key={r.texto} className={clsx('flex items-center gap-2 transition-colors', r.ok ? 'text-ok' : 'text-tinta-suave')}>
                {r.ok ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
                {r.texto}
                <span className="sr-only">{r.ok ? '(cumple)' : '(pendiente)'}</span>
              </li>
            ))}
          </ul>

          {error && <Aviso tono="error">{error}</Aviso>}

          <Boton type="submit" bloque tam="lg" cargando={enviando} disabled={!valida}>
            Guardar contraseña
          </Boton>
          {obligatoria ? (
            <Boton
              type="button"
              variante="fantasma"
              bloque
              icono={<LogOut className="h-4 w-4" />}
              onClick={async () => {
                await logout();
                nav('/login', { replace: true });
              }}
            >
              Cerrar sesión
            </Boton>
          ) : (
            <Boton type="button" variante="fantasma" bloque onClick={() => nav(-1)}>
              Volver
            </Boton>
          )}
        </form>
      </motion.div>
    </MarcoAuth>
  );
}
