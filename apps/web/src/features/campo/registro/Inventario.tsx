import type { Pdv, Producto, UmbralesRiesgo } from '@merca/shared';
import { History, PackageSearch, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AyudaEnLinea, useAyuda } from '@/components/ayuda/Ayuda';
import { Aviso, Tarjeta, Vacio } from '@/components/ui';
import { fechaCorta } from '@/lib/formato';
import { Interruptor } from '../componentes/CampoNumero';
import { nombreProducto } from '../util';
import { HojaNovedad, type DestinoNovedad } from './HojaNovedad';
import { tieneDatos, type Momento } from './modelo';
import { useRegistro } from './store';
import { TarjetaProducto } from './TarjetaProducto';

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function Inventario({
  numero,
  productos,
  pdv,
  hoy,
  umbrales,
  tiposNovedad,
}: {
  numero: number;
  productos: Producto[];
  pdv?: Pdv;
  hoy: string;
  umbrales?: UmbralesRiesgo;
  tiposNovedad?: string[];
}) {
  const { abrir: abrirAyuda } = useAyuda();
  const items = useRegistro((s) => s.form.items);
  const precarga = useRegistro((s) => s.meta.precarga);
  const nSinConfirmar = useRegistro((s) => s.meta.sinConfirmar.length);
  const [q, setQ] = useState('');
  const [soloConDatos, setSoloConDatos] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [novedad, setNovedad] = useState<DestinoNovedad | null>(null);

  const base = useMemo(() => {
    const activos = productos.filter((p) => p.activo !== false);
    const port = pdv?.portafolio ?? [];
    return port.length ? activos.filter((p) => port.includes(p._id) || tieneDatos(items[p._id])) : activos;
    // `items` solo se usa para no esconder productos con datos fuera del portafolio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, pdv]);

  const visibles = useMemo(() => {
    const t = sinTildes(q.trim());
    return base.filter(
      (p) =>
        (!t || sinTildes(`${p.nombre} ${p._id}`).includes(t)) && (!soloConDatos || tieneDatos(items[p._id])),
    );
  }, [base, q, soloConDatos, items]);

  const conDatos = base.filter((p) => tieneDatos(items[p._id])).length;

  const abrirSiguiente = useCallback(
    (cod: string) => {
      const i = visibles.findIndex((p) => p._id === cod);
      const sig = visibles[i + 1];
      setAbierta(sig?._id ?? null);
      if (sig)
        requestAnimationFrame(() =>
          setTimeout(() => document.getElementById(`prod-${sig._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 240),
        );
    },
    [visibles],
  );

  const abrirNovedad = useCallback((cod: string, momento: Momento, loteId: string) => setNovedad({ cod, momento, loteId }), []);

  return (
    <Tarjeta
      numero={numero}
      titulo="Inventario y vencimientos"
      accion={<AyudaEnLinea tema="registrar.lotes" etiqueta="Ayuda sobre lotes" />}
    >
      <div id="seccion-inventario" className="scroll-mt-32" />
      <p className="-mt-1 mb-3 text-sm text-tinta-suave">
        Cada pieza o grupo de paquetes con la misma fecha es un <b>lote</b>. Registra los lotes <b>al llegar</b> y{' '}
        <b>al cierre</b>; la venta se calcula sola.{' '}
        <button
          type="button"
          onClick={() => abrirAyuda('niveles-riesgo')}
          className="font-semibold text-marca-700 underline underline-offset-2"
        >
          ¿Qué significan los colores?
        </button>
      </p>

      {precarga && (
        <div className="mb-3">
          <Aviso tono="info" icono={<History className="h-5 w-5" />} titulo="Lotes de llegada precargados">
            Del conteo de {precarga.impulsadoraNombre} el {fechaCorta(precarga.fecha)} ({precarga.turno}). Revisa la nevera y
            confirma o corrige cada producto.
            {nSinConfirmar > 0 && (
              <span className="mt-1 block font-semibold">
                {nSinConfirmar} producto{nSinConfirmar === 1 ? '' : 's'} por confirmar.
              </span>
            )}
          </Aviso>
        </div>
      )}

      <div className="mb-2 space-y-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-tenue" aria-hidden />
          <label htmlFor="buscar-producto" className="sr-only">
            Buscar producto o código
          </label>
          <input
            id="buscar-producto"
            type="search"
            className="campo pl-10 pr-11"
            placeholder="Buscar producto o código"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
          />
          {q && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setQ('')}
              className="absolute right-0 top-0 grid h-12 w-11 place-items-center text-tinta-tenue"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <Interruptor
          etiqueta="Solo productos con datos"
          descripcion={`${conDatos} de ${base.length} con datos${pdv?.portafolio?.length ? ' · portafolio del punto' : ''}`}
          activo={soloConDatos}
          onCambio={setSoloConDatos}
        />
      </div>

      {visibles.length === 0 ? (
        <Vacio
          icono={<PackageSearch className="h-10 w-10" />}
          titulo={soloConDatos && !q ? 'Aún no has registrado productos' : 'No encontramos productos'}
          texto={soloConDatos && !q ? 'Apaga el filtro para ver todo el portafolio.' : 'Prueba con otra palabra o con el código.'}
        />
      ) : (
        <div className="space-y-2">
          {visibles.map((p, i) => (
            <TarjetaProducto
              key={p._id}
              producto={p}
              abierta={abierta === p._id}
              onAlternar={() => setAbierta((a) => (a === p._id ? null : p._id))}
              onSiguiente={i < visibles.length - 1 ? () => abrirSiguiente(p._id) : undefined}
              onNovedad={abrirNovedad}
              hoy={hoy}
              umbrales={umbrales}
            />
          ))}
        </div>
      )}

      <HojaNovedad
        destino={novedad}
        onCerrar={() => setNovedad(null)}
        tipos={tiposNovedad}
        producto={novedad ? productos.find((p) => p._id === novedad.cod) : undefined}
      />
      <span className="sr-only" aria-live="polite">
        {abierta ? `Abierto: ${nombreProducto(productos.find((p) => p._id === abierta))}` : ''}
      </span>
    </Tarjeta>
  );
}
