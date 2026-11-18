/**
 * Cloudflare Turnstile (captcha invisible) para el login.
 * Solo se activa si existe VITE_TURNSTILE_SITEKEY.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface ApiTurnstile {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

export const SITEKEY_TURNSTILE: string | undefined = import.meta.env.VITE_TURNSTILE_SITEKEY || undefined;

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let cargaScript: Promise<void> | null = null;

function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  cargaScript ??= new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = URL_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => res();
    s.onerror = () => {
      cargaScript = null;
      rej(new Error('No se pudo cargar la verificación'));
    };
    document.head.appendChild(s);
  });
  return cargaScript;
}

export interface TurnstileRef {
  reset: () => void;
}

export const Turnstile = forwardRef<TurnstileRef, { sitekey: string; onToken: (t: string | null) => void }>(
  function Turnstile({ sitekey, onToken }, ref) {
    const div = useRef<HTMLDivElement>(null);
    const widget = useRef<string | null>(null);
    const cb = useRef(onToken);
    cb.current = onToken;

    useImperativeHandle(ref, () => ({
      reset: () => {
        cb.current(null);
        if (widget.current) window.turnstile?.reset(widget.current);
      },
    }));

    useEffect(() => {
      let vivo = true;
      cargarScript()
        .then(() => {
          if (!vivo || !div.current || !window.turnstile) return;
          widget.current = window.turnstile.render(div.current, {
            sitekey,
            language: 'es',
            appearance: 'interaction-only',
            callback: (t: string) => cb.current(t),
            'expired-callback': () => cb.current(null),
            'error-callback': () => cb.current(null),
          });
        })
        .catch(() => cb.current(null));
      return () => {
        vivo = false;
        if (widget.current) window.turnstile?.remove(widget.current);
        widget.current = null;
      };
    }, [sitekey]);

    return <div ref={div} className="flex justify-center empty:hidden" />;
  },
);
