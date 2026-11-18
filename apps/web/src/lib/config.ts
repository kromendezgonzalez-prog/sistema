import type { ConfigResponse, Pdv, Producto } from '@merca/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './api';
import { escribirLS, leerLS } from './almacen';
import { useAuth } from './auth';

const LS_CONFIG = 'merca.config';

/**
 * Configuración (catálogo, puntos, metas, equipo). Se guarda en el dispositivo para trabajar sin señal.
 * Uso: const { data, productosPorCod, pdvsPorId } = useConfig();
 */
export function useConfig() {
  const { usuario } = useAuth();
  const q = useQuery({
    queryKey: ['config', usuario?._id],
    enabled: !!usuario,
    queryFn: async () => {
      const r = await api<ConfigResponse>('/config');
      escribirLS(LS_CONFIG, r);
      return r;
    },
    initialData: () => leerLS<ConfigResponse | undefined>(LS_CONFIG, undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });

  const productosPorCod = useMemo(() => {
    const m: Record<string, Producto> = {};
    for (const p of q.data?.productos ?? []) m[p._id] = p;
    return m;
  }, [q.data]);

  const pdvsPorId = useMemo(() => {
    const m: Record<string, Pdv> = {};
    for (const p of q.data?.pdvs ?? []) m[p._id] = p;
    return m;
  }, [q.data]);

  return { ...q, productosPorCod, pdvsPorId };
}
