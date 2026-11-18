/**
 * Base de datos local (IndexedDB vía Dexie) para trabajar sin señal.
 * - borradores: el formulario en curso, autoguardado por clave de registro.
 * - cola: registros guardados en el celular pendientes de enviar.
 * - fotosPendientes: fotos comprimidas que aún no se han subido a Cloudinary.
 */
import type { Foto, GeoInput, Item, NivelRiesgo, RegistroInput, TipoDia, Turno } from '@merca/shared';
import Dexie, { type Table } from 'dexie';

/** Estado editable del formulario de registro (lo que la trabajadora llena). */
export interface FormRegistro {
  fecha: string;
  turno: Turno;
  tipoDia: TipoDia;
  pdvId: string;
  items: Record<string, Item>;
  ejec: RegistroInput['ejec'];
  comp: Record<string, { precio?: number | null; act: string }>;
  impulso: { abordados?: number | null; degust?: number | null; compras?: number | null };
  nov: string[];
  obs: string;
  fotosGondola: Foto[];
  geo: GeoInput | null;
}

/** Metadatos del formulario que no se envían a la API. */
export interface MetaForm {
  /** de dónde se precargaron los lotes iniciales */
  precarga: { fecha: string; turno: string; impulsadoraNombre: string } | null;
  /** códigos de productos precargados que la trabajadora aún no ha confirmado */
  sinConfirmar: string[];
  /** el registro ya existe en el servidor (se está editando) */
  existente: boolean;
}

export interface Borrador {
  clave: string;
  usuarioId: string;
  form: FormRegistro;
  meta: MetaForm;
  actualizadoEn: number;
}

export type EstadoCola = 'pendiente' | 'enviando' | 'error';

export interface ResumenCola {
  pdvNombre: string;
  nProductos: number;
  peorNivel: NivelRiesgo;
  fueraDeRango: boolean | null;
}

export interface RegistroEnCola {
  /** registroId(fecha, usuarioId, pdvId, turno) */
  id: string;
  usuarioId: string;
  /** puede contener fotos locales (`local:<id>`) que se suben antes de enviar */
  input: RegistroInput;
  meta?: MetaForm;
  resumen: ResumenCola;
  estado: EstadoCola;
  intentos: number;
  ultimoError: string | null;
  /** el error es de datos (hay que corregir), no de red */
  errorDeDatos: boolean;
  creadoEn: number;
  actualizadoEn: number;
}

export interface FotoPendiente {
  id: string;
  usuarioId: string;
  /** imagen comprimida (ArrayBuffer: se guarda bien en todos los navegadores) */
  datos: ArrayBuffer;
  tipo: string;
  contexto: 'novedad' | 'gondola';
  creadoEn: number;
  /** cuando ya se subió: la referencia de Cloudinary */
  subida: Foto | null;
}

class BaseLocal extends Dexie {
  borradores!: Table<Borrador, string>;
  cola!: Table<RegistroEnCola, string>;
  fotosPendientes!: Table<FotoPendiente, string>;

  constructor() {
    super('mercaimpulso');
    this.version(1).stores({
      borradores: 'clave, usuarioId, actualizadoEn',
      cola: 'id, usuarioId, estado, actualizadoEn',
      fotosPendientes: 'id, usuarioId, creadoEn',
    });
  }
}

export const db = new BaseLocal();

/** Clave del borrador: misma forma que el id del registro. */
export function claveBorrador(usuarioId: string, f: Pick<FormRegistro, 'fecha' | 'pdvId' | 'turno'>) {
  return `${f.fecha}_${usuarioId}_${f.pdvId || 'sin-punto'}_${f.turno}`;
}
