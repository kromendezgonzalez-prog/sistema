import { PdvSchema, RADIO_PDV_DEF_M, type Pdv } from '@merca/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, ExternalLink, MapPin, MapPinOff, Pencil, Plus, Store } from 'lucide-react';
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
import { AyudaEnLinea, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { api, mensajeError } from '@/lib/api';
import { aNumero, fmt } from '@/lib/formato';
import {
  Buscador,
  Confirmar,
  ErrorCarga,
  EsqueletoLista,
  Interruptor,
  normalizar,
  Pagina,
  plural,
  urlMapa,
} from './comun';
import { SelectorMultiple } from './comun/SelectorMultiple';
import { aSlug, CLAVES, erroresZod, usePdvsAdmin, useProductosAdmin } from './datos';

const FILTRO_UBIC = ['Todos', 'Sin ubicación', 'Con ubicación', 'Inactivos'] as const;

interface Formulario {
  _id: string;
  nombre: string;
  cadena: string;
  ciudad: string;
  radioM: string;
  activo: boolean;
  portafolio: string[];
  lat: string;
  lng: string;
}
const VACIO: Formulario = {
  _id: '',
  nombre: '',
  cadena: '',
  ciudad: '',
  radioM: String(RADIO_PDV_DEF_M),
  activo: true,
  portafolio: [],
  lat: '',
  lng: '',
};

interface Lectura {
  lat: number;
  lng: number;
  precision: number;
}

/** Pide la ubicación del celular con alta precisión. */
function leerUbicacion(): Promise<Lectura> {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator))
      return mal(new Error('Este dispositivo no permite leer la ubicación.'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      (e) =>
        mal(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'No diste permiso de ubicación. Actívalo en el candado de la barra de direcciones o en los ajustes del navegador.'
              : e.code === e.TIMEOUT
                ? 'El GPS tardó demasiado. Sal a un lugar abierto o junto a una ventana e intenta de nuevo.'
                : 'No se pudo leer la ubicación. Revisa que el GPS esté encendido.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export default function PuntosPage() {
  useTemaAyuda('admin.puntos');
  const pdvs = usePdvsAdmin();
  const productos = useProductosAdmin();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<(typeof FILTRO_UBIC)[number]>('Todos');
  const [editando, setEditando] = useState<Pdv | 'nuevo' | null>(null);

  const lista = useMemo(() => {
    const n = normalizar(q);
    return (pdvs.data ?? [])
      .filter((p) =>
        filtro === 'Todos'
          ? true
          : filtro === 'Inactivos'
            ? !p.activo
            : filtro === 'Sin ubicación'
              ? p.activo && !p.ubicacion
              : !!p.ubicacion,
      )
      .filter((p) => !n || normalizar(`${p.nombre} ${p.cadena} ${p.ciudad} ${p._id}`).includes(n))
      .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
  }, [pdvs.data, q, filtro]);

  const sinUbic = (pdvs.data ?? []).filter((p) => p.activo && !p.ubicacion).length;

  return (
    <Pagina>
      <Encabezado
        titulo="Puntos de venta"
        subtitulo={
          pdvs.data
            ? plural(pdvs.data.filter((p) => p.activo).length, 'punto activo', 'puntos activos')
            : 'Tiendas donde trabaja el equipo'
        }
        accion={
          <Boton onClick={() => setEditando('nuevo')} icono={<Plus className="h-5 w-5" />}>
            <span className="hidden sm:inline">Nuevo punto</span>
            <span className="sm:hidden">Nuevo</span>
          </Boton>
        }
      />

      {sinUbic > 0 && (
        <Aviso
          tono="aviso"
          icono={<MapPinOff className="h-5 w-5" />}
          titulo={`${sinUbic} punto${sinUbic === 1 ? '' : 's'} sin ubicación fijada`}
        >
          Sin ubicación no se puede comprobar si el conteo se hizo en el punto. Ábrelo estando en la
          tienda y toca “Fijar con mi ubicación actual”.
        </Aviso>
      )}

      <div className="tarjeta space-y-3">
        <Buscador
          valor={q}
          onChange={setQ}
          placeholder="Buscar por nombre, cadena o ciudad"
          etiqueta="Buscar puntos"
        />
        <Pildoras etiqueta="Mostrar" opciones={FILTRO_UBIC} valor={filtro} onChange={setFiltro} />
      </div>

      {pdvs.isPending ? (
        <EsqueletoLista />
      ) : pdvs.isError ? (
        <ErrorCarga
          error={pdvs.error}
          onReintentar={() => pdvs.refetch()}
          titulo="No se pudieron cargar los puntos"
        />
      ) : !lista.length ? (
        <div className="tarjeta">
          <Vacio icono={<Store className="h-12 w-12" />} titulo="No hay puntos con estos filtros" />
        </div>
      ) : (
        <ul
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Lista de puntos de venta"
        >
          <AnimatePresence initial={false}>
            {lista.map((p) => (
              <motion.li
                key={p._id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <article
                  className={clsx('tarjeta flex h-full flex-col gap-2', !p.activo && 'opacity-70')}
                  aria-label={p.nombre}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-tinta">{p.nombre}</p>
                      <p className="truncate text-sm text-tinta-suave">
                        {[p.cadena, p.ciudad].filter(Boolean).join(' · ') || 'Sin cadena ni ciudad'}
                      </p>
                    </div>
                    {!p.activo && <Chip>· Inactivo</Chip>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.ubicacion ? (
                      <Chip tono="ok">
                        <MapPin className="h-3 w-3" aria-hidden /> ✓ Ubicación fijada
                      </Chip>
                    ) : (
                      <Chip tono="aviso">
                        <MapPinOff className="h-3 w-3" aria-hidden /> ! Sin ubicación
                      </Chip>
                    )}
                    <Chip>Radio {fmt(p.radioM, 0)} m</Chip>
                    <Chip>
                      {p.portafolio.length
                        ? plural(p.portafolio.length, 'producto', 'productos')
                        : 'Todo el catálogo'}
                    </Chip>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                    <Boton
                      tam="sm"
                      variante="secundario"
                      icono={<Pencil className="h-4 w-4" />}
                      onClick={() => setEditando(p)}
                      aria-label={`Editar ${p.nombre}`}
                    >
                      Editar
                    </Boton>
                    {p.ubicacion && (
                      <a
                        href={urlMapa(p.ubicacion.lat, p.ubicacion.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-marca-700 hover:bg-marca-50"
                        aria-label={`Ver ${p.nombre} en el mapa`}
                      >
                        Ver en mapa <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                  </div>
                </article>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <FormPunto
        abierto={editando !== null}
        pdv={editando === 'nuevo' ? null : editando}
        idsExistentes={(pdvs.data ?? []).map((p) => p._id)}
        productos={(productos.data ?? []).map((p) => ({
          valor: p._id,
          texto: p.nombre,
          detalle: `${p._id} · ${p.unidad}${p.activo ? '' : ' · inactivo'}`,
        }))}
        ciudades={[...new Set((pdvs.data ?? []).map((p) => p.ciudad).filter(Boolean))].sort()}
        cadenas={[...new Set((pdvs.data ?? []).map((p) => p.cadena).filter(Boolean))].sort()}
        onCerrar={() => setEditando(null)}
        onActualizado={(p) => setEditando((e) => (e && e !== 'nuevo' ? p : e))}
      />
    </Pagina>
  );
}

/* ───────── Formulario ───────── */

function FormPunto({
  abierto,
  pdv,
  idsExistentes,
  productos,
  ciudades,
  cadenas,
  onCerrar,
  onActualizado,
}: {
  abierto: boolean;
  pdv: Pdv | null;
  idsExistentes: string[];
  productos: { valor: string; texto: string; detalle?: string }[];
  ciudades: string[];
  cadenas: string[];
  onCerrar: () => void;
  onActualizado: (p: Pdv) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Formulario>(VACIO);
  const [idTocado, setIdTocado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [abiertoPara, setAbiertoPara] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);

  const llave = abierto ? (pdv?._id ?? 'nuevo') : null;
  if (llave !== abiertoPara) {
    setAbiertoPara(llave);
    if (llave) {
      setF(
        pdv
          ? {
              _id: pdv._id,
              nombre: pdv.nombre,
              cadena: pdv.cadena,
              ciudad: pdv.ciudad,
              radioM: String(pdv.radioM),
              activo: pdv.activo,
              portafolio: pdv.portafolio,
              lat: pdv.ubicacion ? String(pdv.ubicacion.lat) : '',
              lng: pdv.ubicacion ? String(pdv.ubicacion.lng) : '',
            }
          : VACIO,
      );
      setIdTocado(!!pdv);
      setErrores({});
      setLectura(null);
    }
  }

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({
      ...e,
      [k]: '',
      ubicacion: k === 'lat' || k === 'lng' ? '' : (e.ubicacion ?? ''),
    }));
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: CLAVES.pdvs });
    qc.invalidateQueries({ queryKey: ['config'] });
  };

  const guardar = useMutation({
    mutationFn: async (d: Pdv) => {
      if (!pdv) return api<{ pdv: Pdv }>('/admin/pdvs', { method: 'POST', body: d });
      const { _id, ...resto } = d;
      void _id;
      return api<{ pdv: Pdv }>(`/admin/pdvs/${encodeURIComponent(pdv._id)}`, {
        method: 'PATCH',
        body: resto,
      });
    },
    onSuccess: () => {
      toast.success(pdv ? 'Punto actualizado' : 'Punto creado');
      invalidar();
      onCerrar();
    },
    onError: (e) => toast.error('No se pudo guardar el punto', { description: mensajeError(e) }),
  });

  const fijar = useMutation({
    mutationFn: (l: Lectura) =>
      api<{ pdv: Pdv }>(`/pdvs/${encodeURIComponent(pdv!._id)}/ubicacion`, {
        method: 'POST',
        body: { lat: l.lat, lng: l.lng },
      }),
    onSuccess: (r, l) => {
      toast.success('Ubicación fijada', {
        description: `Precisión aproximada ±${fmt(l.precision, 0)} m.`,
      });
      setF((x) => ({ ...x, lat: String(l.lat), lng: String(l.lng) }));
      setLectura(null);
      invalidar();
      if (r?.pdv) onActualizado(r.pdv);
    },
    onError: (e) => toast.error('No se pudo fijar la ubicación', { description: mensajeError(e) }),
  });

  const usarMiUbicacion = async () => {
    setLeyendo(true);
    try {
      const l = await leerUbicacion();
      if (pdv) setLectura(l);
      else {
        setF((x) => ({ ...x, lat: l.lat.toFixed(6), lng: l.lng.toFixed(6) }));
        toast.success('Ubicación leída', {
          description: `Precisión ±${fmt(l.precision, 0)} m. Se guardará al crear el punto.`,
        });
      }
    } catch (e) {
      toast.error('No se pudo leer tu ubicación', { description: (e as Error).message });
    } finally {
      setLeyendo(false);
    }
  };

  const enviar = () => {
    const lat = aNumero(f.lat);
    const lng = aNumero(f.lng);
    const err: Record<string, string> = {};
    if ((lat === null) !== (lng === null))
      err.ubicacion = 'Escribe latitud y longitud, o deja ambas vacías.';
    if (!pdv && idsExistentes.includes(f._id)) err._id = 'Ya existe un punto con este código.';
    const datos = {
      _id: f._id,
      nombre: f.nombre.trim(),
      cadena: f.cadena.trim(),
      ciudad: f.ciudad.trim(),
      portafolio: f.portafolio,
      ubicacion: lat !== null && lng !== null ? { lat, lng } : null,
      radioM: aNumero(f.radioM) ?? NaN,
      activo: f.activo,
    };
    const r = PdvSchema.safeParse(datos);
    const ez = r.success
      ? {}
      : erroresZod(r.error, {
          nombre: 'Escribe el nombre del punto',
          radioM: 'El radio debe ser un número entero entre 50 y 5.000 m',
          ubicacion: 'Latitud entre −90 y 90, longitud entre −180 y 180',
        });
    const todos = { ...ez, ...err };
    if (Object.keys(todos).length || !r.success) return setErrores(todos);
    guardar.mutate(r.data);
  };

  const lat = aNumero(f.lat);
  const lng = aNumero(f.lng);
  const hayUbic = lat !== null && lng !== null;

  return (
    <>
      <HojaInferior
        abierta={abierto && !lectura}
        onCerrar={() => !guardar.isPending && onCerrar()}
        titulo={pdv ? `Editar ${pdv.nombre}` : 'Nuevo punto de venta'}
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="fantasma" onClick={onCerrar} disabled={guardar.isPending}>
              Cancelar
            </Boton>
            <Boton onClick={enviar} cargando={guardar.isPending}>
              {pdv ? 'Guardar cambios' : 'Crear punto'}
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
            etiqueta="Nombre del punto"
            value={f.nombre}
            placeholder="Ej.: Mercacentro 4"
            onChange={(e) => {
              const v = e.target.value;
              set('nombre', v);
              if (!idTocado) setF((x) => ({ ...x, nombre: v, _id: aSlug(v) }));
            }}
            error={errores.nombre || null}
          />
          <Campo
            etiqueta="Código interno"
            value={f._id}
            disabled={!!pdv}
            spellCheck={false}
            autoCapitalize="none"
            onChange={(e) => {
              setIdTocado(true);
              set('_id', e.target.value.toLowerCase());
            }}
            error={errores._id || null}
            ayuda={
              pdv
                ? 'El código no se puede cambiar.'
                : 'Se genera solo con el nombre. Minúsculas, números y guiones.'
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Cadena"
              value={f.cadena}
              list="cadenas-pdv"
              onChange={(e) => set('cadena', e.target.value)}
              error={errores.cadena || null}
            />
            <Campo
              etiqueta="Ciudad"
              value={f.ciudad}
              list="ciudades-pdv"
              onChange={(e) => set('ciudad', e.target.value)}
              error={errores.ciudad || null}
            />
          </div>
          <datalist id="cadenas-pdv">
            {cadenas.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <datalist id="ciudades-pdv">
            {ciudades.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {/* Ubicación */}
          <fieldset className="space-y-3 rounded-2xl border border-black/10 p-3">
            <legend className="flex items-center gap-1 px-1 text-sm font-bold text-tinta">
              Ubicación GPS <AyudaEnLinea tema="admin.puntos" etiqueta="Cómo fijar la ubicación" />
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {hayUbic ? (
                <Chip tono="ok">✓ Ubicación fijada</Chip>
              ) : (
                <Chip tono="aviso">! Sin ubicación</Chip>
              )}
              {hayUbic && (
                <a
                  href={urlMapa(lat!, lng!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-marca-700 hover:underline"
                >
                  Ver en mapa <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
            <Boton
              type="button"
              variante="secundario"
              bloque
              cargando={leyendo}
              icono={<Crosshair className="h-5 w-5" />}
              onClick={usarMiUbicacion}
            >
              Fijar con mi ubicación actual
            </Boton>
            <p className="text-xs text-tinta-tenue">
              Hazlo estando dentro de la tienda, cerca de la nevera de LOMUS.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta="Latitud"
                inputMode="decimal"
                value={f.lat}
                placeholder="4.6097"
                onChange={(e) => set('lat', e.target.value)}
              />
              <Campo
                etiqueta="Longitud"
                inputMode="decimal"
                value={f.lng}
                placeholder="-74.0817"
                onChange={(e) => set('lng', e.target.value)}
              />
            </div>
            {errores.ubicacion && <p className="text-sm text-error">{errores.ubicacion}</p>}
            <Campo
              etiqueta="Radio permitido"
              inputMode="numeric"
              value={f.radioM}
              sufijo="m"
              onChange={(e) => set('radioM', e.target.value.replace(/\D/g, ''))}
              error={errores.radioM || null}
              ayuda="Distancia máxima para considerar que el conteo se hizo en el punto (normal: 300 m)."
            />
          </fieldset>

          <SelectorMultiple
            etiqueta="Portafolio del punto"
            opciones={productos}
            seleccion={f.portafolio}
            onChange={(v) => set('portafolio', v)}
            textoVacio="Todo el catálogo"
            ayuda="Productos que se manejan aquí. Si no marcas ninguno, se muestran todos los productos activos."
          />

          <Interruptor
            etiqueta="Punto activo"
            activo={f.activo}
            onChange={(v) => set('activo', v)}
            descripcion="Los puntos inactivos no aparecen para registrar. Sus datos se conservan."
          />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </HojaInferior>

      {/* Fuera de la hoja para que no quede dentro de un contenedor con transformación */}
      <Confirmar
        abierta={!!lectura}
        titulo="¿Fijar esta ubicación?"
        textoConfirmar="Sí, fijar ubicación"
        cargando={fijar.isPending}
        onConfirmar={() => lectura && fijar.mutate(lectura)}
        onCerrar={() => !fijar.isPending && setLectura(null)}
      >
        {lectura && (
          <>
            <p>
              Se guardará como ubicación de <b className="text-tinta">{pdv?.nombre}</b>:
            </p>
            <p className="font-mono text-sm text-tinta">
              {lectura.lat.toFixed(6)}, {lectura.lng.toFixed(6)}
            </p>
            <p>
              Precisión aproximada: <b className="text-tinta">±{fmt(lectura.precision, 0)} m</b>{' '}
              <a
                href={urlMapa(lectura.lat, lectura.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-marca-700 hover:underline"
              >
                (ver en mapa)
              </a>
            </p>
            {lectura.precision > 50 && (
              <Aviso tono="aviso" titulo="La precisión es baja">
                Acércate a una ventana o a la entrada de la tienda y vuelve a intentar para una
                lectura más exacta.
              </Aviso>
            )}
          </>
        )}
      </Confirmar>
    </>
  );
}
