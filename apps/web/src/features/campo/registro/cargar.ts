/**
 * Carga el contexto de un registro (fecha, turno, punto):
 * borrador del celular → registro en cola → registro existente en el servidor → precarga del último inventario.
 */
import type { Registro, UltimoInventarioResponse } from '@merca/shared';
import { api, ErrorApi, ErrorRed } from '@/lib/api';
import { claveBorrador, db, type FormRegistro, type MetaForm } from '@/offline/db';
import { senalConTiempo } from '@/offline/cola';
import { aplicarPrecarga, formDesdeRegistro, formNuevo, metaVacia } from './modelo';

export type OrigenCarga = 'borrador' | 'cola' | 'servidor' | 'precarga' | 'nuevo' | 'sin-red';

export interface ResultadoCarga {
  form: FormRegistro;
  meta: MetaForm;
  origen: OrigenCarga;
}

export async function cargarContexto(p: {
  usuarioId: string;
  base: Pick<FormRegistro, 'fecha' | 'turno' | 'pdvId' | 'tipoDia' | 'geo'>;
  existeProducto: (cod: string) => boolean;
}): Promise<ResultadoCarga> {
  const { usuarioId, base } = p;
  const id = claveBorrador(usuarioId, base);
  const conGeo = (f: FormRegistro): FormRegistro => ({ ...f, geo: f.geo ?? base.geo });

  const borrador = await db.borradores.get(id);
  if (borrador && borrador.usuarioId === usuarioId)
    return { form: conGeo(borrador.form), meta: borrador.meta, origen: 'borrador' };

  const enCola = await db.cola.get(id);
  if (enCola && enCola.usuarioId === usuarioId)
    return {
      form: conGeo(formDesdeRegistro(enCola.input)),
      meta: enCola.meta ?? metaVacia(),
      origen: 'cola',
    };

  const nuevo = conGeo(formNuevo(base));
  if (!base.pdvId) return { form: nuevo, meta: metaVacia(), origen: 'nuevo' };

  try {
    const { registro } = await api<{ registro: Registro }>(`/registros/${encodeURIComponent(id)}`, {
      signal: senalConTiempo(15_000),
    });
    return {
      form: conGeo(formDesdeRegistro(registro)),
      meta: { ...metaVacia(), existente: true },
      origen: 'servidor',
    };
  } catch (e) {
    if (e instanceof ErrorRed) return { form: nuevo, meta: metaVacia(), origen: 'sin-red' };
    if (!(e instanceof ErrorApi)) throw e;
    // 404 (no existe aún) u otro: seguimos con la precarga
  }

  try {
    const { previo } = await api<UltimoInventarioResponse>('/registros/ultimo-inventario', {
      query: { pdvId: base.pdvId, fecha: base.fecha, turno: base.turno },
      signal: senalConTiempo(15_000),
    });
    if (!previo) return { form: nuevo, meta: metaVacia(), origen: 'nuevo' };
    const { form, precargados } = aplicarPrecarga(nuevo, previo, p.existeProducto);
    return {
      form,
      meta: {
        precarga: { fecha: previo.fecha, turno: previo.turno, impulsadoraNombre: previo.impulsadoraNombre },
        sinConfirmar: precargados,
        existente: false,
      },
      origen: precargados.length ? 'precarga' : 'nuevo',
    };
  } catch (e) {
    if (e instanceof ErrorRed) return { form: nuevo, meta: metaVacia(), origen: 'sin-red' };
    return { form: nuevo, meta: metaVacia(), origen: 'nuevo' };
  }
}
