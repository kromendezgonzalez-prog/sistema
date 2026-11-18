import { useCallback, useEffect, useRef } from 'react';
import { claveBorrador, db } from '@/offline/db';
import { useRegistro } from './store';

/**
 * Autoguarda el formulario en el celular (Dexie) 500 ms después de cada cambio,
 * al ocultar la app y al salir de la pantalla.
 */
export function useAutoguardado(usuarioId: string | undefined) {
  const pendiente = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const guardarYa = useCallback(async () => {
    clearTimeout(timer.current);
    if (!pendiente.current) return;
    pendiente.current = false;
    const { form, meta } = useRegistro.getState();
    if (!usuarioId || !form.pdvId) return;
    try {
      await db.borradores.put({ clave: claveBorrador(usuarioId, form), usuarioId, form, meta, actualizadoEn: Date.now() });
    } catch {
      /* almacenamiento lleno o bloqueado: no interrumpir a la trabajadora */
    }
  }, [usuarioId]);

  const cancelar = useCallback(() => {
    pendiente.current = false;
    clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const unsub = useRegistro.subscribe((s, prev) => {
      if (s.cambios === 0 || s.cambios === prev.cambios) return;
      pendiente.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void guardarYa(), 500);
    });
    const alOcultar = () => document.visibilityState === 'hidden' && void guardarYa();
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', guardarYa);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', guardarYa);
      void guardarYa();
    };
  }, [guardarYa]);

  return { guardarYa, cancelar };
}
