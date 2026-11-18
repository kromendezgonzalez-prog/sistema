// Variable opcional del login (Cloudflare Turnstile). Se declara aquí para no tocar vite-env.d.ts.
interface ImportMetaEnv {
  readonly VITE_TURNSTILE_SITEKEY?: string;
}
