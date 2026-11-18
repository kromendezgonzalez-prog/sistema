/** Constantes de negocio compartidas por web y api. */

export const TURNOS = ['Mañana', 'Tarde', 'Completa'] as const;
export type Turno = (typeof TURNOS)[number];

export const TIPOS_DIA = [
  'Laboral',
  'Descanso',
  'Festivo',
  'Incapacidad',
  'Capacitación',
  'Vacaciones',
] as const;
export type TipoDia = (typeof TIPOS_DIA)[number];

export const ROLES = ['admin', 'supervisor', 'impulsadora'] as const;
export type Rol = (typeof ROLES)[number];

export const UNIDADES = ['kg', 'und'] as const;
export type Unidad = (typeof UNIDADES)[number];

/** Novedades generales del registro (igual al prototipo). */
export const NOVEDADES_GENERALES = [
  'Producto en mal estado',
  'Faltante en pedido',
  'Precio errado',
  'Falla cadena de frío',
  'Espacio reducido / sin exhibición',
  'Competencia con promoción',
  'Otro',
];

/** Novedades por lote de producto (con nota y foto). */
export const NOVEDADES_PRODUCTO = [
  'Vacío perdido',
  'Empaque abierto / roto',
  'Cambio de color / olor',
  'Golpe / daño',
  'Etiqueta ilegible',
  'Sin fecha de vencimiento',
  'Otro',
];

export const MARCAS_COMPETENCIA_DEF = [
  'Colanta',
  'Porcicarnes',
  'Cervalle',
  'Supercerdo',
  'Zenú',
  'Marca propia cadena',
  'Otra',
];

export const ACTIVIDADES_COMPETENCIA = [
  'Ninguna',
  'Precio promocional',
  'Degustación',
  'Impulsadora',
  'Exhibición adicional',
  'Otra',
];

export interface Metas {
  /** Días de inventario máximos */
  doh: number;
  /** % merma máximo (0–1) */
  merma: number;
  /** On-shelf availability mínima (0–1) */
  osa: number;
  /** Share of shelf mínimo (0–1) */
  sos: number;
  /** Conversión mínima de impulso (0–1) */
  conv: number;
}

export const METAS_DEF: Metas = { doh: 4, merma: 0.02, osa: 0.95, sos: 0.3, conv: 0.15 };

/** Umbrales de riesgo de vencimiento (días). dias <= umbral → ese nivel. */
export interface UmbralesRiesgo {
  medio: number;
  critico: number;
  emergencia: number;
}

export const RIESGO_DEF: UmbralesRiesgo = { medio: 10, critico: 7, emergencia: 5 };

/** Radio por defecto (m) para considerar que la trabajadora está en el punto. */
export const RADIO_PDV_DEF_M = 300;

/** Temperatura máxima de nevera (°C). */
export const TEMP_MAX_NEVERA = 4.4;

/** Días hacia atrás permitidos para crear/editar un registro (impulsadora). */
export const DIAS_EDICION = 3;

/** Vencimiento a más de N días se marca como sospechoso. */
export const VTO_MAX_DIAS = 120;

export const ACCIONES_AUDITORIA = [
  'LOGIN_OK',
  'LOGIN_FALLIDO',
  'LOGOUT',
  'BLOQUEO',
  'PASSWORD_CAMBIADA',
  'PASSWORD_RESETEADA',
  'REGISTRO_CREADO',
  'REGISTRO_EDITADO',
  'REGISTRO_SYNC_OFFLINE',
  'GPS_FUERA_DE_RANGO',
  'FOTO_SUBIDA',
  'USUARIO_CREADO',
  'USUARIO_EDITADO',
  'PDV_CREADO',
  'PDV_EDITADO',
  'PDV_UBICACION_FIJADA',
  'PRODUCTO_CREADO',
  'PRODUCTO_EDITADO',
  'CONFIG_CAMBIADA',
  'EXPORT_EXCEL',
  'BACKUP_EXCEL',
] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];
