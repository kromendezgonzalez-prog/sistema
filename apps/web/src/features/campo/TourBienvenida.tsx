import clsx from 'clsx';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { CloudOff, HelpCircle, Layers, MapPin, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Boton } from '@/components/ui';
import { escribirLS, leerLS } from '@/lib/almacen';

const clave = (usuarioId: string) => `merca.tourVisto.${usuarioId}`;
export const tourVisto = (usuarioId: string) => leerLS<boolean>(clave(usuarioId), false);
export const marcarTourVisto = (usuarioId: string) => escribirLS(clave(usuarioId), true);

interface Paso {
  icono: ReactNode;
  titulo: string;
  texto: string;
}

const PASOS: Paso[] = [
  {
    icono: <MapPin className="h-10 w-10" />,
    titulo: 'Llega y toma tu ubicación',
    texto:
      'Toca "Iniciar conteo" en tu punto. La app confirma con el GPS que estás en el almacén, una sola vez por turno.',
  },
  {
    icono: <Layers className="h-10 w-10" />,
    titulo: 'Cuenta por lotes',
    texto:
      'Cada pieza o grupo de paquetes con la misma fecha es un lote. Registra los lotes al llegar y al cierre: la venta se calcula sola y los colores te avisan qué está por vencer.',
  },
  {
    icono: <CloudOff className="h-10 w-10" />,
    titulo: '¿Sin señal en la nevera? Tranquila',
    texto:
      'Todo se guarda en el celular, incluso las fotos. Cuando vuelva la señal se envía solo. Verás un aviso amarillo mientras haya algo pendiente.',
  },
  {
    icono: <HelpCircle className="h-10 w-10" />,
    titulo: 'Si tienes dudas, toca "?"',
    texto: 'En cada pantalla hay un botón "?" con pasos y ejemplos. ¡Bienvenida al equipo LOMUS!',
  },
];

/** Tour corto de bienvenida (tarjetas deslizables). */
export function TourBienvenida({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  useEffect(() => {
    if (abierto) setI(0);
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') ir(1);
      if (e.key === 'ArrowLeft') ir(-1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, i]);

  const ir = (d: number) => {
    const n = i + d;
    if (n < 0) return;
    if (n >= PASOS.length) return onCerrar();
    setDir(d);
    setI(n);
  };
  const alSoltar = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) ir(1);
    else if (info.offset.x > 60) ir(-1);
  };
  const p = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-titulo"
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <button
              type="button"
              onClick={onCerrar}
              className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full text-tinta-suave hover:bg-black/5"
              aria-label="Cerrar el tour"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative h-[19rem] overflow-hidden">
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                <motion.div
                  key={i}
                  custom={dir}
                  variants={{
                    entra: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
                    centro: { x: 0, opacity: 1 },
                    sale: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
                  }}
                  initial="entra"
                  animate="centro"
                  exit="sale"
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={alSoltar}
                  className="absolute inset-0 flex cursor-grab flex-col items-center justify-center gap-4 px-8 text-center active:cursor-grabbing"
                >
                  <div className="grid h-20 w-20 place-items-center rounded-3xl bg-marca-50 text-marca-600">{p.icono}</div>
                  <h2 id="tour-titulo" className="text-xl font-extrabold text-tinta">
                    {p.titulo}
                  </h2>
                  <p className="text-[15px] leading-relaxed text-tinta-suave">{p.texto}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-center gap-2 pb-2" aria-label={`Paso ${i + 1} de ${PASOS.length}`}>
              {PASOS.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setDir(k > i ? 1 : -1);
                    setI(k);
                  }}
                  aria-label={`Ir al paso ${k + 1}`}
                  aria-current={k === i ? 'step' : undefined}
                  className="grid h-8 w-8 place-items-center"
                >
                  <span className={clsx('h-2 rounded-full transition-all', k === i ? 'w-6 bg-marca-600' : 'w-2 bg-black/15')} />
                </button>
              ))}
            </div>
            <div className="flex gap-2 p-4 pt-1">
              {i > 0 ? (
                <Boton variante="fantasma" onClick={() => ir(-1)}>
                  Atrás
                </Boton>
              ) : (
                <Boton variante="fantasma" onClick={onCerrar}>
                  Saltar
                </Boton>
              )}
              <Boton className="flex-1" tam="lg" onClick={() => ir(1)}>
                {ultimo ? '¡Empezar!' : 'Siguiente'}
              </Boton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
