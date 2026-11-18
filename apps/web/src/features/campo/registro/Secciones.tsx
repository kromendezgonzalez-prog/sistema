import { ACTIVIDADES_COMPETENCIA, MARCAS_COMPETENCIA_DEF, NOVEDADES_GENERALES, TEMP_MAX_NEVERA } from '@merca/shared';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Thermometer } from 'lucide-react';
import { useId } from 'react';
import { AyudaEnLinea } from '@/components/ayuda/Ayuda';
import { Pildoras, Tarjeta } from '@/components/ui';
import { pct } from '@/lib/formato';
import { CampoNumero, PildorasOpcionales } from '../componentes/CampoNumero';
import { FotosInput } from '../componentes/FotosInput';
import { useRegistro } from './store';

/* ───────── Góndola y precio ───────── */

export function Gondola({ numero }: { numero: number }) {
  const ejec = useRegistro((s) => s.form.ejec);
  const fotos = useRegistro((s) => s.form.fotosGondola);
  const set = useRegistro((s) => s.set);
  const cambiar = (p: Partial<typeof ejec>) => set('ejec', { ...useRegistro.getState().form.ejec, ...p });
  const tempAlta = ejec.temp !== null && ejec.temp !== undefined && ejec.temp > TEMP_MAX_NEVERA;

  return (
    <Tarjeta numero={numero} titulo="Góndola y precio" accion={<AyudaEnLinea tema="registrar.gondola" etiqueta="Ayuda sobre góndola" />}>
      <div id="seccion-gondola" className="scroll-mt-32 space-y-4">
        <PildorasOpcionales
          etiqueta="Exhibición según lo acordado"
          opciones={['Sí', 'Parcial', 'No'] as const}
          valor={ejec.exhib}
          onCambio={(v) => cambiar({ exhib: v })}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CampoNumero etiqueta="Frentes LOMUS" entero valor={ejec.frentesL} onValor={(v) => cambiar({ frentesL: v })} />
          <CampoNumero etiqueta="Frentes competencia" entero valor={ejec.frentesC} onValor={(v) => cambiar({ frentesC: v })} />
          <CampoNumero
            etiqueta="Temp. nevera"
            negativo
            valor={ejec.temp}
            onValor={(v) => cambiar({ temp: v })}
            sufijo="°C"
            error={tempAlta ? `Más de ${String(TEMP_MAX_NEVERA).replace('.', ',')} °C: avisa al jefe de carnes.` : null}
            className="col-span-2 sm:col-span-1"
          />
        </div>
        {tempAlta && (
          <p className="flex items-center gap-2 text-sm text-error">
            <Thermometer className="h-4 w-4" aria-hidden /> Reporta la falla de frío en Novedades.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <PildorasOpcionales
            etiqueta="Precio LOMUS bien marcado"
            opciones={['Sí', 'No'] as const}
            valor={ejec.precioOk}
            onCambio={(v) => cambiar({ precioOk: v })}
          />
          <PildorasOpcionales
            etiqueta="Material POP instalado"
            opciones={['Sí', 'No'] as const}
            valor={ejec.pop}
            onCambio={(v) => cambiar({ pop: v })}
          />
        </div>
        <FotosInput
          fotos={fotos}
          onCambio={(f) => set('fotosGondola', f)}
          max={5}
          contexto="gondola"
          etiqueta="Fotos de la góndola (opcional)"
        />
      </div>
    </Tarjeta>
  );
}

/* ───────── Competencia ───────── */

export function Competencia({ numero, marcas }: { numero: number; marcas?: string[] }) {
  const comp = useRegistro((s) => s.form.comp);
  const set = useRegistro((s) => s.set);
  const lista = marcas?.length ? marcas : MARCAS_COMPETENCIA_DEF;
  const actual = () => useRegistro.getState().form.comp;

  const alternar = (m: string) => {
    const c = { ...actual() };
    if (c[m]) delete c[m];
    else c[m] = { precio: null, act: 'Ninguna' };
    set('comp', c);
  };
  const cambiar = (m: string, p: Partial<{ precio: number | null; act: string }>) =>
    set('comp', { ...actual(), [m]: { ...(actual()[m] ?? { act: 'Ninguna' }), ...p } });

  return (
    <Tarjeta numero={numero} titulo="Competencia" accion={<AyudaEnLinea tema="registrar.competencia" etiqueta="Ayuda sobre competencia" />}>
      <div id="seccion-competencia" className="scroll-mt-32">
        <p className="-mt-1 mb-3 text-sm text-tinta-suave">
          Marca solo las que viste hoy. Precio por kg de un corte comparable (ej. costilla).
        </p>
        <div className="space-y-2">
          {lista.map((m) => {
            const v = comp[m];
            return (
              <div
                key={m}
                className={clsx('rounded-xl border transition', v ? 'border-marca-600/30 bg-marca-50/40' : 'border-black/10 bg-white')}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!v}
                  onClick={() => alternar(m)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3 text-left"
                >
                  <span
                    className={clsx(
                      'grid h-6 w-6 place-items-center rounded-md border-2 transition',
                      v ? 'border-marca-600 bg-marca-600 text-white' : 'border-black/25',
                    )}
                    aria-hidden
                  >
                    {v && <Check className="h-4 w-4" />}
                  </span>
                  <span className="font-semibold">{m}</span>
                  {v?.precio ? (
                    <span className="ml-auto text-sm tabular-nums text-tinta-suave">
                      ${v.precio.toLocaleString('es-CO')}/kg
                    </span>
                  ) : null}
                </button>
                <AnimatePresence initial={false}>
                  {v && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 px-3 pb-3">
                        <CampoNumero
                          etiqueta={`Precio ${m} ($/kg)`}
                          entero
                          valor={v.precio}
                          onValor={(p) => cambiar(m, { precio: p })}
                          sufijo="$/kg"
                          placeholder="Ej.: 21900"
                        />
                        <Pildoras
                          etiqueta="Actividad"
                          opciones={ACTIVIDADES_COMPETENCIA}
                          valor={v.act}
                          onChange={(a) => cambiar(m, { act: a })}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </Tarjeta>
  );
}

/* ───────── Impulso ───────── */

export function Impulso({ numero }: { numero: number }) {
  const imp = useRegistro((s) => s.form.impulso);
  const set = useRegistro((s) => s.set);
  const cambiar = (p: Partial<typeof imp>) => set('impulso', { ...useRegistro.getState().form.impulso, ...p });
  const conv = imp.abordados && imp.abordados > 0 && imp.compras !== null && imp.compras !== undefined ? imp.compras / imp.abordados : null;
  const raro = (imp.compras ?? 0) > (imp.abordados ?? Infinity);

  return (
    <Tarjeta numero={numero} titulo="Impulso al cliente" accion={<AyudaEnLinea tema="registrar.impulso" etiqueta="Ayuda sobre impulso" />}>
      <div id="seccion-impulso" className="scroll-mt-32 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <CampoNumero etiqueta="Abordados" entero valor={imp.abordados} onValor={(v) => cambiar({ abordados: v })} />
          <CampoNumero etiqueta="Degustaciones" entero valor={imp.degust} onValor={(v) => cambiar({ degust: v })} />
          <CampoNumero etiqueta="Compras" entero valor={imp.compras} onValor={(v) => cambiar({ compras: v })} />
        </div>
        <div
          className={clsx('rounded-xl p-3 text-sm', raro ? 'bg-error-bg text-error' : 'bg-marca-50 text-marca-800')}
          aria-live="polite"
        >
          {raro ? (
            'Las compras no pueden ser más que las personas abordadas.'
          ) : conv === null ? (
            'La conversión (compras ÷ abordados) aparece cuando escribas abordados y compras.'
          ) : (
            <>
              Conversión: <b className="text-base">{pct(conv)}</b> <span className="opacity-80">(compras ÷ abordados)</span>
            </>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

/* ───────── Novedades generales ───────── */

export function Novedades({ numero, opciones }: { numero: number; opciones?: string[] }) {
  const nov = useRegistro((s) => s.form.nov);
  const obs = useRegistro((s) => s.form.obs);
  const set = useRegistro((s) => s.set);
  const id = useId();
  const lista = opciones?.length ? opciones : NOVEDADES_GENERALES;
  return (
    <Tarjeta numero={numero} titulo="Novedades" accion={<AyudaEnLinea tema="registrar.guardar" etiqueta="Ayuda sobre novedades y guardar" />}>
      <div id="seccion-novedades" className="scroll-mt-32 space-y-3">
        <Pildoras
          etiqueta="¿Pasó algo hoy? (puedes marcar varias)"
          multiple
          opciones={lista}
          valor={nov}
          onChange={(n) => {
            const actual = useRegistro.getState().form.nov;
            set('nov', actual.includes(n) ? actual.filter((x) => x !== n) : [...actual, n]);
          }}
        />
        <div>
          <label htmlFor={id} className="etiqueta">
            Observaciones
          </label>
          <textarea
            id={id}
            className="campo !h-28 py-2"
            maxLength={2000}
            placeholder="Qué pasó y a quién se le informó"
            value={obs}
            onChange={(e) => set('obs', e.target.value)}
          />
        </div>
      </div>
    </Tarjeta>
  );
}
