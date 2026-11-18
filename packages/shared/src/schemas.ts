import { z } from 'zod';
import { ROLES, TIPOS_DIA, TURNOS, UNIDADES } from './constantes.js';
import { esFechaValida } from './fechas.js';

/* ───────────── Básicos ───────────── */

export const FechaSchema = z
  .string()
  .refine(esFechaValida, { message: 'Fecha inválida (formato AAAA-MM-DD)' });

const num = (max = 1_000_000) =>
  z.number({ invalid_type_error: 'Debe ser un número' }).finite().min(0, 'No puede ser negativo').max(max);
const numNullable = (max?: number) => num(max).nullable().optional();
const entNullable = (max = 100_000) => z.number().int().min(0).max(max).nullable().optional();

export const CodProductoSchema = z.string().regex(/^[A-Za-z0-9_-]{1,20}$/, 'Código inválido');
export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones')
  .max(60);

/* ───────────── Fotos (Cloudinary) ───────────── */

export const FotoSchema = z.object({
  publicId: z.string().min(1).max(200),
  url: z.string().url().max(500),
});
export type Foto = z.infer<typeof FotoSchema>;

/* ───────────── Lotes ───────────── */

export const NovedadLoteSchema = z.object({
  tipo: z.string().min(1).max(60),
  nota: z.string().max(500).default(''),
  fotos: z.array(FotoSchema).max(3).default([]),
});
export type NovedadLote = z.infer<typeof NovedadLoteSchema>;

export const LoteSchema = z.object({
  /** id estable generado en el cliente (p. ej. nanoid) */
  id: z.string().min(1).max(40),
  /** kg si el producto es "kg"; unidades si es "und" */
  cantidad: num(100_000),
  /** null = el producto no tiene fecha legible (debería ir con novedad) */
  vto: FechaSchema.nullable(),
  novedad: NovedadLoteSchema.nullable().optional(),
});
export type Lote = z.infer<typeof LoteSchema>;

/* ───────────── Ítem de inventario ───────────── */

export const ItemSchema = z.object({
  /** Lotes al llegar. undefined = no registrado; [] = inventario 0. */
  lotesIni: z.array(LoteSchema).max(60).optional(),
  rec: numNullable(),
  ave: numNullable(),
  agot: z.boolean().default(false),
  /** Lotes al cierre. undefined = turno aún no cerrado para este producto. */
  lotesFin: z.array(LoteSchema).max(60).optional(),
});
export type Item = z.infer<typeof ItemSchema>;

/* ───────────── Secciones del registro ───────────── */

export const EjecSchema = z.object({
  exhib: z.enum(['Sí', 'Parcial', 'No']).nullable().optional(),
  frentesL: entNullable(1000),
  frentesC: entNullable(1000),
  precioOk: z.enum(['Sí', 'No']).nullable().optional(),
  pop: z.enum(['Sí', 'No']).nullable().optional(),
  temp: z.number().finite().min(-30).max(40).nullable().optional(),
});
export type Ejec = z.infer<typeof EjecSchema>;

export const CompSchema = z.record(
  z.string().max(60),
  z.object({ precio: numNullable(10_000_000), act: z.string().max(60).default('Ninguna') }),
);

export const ImpulsoSchema = z.object({
  abordados: entNullable(),
  degust: entNullable(),
  compras: entNullable(),
});

export const GeoInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisionM: z.number().min(0).max(100_000),
  /** ISO datetime de cuando se capturó (importante para registros offline) */
  capturadoEn: z.string().datetime(),
});
export type GeoInput = z.infer<typeof GeoInputSchema>;

export interface GeoRegistro extends GeoInput {
  distanciaPdvM: number | null;
  dentroDeRango: boolean | null;
}

/* ───────────── Registro (lo que envía el cliente) ───────────── */

export const RegistroInputSchema = z
  .object({
    fecha: FechaSchema,
    turno: z.enum(TURNOS),
    tipoDia: z.enum(TIPOS_DIA),
    pdvId: z.string().min(1).max(60),
    /** Solo lo usa admin para registrar a nombre de otra persona; para impulsadora el servidor lo ignora. */
    impulsadoraId: z.string().max(60).optional(),
    items: z.record(CodProductoSchema, ItemSchema).default({}),
    ejec: EjecSchema.default({}),
    comp: CompSchema.default({}),
    impulso: ImpulsoSchema.default({}),
    nov: z.array(z.string().max(80)).max(20).default([]),
    obs: z.string().max(2000).default(''),
    fotosGondola: z.array(FotoSchema).max(5).default([]),
    geo: GeoInputSchema.nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.tipoDia === 'Laboral' && !r.geo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['geo'],
        message: 'La ubicación es obligatoria para registrar un día laboral',
      });
    }
  });
export type RegistroInput = z.infer<typeof RegistroInputSchema>;

