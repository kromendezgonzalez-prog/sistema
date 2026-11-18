import type { Pdv, Producto, Rol, UsuarioPublico } from '@merca/shared';
import { useQuery } from '@tanstack/react-query';
import type { ZodError } from 'zod';
import { api } from '@/lib/api';

/* ───────── Consultas del panel admin (queryKey siempre empieza por 'admin') ───────── */

export const CLAVES = {
  usuarios: ['admin', 'usuarios'] as const,
  pdvs: ['admin', 'pdvs'] as const,
  productos: ['admin', 'productos'] as const,
};

export function useUsuariosAdmin() {
  return useQuery({
    queryKey: CLAVES.usuarios,
    queryFn: () => api<{ items: UsuarioPublico[] }>('/admin/usuarios').then((r) => r.items),
  });
}

export function usePdvsAdmin() {
  return useQuery({
    queryKey: CLAVES.pdvs,
    queryFn: () => api<{ items: Pdv[] }>('/admin/pdvs').then((r) => r.items),
  });
}

export function useProductosAdmin() {
  return useQuery({
    queryKey: CLAVES.productos,
    queryFn: () => api<{ items: Producto[] }>('/admin/productos').then((r) => r.items),
  });
}

/* ───────── Textos ───────── */

export const ROL_TEXTO: Record<Rol, string> = {
  admin: 'Administración',
  supervisor: 'Supervisión',
  impulsadora: 'Mercaimpulsadora',
};

/** Convierte los errores de Zod en { campo: mensaje } (primer mensaje por campo). */
export function erroresZod(
  e: ZodError,
  mensajes: Record<string, string> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? 'general');
    if (!out[k]) out[k] = mensajes[k] ?? i.message;
  }
  return out;
}

/** "Mercacentro 4" → "mercacentro-4" (sin tildes). */
export function aSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** "María Fernanda López" → "maria.lopez" */
export function sugerirUsuario(nombre: string): string {
  const p = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!p.length) return '';
  const ap = p.length >= 3 ? p[p.length - 2] : p[1];
  return (ap ? `${p[0]}.${ap}` : p[0]).slice(0, 30);
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');
}
