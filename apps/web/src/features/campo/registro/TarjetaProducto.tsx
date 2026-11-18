import { alertasItem, finOf, iniOf, nivelItem, ventaOf, type Producto, type UmbralesRiesgo } from '@merca/shared';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertOctagon, Check, ChevronDown, ChevronRight, History } from 'lucide-react';
import { memo } from 'react';
import { Boton, Chip, NivelChip } from '@/components/ui';
import { fmt } from '@/lib/formato';
import { CampoNumero, Interruptor } from '../componentes/CampoNumero';
import { cantidadTxt, nombreProducto, textoUnidad, unidadCorta } from '../util';
import { EditorLotes } from './EditorLotes';
import { tieneDatos, type Momento } from './modelo';
import { useRegistro } from './store';

export const TarjetaProducto = memo(function TarjetaProducto({
  producto,
  abierta,
  onAlternar,
  onSiguiente,
  onNovedad,
  hoy,
  umbrales,
}: {
  producto: Producto;
  abierta: boolean;
  onAlternar: () => void;
  onSiguiente?: () => void;
  onNovedad: (cod: string, m: Momento, loteId: string) => void;
  hoy: string;
  umbrales?: UmbralesRiesgo;
}) {
  const cod = producto._id;
  const it = useRegistro((s) => s.form.items[cod]);
  const fecha = useRegistro((s) => s.form.fecha);
  const sinConfirmar = useRegistro((s) => s.meta.sinConfirmar.includes(cod));
  const { setItem, confirmarPrecarga } = useRegistro.getState();
  const item = it ?? { agot: false };
  const u = unidadCorta(producto);

  const ini = iniOf(item);
  const fin = finOf(item);
  const venta = ventaOf(item);
  const nivel = nivelItem(item, hoy, umbrales);
  const alertas = alertasItem(item, fecha);
  const conDatos = tieneDatos(item);
  const idCuerpo = `prod-cuerpo-${cod}`;

  return (
    <article
      id={`prod-${cod}`}
      className={clsx(
        'scroll-mt-32 rounded-2xl border bg-white transition-colors',
        alertas.length ? 'border-error/60 bg-error-bg/30' : conDatos ? 'border-marca-600/25' : 'border-black/10',
      )}
      data-testid={`producto-${cod}`}
    >
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-tinta">{nombreProducto(producto)}</p>
          <p className="text-xs text-tinta-tenue">
            {cod} · {textoUnidad(producto)}
          </p>
          {(conDatos || sinConfirmar) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {ini !== null && <Chip>Inicial {fmt(ini, 2)}</Chip>}
              {fin !== null && <Chip>Final {fmt(fin, 2)}</Chip>}
              {venta !== null && (
                <Chip tono={venta < 0 ? 'error' : 'marca'} className="tabular-nums">
                  Venta {fmt(venta, 2)} {u}
                </Chip>
              )}
              {nivel !== 'ok' && <NivelChip nivel={nivel} />}
              {item.agot && <Chip tono="aviso">Agotado</Chip>}
              {sinConfirmar && (
                <Chip tono="aviso">
                  <History className="h-3 w-3" aria-hidden /> Precargado
                </Chip>
              )}
              {alertas.length > 0 && (
                <Chip tono="error">
                  <AlertOctagon className="h-3 w-3" aria-hidden /> {alertas.length} por revisar
                </Chip>
              )}
            </div>
          )}
        </div>
        <ChevronDown
          className={clsx('mt-1 h-5 w-5 shrink-0 text-tinta-tenue transition-transform', abierta && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            id={idCuerpo}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-black/5 p-3">
              {sinConfirmar && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-aviso-bg p-3 text-sm text-aviso">
                  <span>Lotes precargados del último cierre. Revísalos en la nevera.</span>
                  <Boton tam="sm" variante="secundario" icono={<Check className="h-4 w-4" />} onClick={() => confirmarPrecarga(cod)}>
                    Confirmar
                  </Boton>
                </div>
              )}

              <EditorLotes
                cod={cod}
                momento="ini"
                producto={producto}
                hoy={hoy}
                umbrales={umbrales}
                onNovedad={(id) => onNovedad(cod, 'ini', id)}
              />

              <div className="rounded-xl bg-black/[.03] p-3">
                <h4 className="mb-2 text-sm font-bold text-tinta">
                  Durante el turno
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <CampoNumero
                    etiqueta={`Recibido (${u})`}
                    compacto
                    valor={item.rec}
                    onValor={(v) => setItem(cod, { rec: v })}
                    entero={u === 'und'}
                    sufijo={u}
                    ayuda="Pedido que llegó"
                  />
                  <CampoNumero
                    etiqueta={`Avería (${u})`}
                    compacto
                    valor={item.ave}
                    onValor={(v) => setItem(cod, { ave: v })}
                    entero={u === 'und'}
                    sufijo={u}
                    ayuda="Dañado o devuelto"
                  />
                </div>
                <div className="mt-1">
                  <Interruptor
                    etiqueta="Agotado en góndola"
                    descripcion="No había producto para el cliente en algún momento"
                    activo={!!item.agot}
                    onCambio={(v) => setItem(cod, { agot: v })}
                  />
                </div>
              </div>

              <EditorLotes
                cod={cod}
                momento="fin"
                producto={producto}
                hoy={hoy}
                umbrales={umbrales}
                onNovedad={(id) => onNovedad(cod, 'fin', id)}
              />

              <div
                className={clsx(
                  'rounded-xl p-3 text-sm',
                  venta !== null && venta < 0 ? 'bg-error-bg text-error' : 'bg-marca-50 text-marca-800',
                )}
                aria-live="polite"
              >
                <p className="font-bold" data-testid="venta-en-vivo">
                  Venta: {venta === null ? '–' : cantidadTxt(venta, producto)}
                </p>
                <p className="text-xs opacity-80">
                  {venta === null
                    ? 'Se calcula sola cuando registres los lotes al llegar y al cierre.'
                    : `Inicial ${fmt(ini, 2)} + recibido ${fmt(item.rec ?? 0, 2)} − final ${fmt(fin, 2)} − avería ${fmt(item.ave ?? 0, 2)}`}
                </p>
              </div>

              {alertas.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-error-bg p-3 text-sm text-error" role="alert">
                  {alertas.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {a.mensaje}
                    </li>
                  ))}
                </ul>
              )}

              {onSiguiente && (
                <Boton variante="fantasma" bloque onClick={onSiguiente} icono={<ChevronRight className="h-5 w-5" />}>
                  Siguiente producto
                </Boton>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
});
