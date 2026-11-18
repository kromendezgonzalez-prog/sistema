import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/* ───────── usuarios ───────── */

const UsuarioSchema = new Schema(
  {
    _id: { type: String, required: true },
    nombre: { type: String, required: true },
    usuario: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** bcrypt (irreversible). Nunca se devuelve en la API. */
    passwordHash: { type: String, required: true },
    rol: { type: String, enum: ['admin', 'supervisor', 'impulsadora'], required: true },
    ciudad: { type: String, default: '' },
    pdvIds: { type: [String], default: [] },
    activo: { type: Boolean, default: true },
    debeCambiarPassword: { type: Boolean, default: true },
    intentosFallidos: { type: Number, default: 0 },
    bloqueadoHasta: { type: Date, default: null },
    ultimoAcceso: { type: Date, default: null },
    /** se incrementa al resetear/cambiar contraseña o desactivar: invalida los refresh tokens */
    tokenVersion: { type: Number, default: 0 },
    creadoEn: { type: Date, default: () => new Date() },
  },
  { collection: 'usuarios', versionKey: false },
);
export type UsuarioDoc = InferSchemaType<typeof UsuarioSchema> & { _id: string };
export const Usuario = mongoose.model('Usuario', UsuarioSchema);

/* ───────── pdvs ───────── */

const PdvSchema = new Schema(
  {
    _id: { type: String, required: true },
    nombre: { type: String, required: true },
    cadena: { type: String, default: '' },
    ciudad: { type: String, default: '' },
    portafolio: { type: [String], default: [] },
    ubicacion: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },
    radioM: { type: Number, default: 300 },
    activo: { type: Boolean, default: true },
  },
  { collection: 'pdvs', versionKey: false },
);
export const Pdv = mongoose.model('Pdv', PdvSchema);

/* ───────── productos ───────── */

const ProductoSchema = new Schema(
  {
    _id: { type: String, required: true },
    nombre: { type: String, required: true },
    unidad: { type: String, enum: ['kg', 'und'], required: true },
    pesoKg: { type: Number, default: null },
    activo: { type: Boolean, default: true },
  },
  { collection: 'productos', versionKey: false },
);
export const Producto = mongoose.model('Producto', ProductoSchema);

/* ───────── config (_id: "general") ───────── */

const ConfigSchema = new Schema(
  {
    _id: { type: String, default: 'general' },
    metas: { type: Schema.Types.Mixed, required: true },
    riesgoVto: { type: Schema.Types.Mixed, required: true },
    marcasCompetencia: { type: [String], default: [] },
    novedadesGenerales: { type: [String], default: [] },
    novedadesProducto: { type: [String], default: [] },
    actualizadoEn: { type: Date, default: () => new Date() },
  },
  { collection: 'config', versionKey: false, minimize: false },
);
export const ConfigModel = mongoose.model('Config', ConfigSchema);

/* ───────── registros ───────── */

const RegistroSchema = new Schema(
  {
    _id: { type: String, required: true },
    fecha: { type: String, required: true },
    turno: { type: String, required: true },
    /** 0 Mañana · 1 Tarde · 2 Completa (para ordenar). No se expone en la API. */
    turnoOrden: { type: Number, required: true },
    tipoDia: { type: String, required: true },
    impulsadoraId: { type: String, required: true },
    impulsadoraNombre: { type: String, default: '' },
    pdvId: { type: String, required: true },
    pdvNombre: { type: String, default: '' },
    ciudad: { type: String, default: '' },
    items: { type: Schema.Types.Mixed, default: {} },
    ejec: { type: Schema.Types.Mixed, default: {} },
    comp: { type: Schema.Types.Mixed, default: {} },
    impulso: { type: Schema.Types.Mixed, default: {} },
    nov: { type: [String], default: [] },
    obs: { type: String, default: '' },
    fotosGondola: { type: Schema.Types.Mixed, default: [] },
    geo: { type: Schema.Types.Mixed, default: null },
    riesgos: { type: Schema.Types.Mixed, default: [] },
    creadoEn: { type: Date, required: true },
    actualizadoEn: { type: Date, required: true },
    creadoPor: { type: String, required: true },
    actualizadoPor: { type: String, required: true },
    mismoDia: { type: Boolean, default: false },
    origen: { type: String, enum: ['online', 'offline-sync'], default: 'online' },
  },
  { collection: 'registros', versionKey: false, minimize: false },
);
RegistroSchema.index({ fecha: 1 });
RegistroSchema.index({ impulsadoraId: 1, fecha: -1 });
RegistroSchema.index({ pdvId: 1, fecha: -1 });
RegistroSchema.index({ 'riesgos.nivel': 1, fecha: -1 });
export const Registro = mongoose.model('Registro', RegistroSchema);

/* ───────── auditoria (solo escritura desde el servidor) ───────── */

const AuditoriaSchema = new Schema(
  {
    en: { type: Date, default: () => new Date() },
    usuarioId: { type: String, default: null },
    usuarioNombre: { type: String, default: '' },
    rol: { type: String, default: null },
    accion: { type: String, required: true },
    entidad: { type: String, default: null },
    entidadId: { type: String, default: null },
    resumen: { type: String, default: '' },
    cambios: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    dispositivo: { type: String, default: null },
    geo: { type: Schema.Types.Mixed, default: null },
  },
  { collection: 'auditoria', versionKey: false, minimize: false },
);
AuditoriaSchema.index({ en: -1 });
AuditoriaSchema.index({ usuarioId: 1, en: -1 });
AuditoriaSchema.index({ accion: 1, en: -1 });
export const Auditoria = mongoose.model('Auditoria', AuditoriaSchema);
