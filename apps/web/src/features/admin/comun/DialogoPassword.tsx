import type { PasswordTemporalResponse } from '@merca/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Boton } from '@/components/ui';

/**
 * Muestra la contraseña temporal UNA sola vez. Al cerrar, el padre debe descartar los datos
 * (poner su estado en null): la contraseña no se guarda en ningún lado.
 * No se cierra tocando el fondo ni con Escape para evitar perderla por accidente.
 */
export function DialogoPassword({
  datos,
  motivo,
  onCerrar,
}: {
  datos: PasswordTemporalResponse | null;
  motivo: 'creado' | 'reseteada';
  onCerrar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCopiada(false);
    if (datos) setTimeout(() => boton.current?.focus(), 50);
  }, [datos]);

  const copiar = async () => {
    if (!datos) return;
    try {
      await navigator.clipboard.writeText(datos.passwordTemporal);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  };

  return (
    <AnimatePresence>
      {datos && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dlg-pass-titulo"
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-marca-50 text-marca-600">
                <KeyRound className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 id="dlg-pass-titulo" className="text-lg font-bold">
                  {motivo === 'creado' ? 'Usuario creado' : 'Contraseña reseteada'}
                </h2>
                <p className="text-sm text-tinta-suave">
                  {datos.usuario.nombre} ·{' '}
                  <span className="font-mono">{datos.usuario.usuario}</span>
                </p>
              </div>
            </div>

            <p className="mb-1 text-sm font-medium text-tinta-suave">Contraseña temporal</p>
            <div className="mb-3 flex items-center gap-2 rounded-2xl border-2 border-dashed border-marca-200 bg-marca-50/60 p-3">
              <output
                className="min-w-0 flex-1 select-all break-all font-mono text-2xl font-bold tracking-wider text-marca-800"
                aria-label="Contraseña temporal"
                data-testid="password-temporal"
              >
                {datos.passwordTemporal}
              </output>
              <Boton
                ref={boton}
                tam="sm"
                variante={copiada ? 'secundario' : 'primario'}
                onClick={copiar}
                icono={copiada ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                aria-live="polite"
              >
                {copiada ? 'Copiada' : 'Copiar'}
              </Boton>
            </div>

            <div
              className="mb-4 flex gap-3 rounded-xl bg-aviso-bg p-3 text-sm text-aviso"
              role="note"
            >
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Solo se muestra esta vez</p>
                <p>
                  Cópiala o anótala ahora: <b>no se podrá ver después</b>. Entrégasela a la
                  trabajadora; al entrar deberá cambiarla por una propia.
                </p>
              </div>
            </div>

            <Boton bloque onClick={onCerrar}>
              Listo, ya la entregué o la anoté
            </Boton>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
