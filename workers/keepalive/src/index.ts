/**
 * Keep-alive: el plan gratis de Render apaga la API tras ~15 min sin tráfico.
 * Este Worker hace GET {API_URL}/health cada 10 min en horario laboral (ver wrangler.jsonc).
 * Alternativa: pasar la API al plan pago "Starter" de Render y eliminar este Worker.
 */

export interface Env {
  /** URL base de la API, p. ej. https://mercaimpulso-api.onrender.com (sin "/" al final) */
  API_URL: string;
}

/* Tipos mínimos para no depender de @cloudflare/workers-types */
interface ScheduledController {
  cron: string;
  scheduledTime: number;
}
interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void;
}

async function ping(env: Env): Promise<{ ok: boolean; status: number; ms: number }> {
  const url = `${env.API_URL.replace(/\/$/, '')}/health`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': 'mercaimpulso-keepalive' },
      signal: AbortSignal.timeout(60_000), // la API puede tardar en despertar
    });
    const res = { ok: r.ok, status: r.status, ms: Date.now() - t0 };
    console.log(`keep-alive ${url} → ${r.status} en ${res.ms} ms`);
    return res;
  } catch (e) {
    console.log(`keep-alive ${url} falló: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, status: 0, ms: Date.now() - t0 };
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ping(env));
  },

  /** Visitar la URL del Worker hace un ping manual (útil para probar). */
  async fetch(_req: Request, env: Env): Promise<Response> {
    const r = await ping(env);
    return new Response(JSON.stringify(r), {
      status: r.ok ? 200 : 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  },
};
