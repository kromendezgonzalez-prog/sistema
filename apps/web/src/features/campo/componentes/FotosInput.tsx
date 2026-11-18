import type { Foto } from '@merca/shared';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CloudOff, Check, ImageOff, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import {
  borrarFotoLocal,
  esFotoLocal,
  guardarFotoLocal,
  idFotoLocal,
  subirFotoLocal,
  useFotoSrc,
  type ContextoFoto,
} from '@/lib/fotos';
import { db } from '@/offline/db';

/** Miniatura con estado de subida (en el celular / subida). */
export function Miniatura({ foto, onQuitar, alt }: { foto: Foto; onQuitar?: () => void; alt: string }) {
  const src = useFotoSrc(foto);
  const local = esFotoLocal(foto);
  const reg = useLiveQuery(() => (local ? db.fotosPendientes.get(idFotoLocal(foto)) : undefined), [foto.publicId]);
  const subida = !local || !!reg?.subida;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black/5 ring-1 ring-black/10"
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-tinta-tenue">
          <ImageOff className="h-6 w-6" aria-hidden />
        </div>
      )}
      <span
        className={clsx(
          'absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
          subida ? 'bg-ok-bg text-ok' : 'bg-white/90 text-aviso',
        )}
      >
        {subida ? <Check className="h-3 w-3" aria-hidden /> : <CloudOff className="h-3 w-3" aria-hidden />}
        {subida ? 'Subida' : 'En el celular'}
      </span>
      {onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          aria-label="Quitar foto"
          className="absolute right-0 top-0 grid h-11 w-11 place-items-start justify-end p-1"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
            <X className="h-4 w-4" />
          </span>
        </button>
      )}
    </motion.div>
  );
}

/**
 * Tomar fotos con la cámara. Cada foto se comprime y se guarda primero en el celular;
 * se intenta subir de una vez y, si no hay señal, se sube al sincronizar.
 */
export function FotosInput({
  fotos,
  onCambio,
  max,
  contexto,
  etiqueta = 'Fotos',
  textoBoton = 'Tomar foto',
}: {
  fotos: Foto[];
  onCambio: (f: Foto[]) => void;
  max: number;
  contexto: ContextoFoto;
  etiqueta?: string;
  textoBoton?: string;
}) {
  const { usuario } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const actuales = useRef(fotos);
  actuales.current = fotos;
  const [procesando, setProcesando] = useState(false);

  const alElegir = async (files: FileList | null) => {
    if (!files?.length || !usuario) return;
    setProcesando(true);
    try {
      const nuevas: Foto[] = [];
      for (const file of Array.from(files).slice(0, max - actuales.current.length)) {
        const f = await guardarFotoLocal(file, contexto, usuario._id);
        nuevas.push(f);
        // subida inmediata en segundo plano; si falla, se reintenta al sincronizar
        void subirFotoLocal(idFotoLocal(f)).catch(() => undefined);
      }
      onCambio([...actuales.current, ...nuevas]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la foto.');
    } finally {
      setProcesando(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const quitar = (f: Foto) => {
    onCambio(actuales.current.filter((x) => x.publicId !== f.publicId));
    void borrarFotoLocal(f);
  };

  const lleno = fotos.length >= max;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="etiqueta !mb-0">{etiqueta}</span>
        <span className="text-xs text-tinta-tenue">
          {fotos.length} de {max}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {fotos.map((f, i) => (
            <Miniatura key={f.publicId} foto={f} alt={`${etiqueta} ${i + 1}`} onQuitar={() => quitar(f)} />
          ))}
        </AnimatePresence>
        {!lleno && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={procesando}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-marca-600/30 bg-marca-50/50 text-xs font-semibold text-marca-700 transition hover:bg-marca-50 disabled:opacity-60"
          >
            {procesando ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Camera className="h-6 w-6" aria-hidden />}
            {procesando ? 'Procesando…' : textoBoton}
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label={textoBoton}
        onChange={(e) => void alElegir(e.target.files)}
      />
    </div>
  );
}
