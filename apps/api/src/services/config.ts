import {
  MARCAS_COMPETENCIA_DEF,
  METAS_DEF,
  NOVEDADES_GENERALES,
  NOVEDADES_PRODUCTO,
  RIESGO_DEF,
  type Config,
} from '@merca/shared';
import { ConfigModel } from '../models/index.js';

export const CONFIG_DEF: Config = {
  metas: { ...METAS_DEF },
  riesgoVto: { ...RIESGO_DEF },
  marcasCompetencia: [...MARCAS_COMPETENCIA_DEF],
  novedadesGenerales: [...NOVEDADES_GENERALES],
  novedadesProducto: [...NOVEDADES_PRODUCTO],
};

/** Config general (o los valores por defecto de shared si aún no se ha sembrado). */
export async function obtenerConfig(): Promise<Config> {
  const c = await ConfigModel.findById('general').lean();
  if (!c) return structuredClone(CONFIG_DEF);
  return {
    metas: { ...CONFIG_DEF.metas, ...(c.metas as object) },
    riesgoVto: { ...CONFIG_DEF.riesgoVto, ...(c.riesgoVto as object) },
    marcasCompetencia: c.marcasCompetencia ?? [],
    novedadesGenerales: c.novedadesGenerales ?? [],
    novedadesProducto: c.novedadesProducto ?? [],
  };
}
