import { ACCIONES_AUDITORIA, type AccionAuditoria } from '@merca/shared';
import {
  Camera,
  ClipboardEdit,
  ClipboardPlus,
  CloudUpload,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Package,
  Settings,
  ShieldAlert,
  Store,
  UserCog,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export type GrupoAccion =
  'Sesión' | 'Registros' | 'Usuarios' | 'Catálogo' | 'Configuración' | 'Descargas';
export type TonoAccion = 'neutro' | 'ok' | 'aviso' | 'error' | 'marca';

export interface InfoAccion {
  etiqueta: string;
  grupo: GrupoAccion;
  tono: TonoAccion;
  Icono: LucideIcon;
}

/** Etiqueta legible en español, grupo, tono e ícono de cada acción de auditoría. */
export const INFO_ACCION: Record<AccionAuditoria, InfoAccion> = {
  LOGIN_OK: { etiqueta: 'Inicio de sesión', grupo: 'Sesión', tono: 'ok', Icono: LogIn },
  LOGIN_FALLIDO: {
    etiqueta: 'Intento de ingreso fallido',
    grupo: 'Sesión',
    tono: 'aviso',
    Icono: ShieldAlert,
  },
  LOGOUT: { etiqueta: 'Cierre de sesión', grupo: 'Sesión', tono: 'neutro', Icono: LogOut },
  BLOQUEO: {
    etiqueta: 'Usuario bloqueado por intentos',
    grupo: 'Sesión',
    tono: 'error',
    Icono: Lock,
  },
  PASSWORD_CAMBIADA: {
    etiqueta: 'Cambió su contraseña',
    grupo: 'Sesión',
    tono: 'neutro',
    Icono: KeyRound,
  },
  PASSWORD_RESETEADA: {
    etiqueta: 'Contraseña reseteada',
    grupo: 'Usuarios',
    tono: 'aviso',
    Icono: KeyRound,
  },
  REGISTRO_CREADO: {
    etiqueta: 'Registro creado',
    grupo: 'Registros',
    tono: 'ok',
    Icono: ClipboardPlus,
  },
  REGISTRO_EDITADO: {
    etiqueta: 'Registro editado',
    grupo: 'Registros',
    tono: 'marca',
    Icono: ClipboardEdit,
  },
  REGISTRO_SYNC_OFFLINE: {
    etiqueta: 'Registro enviado sin señal (sincronizado)',
    grupo: 'Registros',
    tono: 'neutro',
    Icono: CloudUpload,
  },
  GPS_FUERA_DE_RANGO: {
    etiqueta: 'GPS fuera de rango',
    grupo: 'Registros',
    tono: 'error',
    Icono: MapPinOff,
  },
  FOTO_SUBIDA: { etiqueta: 'Foto subida', grupo: 'Registros', tono: 'neutro', Icono: Camera },
  USUARIO_CREADO: { etiqueta: 'Usuario creado', grupo: 'Usuarios', tono: 'ok', Icono: UserPlus },
  USUARIO_EDITADO: {
    etiqueta: 'Usuario editado',
    grupo: 'Usuarios',
    tono: 'marca',
    Icono: UserCog,
  },
  PDV_CREADO: { etiqueta: 'Punto de venta creado', grupo: 'Catálogo', tono: 'ok', Icono: Store },
  PDV_EDITADO: {
    etiqueta: 'Punto de venta editado',
    grupo: 'Catálogo',
    tono: 'marca',
    Icono: Store,
  },
  PDV_UBICACION_FIJADA: {
    etiqueta: 'Ubicación de punto fijada',
    grupo: 'Catálogo',
    tono: 'marca',
    Icono: MapPin,
  },
  PRODUCTO_CREADO: { etiqueta: 'Producto creado', grupo: 'Catálogo', tono: 'ok', Icono: Package },
  PRODUCTO_EDITADO: {
    etiqueta: 'Producto editado',
    grupo: 'Catálogo',
    tono: 'marca',
    Icono: Package,
  },
  CONFIG_CAMBIADA: {
    etiqueta: 'Configuración cambiada',
    grupo: 'Configuración',
    tono: 'aviso',
    Icono: Settings,
  },
  EXPORT_EXCEL: {
    etiqueta: 'Exportó Excel del tablero',
    grupo: 'Descargas',
    tono: 'neutro',
    Icono: FileSpreadsheet,
  },
  BACKUP_EXCEL: {
    etiqueta: 'Descargó backup completo',
    grupo: 'Descargas',
    tono: 'aviso',
    Icono: FileSpreadsheet,
  },
};

/** Acciones que no están en la lista (p. ej. si el backend agrega una nueva): se humanizan. */
export function infoAccion(accion: string): InfoAccion {
  if ((ACCIONES_AUDITORIA as readonly string[]).includes(accion))
    return INFO_ACCION[accion as AccionAuditoria];
  const t = accion.toLowerCase().replace(/_/g, ' ');
  return {
    etiqueta: t.charAt(0).toUpperCase() + t.slice(1),
    grupo: 'Registros',
    tono: 'neutro',
    Icono: ClipboardEdit,
  };
}

export function etiquetaAccion(accion: string): string {
  return infoAccion(accion).etiqueta;
}

/** Opciones agrupadas para el filtro de acción. */
export function accionesPorGrupo(): {
  grupo: GrupoAccion;
  acciones: { valor: AccionAuditoria; texto: string }[];
}[] {
  const orden: GrupoAccion[] = [
    'Sesión',
    'Registros',
    'Usuarios',
    'Catálogo',
    'Configuración',
    'Descargas',
  ];
  return orden.map((g) => ({
    grupo: g,
    acciones: ACCIONES_AUDITORIA.filter((a) => INFO_ACCION[a].grupo === g).map((a) => ({
      valor: a,
      texto: INFO_ACCION[a].etiqueta,
    })),
  }));
}

/** Nombres legibles de los campos que suelen aparecer en `cambios`. */
const CAMPOS: Record<string, string> = {
  nombre: 'Nombre',
  usuario: 'Usuario',
  rol: 'Rol',
  ciudad: 'Ciudad',
  pdvIds: 'Puntos asignados',
  activo: 'Activo',
  cadena: 'Cadena',
  portafolio: 'Portafolio',
  ubicacion: 'Ubicación',
  radioM: 'Radio (m)',
  unidad: 'Unidad',
  pesoKg: 'Peso por unidad (kg)',
  metas: 'Metas',
  riesgoVto: 'Umbrales de riesgo',
  marcasCompetencia: 'Marcas de competencia',
  novedadesGenerales: 'Novedades generales',
  novedadesProducto: 'Novedades de producto',
  tipoDia: 'Tipo de día',
  turno: 'Turno',
  obs: 'Observaciones',
  nov: 'Novedades',
  items: 'Productos',
  ejec: 'Góndola y precio',
  comp: 'Competencia',
  impulso: 'Impulso',
  geo: 'Ubicación GPS',
};

export function etiquetaCampo(c: string): string {
  return CAMPOS[c] ?? c;
}

/** Valor legible para la vista antes → después. */
export function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number')
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v))
    return v.length
      ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')
      : '(vacío)';
  try {
    return JSON.stringify(v, null, 1);
  } catch {
    return String(v);
  }
}
