import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const URL_VERIFICACION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** true si Turnstile está activo (hay TURNSTILE_SECRET). */
export const turnstileActivo = () => !!env.TURNSTILE_SECRET;

/** Verifica un token de Cloudflare Turnstile. */
export async function verificarTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch(URL_VERIFICACION, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await r.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    logger.warn({ err: e }, 'No se pudo verificar Turnstile');
    return false;
  }
}
