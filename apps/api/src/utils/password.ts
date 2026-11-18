import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const COSTE = 10;

export function hashPassword(plano: string) {
  return bcrypt.hash(plano, COSTE);
}

export function verificarPassword(plano: string, hash: string) {
  return bcrypt.compare(plano, hash);
}

/** Hash de relleno para comparar cuando el usuario no existe (mismo tiempo de respuesta). */
const HASH_FALSO = bcrypt.hashSync('relleno-no-valido', COSTE);
export function compararFalso(plano: string) {
  return bcrypt.compare(plano, HASH_FALSO);
}

/** Sin caracteres confundibles: 0/O/o, 1/l/I. */
const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Contraseña temporal legible, p. ej. "Lomus-4k7p". Se muestra una sola vez y no se guarda. */
export function generarPasswordTemporal(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return `Lomus-${s}`;
}
