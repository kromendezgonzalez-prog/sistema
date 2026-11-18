import { ProductoSchema, UNIDADES, type Producto } from '@merca/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Package, Pencil, Plus, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Aviso,
  Boton,
  Campo,
  Chip,
  Encabezado,
  HojaInferior,
  Pildoras,
  Vacio,
} from '@/components/ui';
import { useTemaAyuda } from '@/components/ayuda/Ayuda';
import { api, mensajeError } from '@/lib/api';
import { aNumero, fmt } from '@/lib/formato';
import {
  Buscador,
  ErrorCarga,
  EsqueletoLista,
  Interruptor,
  normalizar,
  Pagina,
  plural,
} from './comun';
import { CLAVES, erroresZod, useProductosAdmin } from './datos';

const FILTRO = ['Activos', 'Und sin peso', 'Inactivos', 'Todos'] as const;
const UNIDAD_TEXTO: Record<(typeof UNIDADES)[number], string> = {
  kg: 'Por kilo (kg)',
  und: 'Por unidad (und)',
};

interface Formulario {
  _id: string;
  nombre: string;
  unidad: (typeof UNIDADES)[number];
  pesoKg: string;
  activo: boolean;
}
const VACIO: Formulario = { _id: '', nombre: '', unidad: 'kg', pesoKg: '', activo: true };

const sinPeso = (p: Producto) => p.unidad === 'und' && !p.pesoKg;

