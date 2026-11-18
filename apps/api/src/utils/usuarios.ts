import type { UsuarioPublico } from '@merca/shared';

type UsuarioLike = {
  _id: string;
  nombre: string;
  usuario: string;
  rol: string;
  ciudad?: string | null;
  pdvIds?: string[] | null;
  activo?: boolean | null;
  debeCambiarPassword?: boolean | null;
  ultimoAcceso?: Date | null;
  bloqueadoHasta?: Date | null;
  creadoEn?: Date | null;
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Vista pública del usuario: sin hash ni datos internos. */
export function usuarioPublico(u: UsuarioLike): UsuarioPublico {
  const bloqueo = u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date() ? u.bloqueadoHasta : null;
  return {
    _id: String(u._id),
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol as UsuarioPublico['rol'],
    ciudad: u.ciudad ?? '',
    pdvIds: [...(u.pdvIds ?? [])],
    activo: u.activo !== false,
    debeCambiarPassword: !!u.debeCambiarPassword,
    ultimoAcceso: iso(u.ultimoAcceso),
    bloqueadoHasta: iso(bloqueo),
    creadoEn: iso(u.creadoEn) ?? new Date(0).toISOString(),
  };
}
