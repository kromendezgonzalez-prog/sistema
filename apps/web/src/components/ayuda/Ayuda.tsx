/**
 * Sistema de ayuda "?" contextual.
 * Cada página declara su tema con `useTemaAyuda('registrar.lotes')`; el botón flotante "?"
 * abre la hoja con el contenido de ese tema. Contenido en contenido-campo.ts y contenido-admin.ts.
 */
import { HelpCircle } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { HojaInferior } from '../ui';
import { AYUDA_CAMPO } from './contenido-campo';
import { AYUDA_ADMIN } from './contenido-admin';

export interface TemaAyuda {
  titulo: string;
  /** introducción corta */
  intro?: string;
  /** pasos numerados */
  pasos?: { titulo: string; texto: string }[];
  /** ejemplo concreto (p. ej. punta de anca con 5 lotes) */
  ejemplo?: { titulo: string; texto: string };
  /** preguntas frecuentes */
  faq?: { p: string; r: string }[];
}

export const TEMAS_AYUDA: Record<string, TemaAyuda> = { ...AYUDA_CAMPO, ...AYUDA_ADMIN };

const TEMA_GENERAL: TemaAyuda = {
  titulo: 'Ayuda',
  intro: 'Toca el botón "?" en cualquier pantalla para ver cómo usarla.',
};

interface Ctx {
  tema: string;
  setTema: (t: string) => void;
  abrir: (t?: string) => void;
}
const AyudaCtx = createContext<Ctx | null>(null);

export function AyudaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState('general');
  const [abierta, setAbierta] = useState<string | null>(null);
  const contenido = abierta ? (TEMAS_AYUDA[abierta] ?? TEMA_GENERAL) : null;

  return (
    <AyudaCtx.Provider value={{ tema, setTema, abrir: (t) => setAbierta(t ?? tema) }}>
      {children}
      <HojaInferior abierta={!!contenido} onCerrar={() => setAbierta(null)} titulo={contenido?.titulo ?? ''}>
        {contenido && <ContenidoAyuda t={contenido} />}
      </HojaInferior>
    </AyudaCtx.Provider>
  );
}

function ContenidoAyuda({ t }: { t: TemaAyuda }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      {t.intro && <p className="text-tinta-suave">{t.intro}</p>}
      {t.pasos && (
        <ol className="space-y-3">
          {t.pasos.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-marca-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{p.titulo}</p>
                <p className="text-tinta-suave">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {t.ejemplo && (
        <div className="rounded-xl bg-marca-50 p-3">
          <p className="font-semibold text-marca-800">💡 {t.ejemplo.titulo}</p>
          <p className="whitespace-pre-line text-marca-800/90">{t.ejemplo.texto}</p>
        </div>
      )}
      {t.faq && (
        <div className="space-y-2">
          <p className="font-semibold">Preguntas frecuentes</p>
          {t.faq.map((f, i) => (
            <details key={i} className="rounded-xl border border-black/10 p-3">
              <summary className="cursor-pointer font-medium">{f.p}</summary>
              <p className="mt-2 text-tinta-suave">{f.r}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function useAyuda() {
  const c = useContext(AyudaCtx);
  if (!c) throw new Error('useAyuda fuera de AyudaProvider');
  return c;
}

/** Declara el tema de ayuda de la pantalla actual. */
export function useTemaAyuda(tema: string) {
  const { setTema } = useAyuda();
  useEffect(() => {
    setTema(tema);
    return () => setTema('general');
  }, [tema, setTema]);
}

/** Botón "?" flotante (lo pone el AppShell). */
export function BotonAyuda({ className = '' }: { className?: string }) {
  const { abrir } = useAyuda();
  return (
    <button
      type="button"
      onClick={() => abrir()}
      aria-label="Ayuda: cómo usar esta pantalla"
      className={`grid h-11 w-11 place-items-center rounded-full bg-white text-marca-600 shadow-tarjeta ring-1 ring-black/5 transition hover:bg-marca-50 ${className}`}
    >
      <HelpCircle className="h-6 w-6" />
    </button>
  );
}

/** Botón "?" pequeño en línea para explicar un campo concreto. */
export function AyudaEnLinea({ tema, etiqueta = 'Ayuda' }: { tema: string; etiqueta?: string }) {
  const { abrir } = useAyuda();
  return (
    <button
      type="button"
      onClick={() => abrir(tema)}
      className="inline-grid h-8 w-8 place-items-center rounded-full text-marca-600 hover:bg-marca-50"
      aria-label={etiqueta}
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