export default function ProductosPage() {
  useTemaAyuda('admin.productos');
  const productos = useProductosAdmin();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<(typeof FILTRO)[number]>('Activos');
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);

  const lista = useMemo(() => {
    const n = normalizar(q);
    return (productos.data ?? [])
      .filter((p) =>
        filtro === 'Activos'
          ? p.activo
          : filtro === 'Inactivos'
            ? !p.activo
            : filtro === 'Und sin peso'
              ? sinPeso(p)
              : true,
      )
      .filter((p) => !n || normalizar(`${p._id} ${p.nombre}`).includes(n))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos.data, q, filtro]);

  const nSinPeso = (productos.data ?? []).filter((p) => p.activo && sinPeso(p)).length;

  return (
    <Pagina>
      <Encabezado
        titulo="Catálogo"
        subtitulo={
          productos.data
            ? plural(
                productos.data.filter((p) => p.activo).length,
                'producto activo',
                'productos activos',
              )
            : 'Referencias LOMUS'
        }
        accion={
          <Boton onClick={() => setEditando('nuevo')} icono={<Plus className="h-5 w-5" />}>
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Boton>
        }
      />

      {nSinPeso > 0 && (
        <Aviso
          tono="aviso"
          icono={<Scale className="h-5 w-5" />}
          titulo={`${nSinPeso} producto${nSinPeso === 1 ? '' : 's'} por unidad sin peso`}
        >
          Su venta no se puede sumar en kg en el tablero (se muestra aparte como “und sin peso”).
          Edítalos y escribe el peso de cada unidad.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setFiltro('Und sin peso')}
          >
            Ver cuáles
          </button>
        </Aviso>
      )}

      <div className="tarjeta space-y-3">
        <Buscador
          valor={q}
          onChange={setQ}
          placeholder="Buscar por código o nombre"
          etiqueta="Buscar productos"
        />
        <Pildoras etiqueta="Mostrar" opciones={FILTRO} valor={filtro} onChange={setFiltro} />
      </div>

      {productos.isPending ? (
        <EsqueletoLista />
      ) : productos.isError ? (
        <ErrorCarga
          error={productos.error}
          onReintentar={() => productos.refetch()}
          titulo="No se pudo cargar el catálogo"
        />
      ) : !lista.length ? (
        <div className="tarjeta">
          <Vacio
            icono={<Package className="h-12 w-12" />}
            titulo="No hay productos con estos filtros"
          />
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-label="Lista de productos">
          <AnimatePresence initial={false}>
            {lista.map((p) => (
              <motion.li
                key={p._id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  onClick={() => setEditando(p)}
                  className={clsx(
                    'tarjeta flex w-full items-center gap-3 text-left transition hover:ring-1 hover:ring-marca-600/20',
                    !p.activo && 'opacity-70',
                  )}
                  aria-label={`Editar ${p.nombre}`}
                >
                  <span className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-marca-50 font-mono text-xs font-bold text-marca-700">
                    {p._id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-tinta">{p.nombre}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Chip>{p.unidad === 'kg' ? 'kg' : 'und'}</Chip>
                      {p.unidad === 'und' &&
                        (p.pesoKg ? (
                          <Chip>{fmt(p.pesoKg, 3)} kg/und</Chip>
                        ) : (
                          <Chip tono="aviso">! Und sin peso</Chip>
                        ))}
                      {!p.activo && <Chip>· Inactivo</Chip>}
                    </span>
                  </span>
                  <Pencil className="h-4 w-4 shrink-0 text-tinta-tenue" aria-hidden />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <FormProducto
        abierto={editando !== null}
        producto={editando === 'nuevo' ? null : editando}
        codigos={(productos.data ?? []).map((p) => p._id)}
        onCerrar={() => setEditando(null)}
      />
    </Pagina>
  );
}

function FormProducto({
  abierto,
  producto,
  codigos,
  onCerrar,
}: {
  abierto: boolean;
  producto: Producto | null;
  codigos: string[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Formulario>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [abiertoPara, setAbiertoPara] = useState<string | null>(null);

  const llave = abierto ? (producto?._id ?? 'nuevo') : null;
  if (llave !== abiertoPara) {
    setAbiertoPara(llave);
    if (llave) {
      setF(
        producto
          ? {
              _id: producto._id,
              nombre: producto.nombre,
              unidad: producto.unidad,
              pesoKg: producto.pesoKg ? String(producto.pesoKg) : '',
              activo: producto.activo,
            }
          : VACIO,
      );
      setErrores({});
    }
  }
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({ ...e, [k]: '' }));
  };

  const guardar = useMutation({
    mutationFn: async (d: Producto) => {
      if (!producto) return api('/admin/productos', { method: 'POST', body: d });
      const { _id, ...resto } = d;
      void _id;
      return api(`/admin/productos/${encodeURIComponent(producto._id)}`, {
        method: 'PATCH',
        body: resto,
      });
    },
    onSuccess: () => {
      toast.success(producto ? 'Producto actualizado' : 'Producto creado');
      qc.invalidateQueries({ queryKey: CLAVES.productos });
      qc.invalidateQueries({ queryKey: ['config'] });
      onCerrar();
    },
    onError: (e) => toast.error('No se pudo guardar el producto', { description: mensajeError(e) }),
  });

  const enviar = () => {
    const peso = f.unidad === 'und' ? aNumero(f.pesoKg) : null;
    const datos = {
      _id: f._id.trim(),
      nombre: f.nombre.trim(),
      unidad: f.unidad,
      pesoKg: peso,
      activo: f.activo,
    };
    const r = ProductoSchema.safeParse(datos);
    const err = r.success
      ? {}
      : erroresZod(r.error, {
          nombre: 'Escribe el nombre del producto',
          pesoKg: 'El peso debe ser mayor que 0 y máximo 100 kg',
          _id: 'Código inválido: solo letras, números, guion y guion bajo (máx. 20)',
        });
    if (!producto && codigos.includes(datos._id))
      err._id = 'Ya existe un producto con este código.';
    if (f.unidad === 'und' && f.pesoKg.trim() && peso === null)
      err.pesoKg = 'Escribe un número, por ejemplo 0,5';
    if (Object.keys(err).length || !r.success) return setErrores(err);
    guardar.mutate(r.data);
  };

  return (
    <HojaInferior
      abierta={abierto}
      onCerrar={() => !guardar.isPending && onCerrar()}
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      pie={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={enviar} cargando={guardar.isPending}>
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Boton>
        </div>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <Campo
          etiqueta="Código"
          value={f._id}
          disabled={!!producto}
          inputMode="numeric"
          placeholder="Ej.: 33017"
          onChange={(e) => set('_id', e.target.value.replace(/\s/g, ''))}
          error={errores._id || null}
          ayuda={
            producto
              ? 'El código no se puede cambiar.'
              : 'El código de la referencia (PLU o interno).'
          }
        />
        <Campo
          etiqueta="Nombre"
          value={f.nombre}
          placeholder="Ej.: PUNTA DE ANCA DE CERDO"
          onChange={(e) => set('nombre', e.target.value)}
          error={errores.nombre || null}
        />
        <div>
          <Pildoras
            etiqueta="Se vende"
            opciones={UNIDADES.map((u) => UNIDAD_TEXTO[u])}
            valor={UNIDAD_TEXTO[f.unidad]}
            onChange={(t) =>
              set(
                'unidad',
                UNIDADES.find((u) => UNIDAD_TEXTO[u] === t)!,
              )
            }
          />
          <p className="mt-1.5 text-sm text-tinta-tenue">
            {f.unidad === 'kg'
              ? 'Cortes que se pesan: el conteo se hace en kg.'
              : 'Paquetes o bandejas: el conteo se hace en unidades.'}
          </p>
        </div>
        <AnimatePresence initial={false}>
          {f.unidad === 'und' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Campo
                etiqueta="Peso por unidad"
                inputMode="decimal"
                sufijo="kg"
                placeholder="0,5"
                value={f.pesoKg}
                onChange={(e) => set('pesoKg', e.target.value)}
                error={errores.pesoKg || null}
                ayuda="Ej.: paquete de 500 g = 0,5. Sirve para sumar la venta en kg."
              />
              {!f.pesoKg.trim() && (
                <div className="mt-2">
                  <Aviso tono="aviso" titulo="Und sin peso">
                    Sin peso, la venta de este producto no se suma en kg en el tablero.
                  </Aviso>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <Interruptor
          etiqueta="Producto activo"
          activo={f.activo}
          onChange={(v) => set('activo', v)}
          descripcion="Los inactivos no aparecen para registrar. Su historial se conserva."
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </HojaInferior>
  );
}
