/** localStorage seguro (puede fallar en modo privado). Solo para comodidades, nunca datos críticos. */
export function leerLS<T>(k: string, def: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
}
export function escribirLS(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignorar */
  }
}
export function borrarLS(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignorar */
  }
}
