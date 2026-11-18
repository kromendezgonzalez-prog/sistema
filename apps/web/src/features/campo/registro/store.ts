/**
 * Estado del formulario de registro (zustand). Las acciones son inmutables y pequeñas
 * para que cada tarjeta de producto se re-renderice solo cuando cambia lo suyo.
 */
import { hoyBogota, type Item, type Lote, type NovedadLote } from '@merca/shared';
import { create } from 'zustand';
import type { FormRegistro, MetaForm } from '@/offline/db';
import { campoLotes, formNuevo, metaVacia, nuevoIdLote, type Momento } from './modelo';

interface EstadoRegistro {
  form: FormRegistro;
  meta: MetaForm;
  /** sube con cada cambio hecho por la trabajadora (dispara el autoguardado) */
  cambios: number;

  cargar: (form: FormRegistro, meta?: MetaForm) => void;
  set: <K extends keyof FormRegistro>(k: K, v: FormRegistro[K]) => void;
  setItem: (cod: string, patch: Partial<Item>) => void;
  agregarLote: (cod: string, m: Momento, lote: Omit<Lote, 'id'> & { id?: string }) => string;
  actualizarLote: (cod: string, m: Momento, id: string, patch: Partial<Lote>) => void;
  quitarLote: (cod: string, m: Momento, id: string) => void;
  /** Lotes finales = copia de los de llegada (con ids nuevos, sin novedades). */
  copiarLlegada: (cod: string) => void;
  /** undefined = sin registrar; [] = inventario 0 */
  fijarLotes: (cod: string, m: Momento, lotes: Lote[] | undefined) => void;
  setNovedad: (cod: string, m: Momento, id: string, nov: NovedadLote | null) => void;
  confirmarPrecarga: (cod: string) => void;
}

const itemDe = (f: FormRegistro, cod: string): Item => f.items[cod] ?? { agot: false };

export const useRegistro = create<EstadoRegistro>((set, get) => {
  /** aplica un cambio a un ítem y marca el producto como confirmado si se tocó la llegada */
  const conItem = (cod: string, fn: (it: Item) => Item, tocaLlegada = false) =>
    set((s) => ({
      form: { ...s.form, items: { ...s.form.items, [cod]: fn(itemDe(s.form, cod)) } },
      meta: tocaLlegada ? { ...s.meta, sinConfirmar: s.meta.sinConfirmar.filter((c) => c !== cod) } : s.meta,
      cambios: s.cambios + 1,
    }));

  const conLotes = (cod: string, m: Momento, fn: (ls: Lote[]) => Lote[] | undefined) =>
    conItem(
      cod,
      (it) => {
        const k = campoLotes(m);
        const nuevo = { ...it, [k]: fn(it[k] ?? []) };
        if (nuevo[k] === undefined) delete nuevo[k];
        return nuevo;
      },
      m === 'ini',
    );

  return {
    form: formNuevo({ fecha: hoyBogota(), turno: 'Mañana' }),
    meta: metaVacia(),
    cambios: 0,

    cargar: (form, meta) => set({ form, meta: meta ?? metaVacia(), cambios: 0 }),

    set: (k, v) => set((s) => ({ form: { ...s.form, [k]: v }, cambios: s.cambios + 1 })),

    setItem: (cod, patch) => conItem(cod, (it) => ({ ...it, ...patch })),

    agregarLote: (cod, m, lote) => {
      const id = lote.id ?? nuevoIdLote();
      conLotes(cod, m, (ls) => [...ls, { novedad: null, ...lote, id }]);
      return id;
    },

    actualizarLote: (cod, m, id, patch) =>
      conLotes(cod, m, (ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))),

    quitarLote: (cod, m, id) => conLotes(cod, m, (ls) => ls.filter((l) => l.id !== id)),

    copiarLlegada: (cod) => {
      const ini = itemDe(get().form, cod).lotesIni ?? [];
      conLotes(cod, 'fin', () => ini.map((l) => ({ id: nuevoIdLote(), cantidad: l.cantidad, vto: l.vto, novedad: null })));
    },

    fijarLotes: (cod, m, lotes) => conLotes(cod, m, () => lotes),

    setNovedad: (cod, m, id, nov) =>
      conLotes(cod, m, (ls) => ls.map((l) => (l.id === id ? { ...l, novedad: nov } : l))),

    confirmarPrecarga: (cod) =>
      set((s) => ({ meta: { ...s.meta, sinConfirmar: s.meta.sinConfirmar.filter((c) => c !== cod) }, cambios: s.cambios + 1 })),
  };
});
