import { AnimatePresence, motion } from 'framer-motion';
import { AlertOctagon, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCola, useEstadoSync, useSincronizadorAutomatico, useSincronizarAhora } from '@/offline/sincronizador';

/**
 * Banner "N registros sin enviar · Reintentar" (montado en el AppShell).
 * También programa la sincronización automática de la cola offline.
 */
export function BannerPendientes() {
  const cola = useCola() ?? [];
  useSincronizadorAutomatico(cola.length > 0);
  const sincronizar = useSincronizarAhora();
  const sincronizando = useEstadoSync((s) => s.sincronizando);
  const errores = cola.filter((c) => c.estado === 'error' && c.errorDeDatos).length;
  const n = cola.length;

  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div
            className={errores ? 'bg-error-bg text-error' : 'bg-aviso-bg text-aviso'}
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-1">
              {errores ? (
                <AlertOctagon className="h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <CloudOff className="h-5 w-5 shrink-0" aria-hidden />
              )}
              <Link to="/mis-registros" className="min-w-0 flex-1 py-2 text-sm leading-tight underline-offset-2 hover:underline">
                <b>
                  {n} registro{n === 1 ? '' : 's'} sin enviar
                </b>
                {sincronizando ? (
                  <span> · enviando…</span>
                ) : errores ? (
                  <span> · {errores} con datos por corregir</span>
                ) : (
                  <span> · se enviarán solos con señal</span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => void sincronizar({ incluirErrores: true, avisar: true })}
                disabled={sincronizando}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-black/5 disabled:opacity-60"
              >
                {sincronizando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                Reintentar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
