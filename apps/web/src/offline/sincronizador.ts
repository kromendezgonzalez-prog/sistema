/**
 * Sincronizador: envía la cola al volver la señal, al abrir la app y cada 60 s si hay pendientes.
 * Se monta una sola vez (BannerPendientes, que vive en el AppShell).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { useAuth } from '@/lib/auth';
import { sincronizar, type ResultadoSync } from './cola';
import { db, type RegistroEnCola } from './db';

export const INTERVALO_SYNC_MS = 60_000;

interface EstadoSync {
  sincronizando: boolean;
  ultimo: (ResultadoSync & { en: number }) | null;
  set: (p: Partial<Omit<EstadoSync, 'set'>>) => void;
}

export const useEstadoSync = create<EstadoSync>((set) => ({
  sincronizando: false,
  ultimo: null,
  set: (p) => set(p),
}));

/** Registros en cola del usuario actual (en vivo). */
export function useCola(): RegistroEnCola[] | undefined {
  const { usuario } = useAuth();
  const id = usuario?._id;
  return useLiveQuery(
    () => (id ? db.cola.where('usuarioId').equals(id).toArray() : Promise.resolve([] as RegistroEnCola[])),
    [id],
  );
}

/** Ejecuta una sincronización y actualiza el estado + caché de consultas. */
export function useSincronizarAhora() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const setEstado = useEstadoSync((s) => s.set);
  return useCallback(
    async (opciones: { incluirErrores?: boolean; avisar?: boolean } = {}) => {
      if (!usuario) return null;
      setEstado({ sincronizando: true });
      try {
        const r = await sincronizar(usuario._id, opciones);
        setEstado({ ultimo: { ...r, en: Date.now() } });
        if (r.enviados > 0) {
          qc.invalidateQueries({ queryKey: ['registros'] });
          qc.invalidateQueries({ queryKey: ['tablero'] });
          toast.success(
            r.enviados === 1 ? 'Se envió 1 registro guardado en el celular ✓' : `Se enviaron ${r.enviados} registros guardados en el celular ✓`,
          );
        }
        if (opciones.avisar) {
          if (r.sinRed) toast.info('Todavía no hay señal. Lo volveremos a intentar solos.');
          else if (r.errores > 0) toast.error('Hay registros con datos por corregir. Revísalos en "Registros".');
        }
        return r;
      } catch {
        return null;
      } finally {
        setEstado({ sincronizando: false });
      }
    },
    [usuario, qc, setEstado],
  );
}

/** Programa la sincronización automática. Montar una sola vez. */
export function useSincronizadorAutomatico(hayPendientes: boolean) {
  const sincronizarAhora = useSincronizarAhora();
  const { usuario } = useAuth();

  // al abrir la app (y al cambiar de usuario)
  useEffect(() => {
    if (usuario) void sincronizarAhora();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?._id]);

  // al volver la señal
  useEffect(() => {
    const alVolver = () => void sincronizarAhora();
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [sincronizarAhora]);

  // cada 60 s mientras haya pendientes
  useEffect(() => {
    if (!hayPendientes) return;
    const t = setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) void sincronizarAhora();
    }, INTERVALO_SYNC_MS);
    return () => clearInterval(t);
  }, [hayPendientes, sincronizarAhora]);
}
