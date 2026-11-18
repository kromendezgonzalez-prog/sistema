import { NOVEDADES_PRODUCTO, type Foto, type Producto } from '@merca/shared';
import { useEffect, useId, useState } from 'react';
import { AyudaEnLinea } from '@/components/ayuda/Ayuda';
import { Boton, HojaInferior, Pildoras } from '@/components/ui';
import { borrarFotoLocal } from '@/lib/fotos';
import { FotosInput } from '../componentes/FotosInput';
import { cantidadTxt, nombreProducto } from '../util';
import { campoLotes, type Momento } from './modelo';
import { useRegistro } from './store';

export interface DestinoNovedad {
  cod: string;
  momento: Momento;
  loteId: string;
}

/** Hoja inferior para reportar la novedad de un lote: tipo + nota + fotos de cámara. */
export function HojaNovedad({
  destino,
  onCerrar,
  tipos,
  producto,
}: {
  destino: DestinoNovedad | null;
  onCerrar: () => void;
  tipos?: string[];
  producto?: Producto;
}) {
  const lote = useRegistro((s) =>
    destino ? s.form.items[destino.cod]?.[campoLotes(destino.momento)]?.find((l) => l.id === destino.loteId) : undefined,
  );
  const [tipo, setTipo] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [intento, setIntento] = useState(false);
  const idNota = useId();
  const opciones = tipos?.length ? tipos : NOVEDADES_PRODUCTO;

  useEffect(() => {
    if (!destino) return;
    setTipo(lote?.novedad?.tipo ?? null);
    setNota(lote?.novedad?.nota ?? '');
    setFotos(lote?.novedad?.fotos ?? []);
    setIntento(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino?.loteId]);

  const cerrarSinGuardar = () => {
    // fotos tomadas en esta hoja que no se guardaron
    const guardadas = new Set((lote?.novedad?.fotos ?? []).map((f) => f.publicId));
    fotos.filter((f) => !guardadas.has(f.publicId)).forEach((f) => void borrarFotoLocal(f));
    onCerrar();
  };

  const guardar = () => {
    if (!destino) return;
    if (!tipo) return setIntento(true);
    useRegistro.getState().setNovedad(destino.cod, destino.momento, destino.loteId, { tipo, nota: nota.trim(), fotos });
    onCerrar();
  };

  const quitar = () => {
    if (!destino) return;
    fotos.forEach((f) => void borrarFotoLocal(f));
    useRegistro.getState().setNovedad(destino.cod, destino.momento, destino.loteId, null);
    onCerrar();
  };

  return (
    <HojaInferior
      abierta={!!destino && !!lote}
      onCerrar={cerrarSinGuardar}
      titulo="Reportar novedad"
      pie={
        <div className="flex gap-2">
          {lote?.novedad && (
            <Boton variante="fantasma" onClick={quitar}>
              Quitar novedad
            </Boton>
          )}
          <Boton className="flex-1" tam="lg" onClick={guardar}>
            Guardar novedad
          </Boton>
        </div>
      }
    >
      {lote && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2 rounded-xl bg-black/[.04] p-3 text-sm">
            <div>
              <p className="font-semibold">{nombreProducto(producto, destino?.cod)}</p>
              <p className="text-tinta-suave">
                {destino?.momento === 'ini' ? 'Al llegar' : 'Al cierre'} · {cantidadTxt(lote.cantidad, producto)}
                {lote.vto ? ` · vence ${lote.vto}` : ' · sin fecha'}
              </p>
            </div>
            <AyudaEnLinea tema="registrar.novedad" etiqueta="Ayuda sobre novedades" />
          </div>
          <div>
            <Pildoras etiqueta="¿Qué pasó?" opciones={opciones} valor={tipo} onChange={(v) => setTipo(v)} />
            {intento && !tipo && (
              <p className="mt-1 text-sm text-error" role="alert">
                Elige el tipo de novedad.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={idNota} className="etiqueta">
              Nota (opcional)
            </label>
            <textarea
              id={idNota}
              className="campo !h-24 py-2"
              maxLength={500}
              placeholder="Ej.: el vacío está suelto, se informó al jefe de carnes."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
          <FotosInput fotos={fotos} onCambio={setFotos} max={3} contexto="novedad" etiqueta="Fotos del lote" />
        </div>
      )}
    </HojaInferior>
  );
}