/** Resumen plano de riesgos (para consultas rápidas e índices). */
export interface RiesgoLote {
  cod: string;
  loteId: string;
  cantidad: number;
  vto: string;
  dias: number;
  nivel: 'vencido' | 'emergencia' | 'critico' | 'medio';
}

/** Registro tal como se guarda y devuelve la API. */
export interface Registro extends Omit<RegistroInput, 'geo' | 'impulsadoraId'> {
  _id: string;
  impulsadoraId: string;
  impulsadoraNombre: string;
  pdvNombre: string;
  ciudad: string;
  geo: GeoRegistro | null;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string;
  actualizadoPor: string;
  mismoDia: boolean;
  origen: 'online' | 'offline-sync';
  /** riesgos de los lotes finales (o iniciales si no hay cierre) calculados al guardar */
  riesgos: RiesgoLote[];
}

export function registroId(fecha: string, impulsadoraId: string, pdvId: string, turno: string) {
  return `${fecha}_${impulsadoraId}_${pdvId}_${turno}`;
}

export const SyncInputSchema = z.object({
  registros: z.array(RegistroInputSchema).min(1).max(50),
});

/* ───────────── Catálogos ───────────── */

export const UbicacionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const PdvSchema = z.object({
  _id: SlugSchema,
  nombre: z.string().min(1).max(80),
  cadena: z.string().max(60).default(''),
  ciudad: z.string().max(60).default(''),
  portafolio: z.array(CodProductoSchema).default([]),
  ubicacion: UbicacionSchema.nullable().default(null),
  radioM: z.number().int().min(50).max(5000).default(300),
  activo: z.boolean().default(true),
});
export type Pdv = z.infer<typeof PdvSchema>;

export const ProductoSchema = z.object({
  _id: CodProductoSchema,
  nombre: z.string().min(1).max(120),
  unidad: z.enum(UNIDADES),
  pesoKg: z.number().positive().max(100).nullable().default(null),
  activo: z.boolean().default(true),
});
export type Producto = z.infer<typeof ProductoSchema>;

export const MetasSchema = z.object({
  doh: z.number().positive().max(60),
  merma: z.number().min(0).max(1),
  osa: z.number().min(0).max(1),
  sos: z.number().min(0).max(1),
  conv: z.number().min(0).max(1),
});

export const UmbralesRiesgoSchema = z
  .object({
    medio: z.number().int().min(1).max(90),
    critico: z.number().int().min(1).max(90),
    emergencia: z.number().int().min(0).max(90),
  })
  .refine((u) => u.medio > u.critico && u.critico > u.emergencia, {
    message: 'Debe cumplirse: medio > crítico > emergencia',
  });

export const ConfigSchema = z.object({
  metas: MetasSchema,
  riesgoVto: UmbralesRiesgoSchema,
  marcasCompetencia: z.array(z.string().min(1).max(60)).max(30),
  novedadesGenerales: z.array(z.string().min(1).max(80)).max(30),
  novedadesProducto: z.array(z.string().min(1).max(60)).max(30),
});
export type Config = z.infer<typeof ConfigSchema>;

/* ───────────── Usuarios y auth ───────────── */

export const PasswordSchema = z
  .string()
  .min(6, 'Mínimo 6 caracteres')
  .max(72, 'Máximo 72 caracteres');

export const UsuarioNombreSchema = z
  .string()
  .min(3, 'Mínimo 3 caracteres')
  .max(30)
  .regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, punto, guion y guion bajo');

export const LoginInputSchema = z.object({
  usuario: z.string().trim().toLowerCase().pipe(UsuarioNombreSchema),
  password: z.string().min(1).max(72),
});

export const CambiarPasswordSchema = z.object({
  actual: z.string().min(1).max(72),
  nueva: PasswordSchema,
});

export const UsuarioCrearSchema = z.object({
  nombre: z.string().min(2).max(80),
  usuario: UsuarioNombreSchema,
  rol: z.enum(ROLES),
  ciudad: z.string().max(60).default(''),
  pdvIds: z.array(z.string().max(60)).max(100).default([]),
  activo: z.boolean().default(true),
});
export const UsuarioEditarSchema = UsuarioCrearSchema.partial();

export interface UsuarioPublico {
  _id: string;
  nombre: string;
  usuario: string;
  rol: (typeof ROLES)[number];
  ciudad: string;
  pdvIds: string[];
  activo: boolean;
  debeCambiarPassword: boolean;
  ultimoAcceso: string | null;
  bloqueadoHasta: string | null;
  creadoEn: string;
}

/* ───────────── Auditoría ───────────── */

export interface EventoAuditoria {
  _id: string;
  en: string;
  usuarioId: string | null;
  usuarioNombre: string;
  rol: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  /** texto legible en español, p. ej. "Editó registro de Mercacentro 4 (Mañana)" */
  resumen: string;
  cambios: Record<string, { antes: unknown; despues: unknown }> | null;
  ip: string | null;
  dispositivo: string | null;
  geo: { lat: number; lng: number } | null;
}
