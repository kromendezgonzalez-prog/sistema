import {
  DIAS_EDICION,
  esFechaValida,
  hoyBogota,
  registroId,
  RegistroInputSchema,
  sumarDias,
  TURNOS,
  type GeoInput,
  type TipoDia,
  type Turno,
} from '@merca/shared';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { AlertOctagon, Check, CloudOff, History, Lock, Pencil, RotateCcw, Save, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTemaAyuda } from '@/components/ayuda/Ayuda';
import { Aviso, Boton, Cargando, Encabezado, Vacio } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { fechaCorta } from '@/lib/formato';
import { guardarOEncolar, mensajeDetallado, mensajeZod } from '@/offline/cola';
import { claveBorrador, db, type FormRegistro } from '@/offline/db';
import { cargarContexto, type OrigenCarga } from './registro/cargar';
import { CheckinGps } from './registro/CheckinGps';
import { Inventario } from './registro/Inventario';
import { Jornada } from './registro/Jornada';
import { analizar, bloqueos as calcularBloqueos, construirInput, formNuevo, resumenCola, tieneDatos } from './registro/modelo';
import { ResumenGuardar } from './registro/ResumenGuardar';
import { Competencia, Gondola, Impulso, Novedades } from './registro/Secciones';
import { useRegistro } from './registro/store';
import { useAutoguardado } from './registro/useAutoguardado';
import { fechaLarga, puntosDisponibles, turnoPorHora } from './util';

type Base = Pick<FormRegistro, 'fecha' | 'turno' | 'pdvId' | 'tipoDia' | 'geo'>;

function AvisoOrigen({ origen, onEmpezarDeCero }: { origen: OrigenCarga | null; onEmpezarDeCero: () => void }) {
  const [seguro, setSeguro] = useState(false);
  useEffect(() => {
    if (!seguro) return;
    const t = setTimeout(() => setSeguro(false), 4000);
    return () => clearTimeout(t);
  }, [seguro]);
  if (origen === 'servidor')
    return (
      <Aviso tono="info" icono={<Pencil className="h-5 w-5" />} titulo="Ya guardaste este turno">
        Estás editándolo: los cambios actualizan el mismo registro (por ejemplo, para agregar el cierre).
      </Aviso>
    );
  if (origen === 'cola')
    return (
      <Aviso tono="aviso" icono={<CloudOff className="h-5 w-5" />} titulo="Guardado en el celular, sin enviar">
        Puedes seguir editándolo. Se enviará cuando haya señal.
      </Aviso>
    );
  if (origen === 'sin-red')
    return (
      <Aviso tono="aviso" icono={<WifiOff className="h-5 w-5" />} titulo="Sin señal">
        No pudimos traer el último inventario del punto. Digita los lotes de llegada; todo se guarda en el celular.
      </Aviso>
    );
  if (origen === 'borrador')
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-marca-50 p-3 text-sm text-marca-800" role="status">
        <span className="flex items-center gap-2">
          <History className="h-5 w-5 shrink-0" aria-hidden /> Seguimos donde ibas: recuperamos lo que llevabas.
        </span>
        <button
          type="button"
          onClick={() => (seguro ? onEmpezarDeCero() : setSeguro(true))}
          className={clsx(
            'inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-3 font-semibold',
            seguro ? 'bg-error text-white' : 'text-marca-700 hover:bg-white',
          )}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> {seguro ? '¿Seguro? Toca otra vez' : 'Empezar de cero'}
        </button>
      </div>
    );
  return null;
}

export default function RegistrarPage() {
  const { usuario } = useAuth();
  const cfg = useConfig();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const hoy = hoyBogota();
  const form = useRegistro((s) => s.form);
  const meta = useRegistro((s) => s.meta);
  const [cargando, setCargando] = useState(true);
  const [origen, setOrigen] = useState<OrigenCarga | null>(null);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const peticion = useRef(0);
  const iniciado = useRef(false);
  const { guardarYa, cancelar } = useAutoguardado(usuario?._id);

  const datos = cfg.data;
  const productosPorCod = cfg.productosPorCod;
  const { asignados, otros } = useMemo(() => puntosDisponibles(usuario, datos?.pdvs ?? []), [usuario, datos]);
  const pdv = cfg.pdvsPorId[form.pdvId];
  const umbrales = datos?.config.riesgoVto;
  const lab = form.tipoDia === 'Laboral';

  useTemaAyuda(!form.pdvId ? 'registrar.jornada' : lab && !form.geo ? 'registrar.gps' : lab ? 'registrar.lotes' : 'registrar.jornada');

  // El botón "?" sube para no tapar la barra de guardar.
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--ayuda-bottom', 'calc(9.75rem + env(safe-area-inset-bottom))');
    return () => {
      r.removeProperty('--ayuda-bottom');
    };
  }, []);

  const cargar = useCallback(
    async (base: Base) => {
      if (!usuario) return;
      const n = ++peticion.current;
      await guardarYa();
      setCargando(true);
      try {
        const r = await cargarContexto({ usuarioId: usuario._id, base, existeProducto: (c) => !!productosPorCod[c] });
        if (n !== peticion.current) return;
        const conservarTipo = r.origen === 'nuevo' || r.origen === 'precarga' || r.origen === 'sin-red';
        useRegistro.getState().cargar(conservarTipo ? { ...r.form, tipoDia: base.tipoDia } : r.form, r.meta);
        setOrigen(r.origen);
      } catch {
        if (n !== peticion.current) return;
        useRegistro.getState().cargar(formNuevo(base));
        setOrigen('nuevo');
      } finally {
        if (n === peticion.current) setCargando(false);
      }
    },
    [usuario, productosPorCod, guardarYa],
  );

  // Arranque: parámetros (?pdvId&fecha&turno) → borrador reciente → valores por defecto
  useEffect(() => {
    if (!usuario || !datos || iniciado.current) return;
    iniciado.current = true;
    const min = sumarDias(hoy, -DIAS_EDICION);
    const pFecha = params.get('fecha');
    const pTurno = params.get('turno');
    const pPdv = params.get('pdvId');
    const pdvDefecto = asignados.length === 1 ? asignados[0]._id : '';
    void (async () => {
      if (pFecha || pTurno || pPdv) {
        const fechaOk = !!pFecha && esFechaValida(pFecha) && pFecha >= min && pFecha <= hoy;
        if (pFecha && !fechaOk) toast.info(`Solo se puede editar hasta ${DIAS_EDICION} días atrás. Abrimos el día de hoy.`);
        await cargar({
          fecha: fechaOk && pFecha ? pFecha : hoy,
          turno: TURNOS.includes(pTurno as Turno) ? (pTurno as Turno) : turnoPorHora(),
          pdvId: pPdv && cfg.pdvsPorId[pPdv] ? pPdv : pdvDefecto,
          tipoDia: 'Laboral',
          geo: null,
        });
        return;
      }
      const recientes = await db.borradores.where('usuarioId').equals(usuario._id).sortBy('actualizadoEn');
      const reciente = recientes.reverse().find((b) => b.form.fecha >= min && b.form.fecha <= hoy);
      if (reciente) {
        useRegistro.getState().cargar(reciente.form, reciente.meta);
        setOrigen('borrador');
        setCargando(false);
        return;
      }
      await cargar({ fecha: hoy, turno: turnoPorHora(), pdvId: pdvDefecto, tipoDia: 'Laboral', geo: null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, datos]);

  const cambiarClave = (p: { fecha?: string; turno?: Turno; pdvId?: string }) => {
    const f = useRegistro.getState().form;
    const base: Base = { fecha: f.fecha, turno: f.turno, pdvId: f.pdvId, tipoDia: f.tipoDia, geo: f.geo, ...p };
    if (base.fecha === f.fecha && base.turno === f.turno && base.pdvId === f.pdvId) return;
    const conDatos = Object.values(f.items).some(tieneDatos);
    if (conDatos && f.pdvId) toast.info('Tu avance anterior quedó guardado en el celular.');
    void cargar(base);
  };

  const empezarDeCero = async () => {
    if (!usuario) return;
    cancelar();
    const f = useRegistro.getState().form;
    await db.borradores.delete(claveBorrador(usuario._id, f));
    await cargar({ fecha: f.fecha, turno: f.turno, pdvId: f.pdvId, tipoDia: 'Laboral', geo: f.geo });
  };

  const onGeo = useCallback((g: GeoInput) => useRegistro.getState().set('geo', g), []);
  const onTipoDia = useCallback((t: TipoDia) => useRegistro.getState().set('tipoDia', t), []);

  const analisis = useMemo(
    () => analizar(form, { productos: productosPorCod, hoy, umbrales, pdv }),
    [form, productosPorCod, hoy, umbrales, pdv],
  );
  const bloqueos = calcularBloqueos(form, analisis);

  const guardar = async () => {
    if (!usuario || calcularBloqueos(form, analisis).length) return;
    const v = RegistroInputSchema.safeParse(construirInput(form));
    if (!v.success) {
      toast.error(mensajeZod(v.error));
      return;
    }
    setGuardando(true);
    cancelar();
    const id = registroId(form.fecha, usuario._id, form.pdvId, form.turno);
    try {
      const r = await guardarOEncolar(id, usuario._id, v.data, resumenCola(form, analisis, pdv?.nombre ?? form.pdvId), meta);
      if (r.tipo === 'enviado') {
        void qc.invalidateQueries({ queryKey: ['registros'] });
        void qc.invalidateQueries({ queryKey: ['tablero'] });
        toast.success(r.respuesta.creado ? 'Registro guardado ✓' : 'Cambios guardados ✓', {
          description:
            analisis.sinCierre > 0 ? 'Al terminar el turno vuelve a "Completar cierre" para registrar los lotes finales.' : undefined,
        });
      } else {
        toast.success('Guardado en el celular', {
          description: 'Se enviará solo cuando haya señal. No cierres sesión.',
          icon: <CloudOff className="h-5 w-5" />,
        });
      }
      setResumenAbierto(false);
      useRegistro.getState().cargar(formNuevo({ fecha: hoy, turno: turnoPorHora() }));
      nav('/');
    } catch (e) {
      toast.error(mensajeDetallado(e));
    } finally {
      setGuardando(false);
    }
  };

  if (!datos)
    return cfg.isLoading ? (
      <Cargando texto="Cargando catálogo…" />
    ) : (
      <Vacio
        icono={<WifiOff className="h-10 w-10" />}
        titulo="Necesitamos señal una vez"
        texto="La primera vez la app descarga el catálogo y los puntos de venta. Conéctate a internet y vuelve a intentar."
        accion={<Boton onClick={() => void cfg.refetch()}>Reintentar</Boton>}
      />
    );

  const listo = !lab || (!!form.pdvId && !!form.geo);
  const secciones = lab
    ? [
        { id: 'inventario', t: 'Inventario', ok: analisis.nProductos > 0 },
        { id: 'gondola', t: 'Góndola', ok: Object.values(form.ejec).some((x) => x !== null && x !== undefined) },
        { id: 'competencia', t: 'Competencia', ok: Object.keys(form.comp).length > 0 },
        { id: 'impulso', t: 'Impulso', ok: Object.values(form.impulso).some((x) => x !== null && x !== undefined) },
        { id: 'novedades', t: 'Novedades', ok: form.nov.length > 0 || !!form.obs.trim() },
      ]
    : [];

  return (
    <div className="pb-28">
      <Encabezado
        titulo={meta.existente ? 'Editar conteo' : 'Registrar conteo'}
        subtitulo={<span className="first-letter:uppercase">{fechaLarga(form.fecha)}</span>}
      />

      <div className="space-y-4">
        <AvisoOrigen origen={cargando ? null : origen} onEmpezarDeCero={() => void empezarDeCero()} />

        <Jornada
          hoy={hoy}
          fecha={form.fecha}
          turno={form.turno}
          tipoDia={form.tipoDia}
          pdvId={form.pdvId}
          asignados={asignados}
          otros={otros}
          onCambiarClave={cambiarClave}
          onTipoDia={onTipoDia}
        />

        {cargando ? (
          <div className="tarjeta">
            <Cargando texto="Preparando el conteo…" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {lab && !form.pdvId && (
              <Aviso tono="info" icono={<Lock className="h-5 w-5" />}>
                Elige el punto de venta para continuar.
              </Aviso>
            )}

            {lab && form.pdvId && <CheckinGps pdv={pdv} geo={form.geo} onGeo={onGeo} />}

            {lab && form.pdvId && !form.geo && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-black/15 p-4 text-sm text-tinta-suave">
                <Lock className="h-5 w-5 shrink-0" aria-hidden />
                Cuando tengamos tu ubicación se abre el inventario.
              </div>
            )}

            {listo && lab && (
              <>
                <nav aria-label="Secciones del registro" className="-mx-4 overflow-x-auto px-4">
                  <ul className="flex gap-2 pb-1">
                    {secciones.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() =>
                            document.getElementById(`seccion-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                          className={clsx(
                            'inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm font-medium',
                            s.ok ? 'border-ok/30 bg-ok-bg text-ok' : 'border-black/10 bg-white text-tinta-suave',
                          )}
                        >
                          {s.ok && <Check className="h-4 w-4" aria-hidden />}
                          {s.t}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
                <Inventario
                  numero={2}
                  productos={datos.productos}
                  pdv={pdv}
                  hoy={hoy}
                  umbrales={umbrales}
                  tiposNovedad={datos.config.novedadesProducto}
                />
                <Gondola numero={3} />
                <Competencia numero={4} marcas={datos.config.marcasCompetencia} />
                <Impulso numero={5} />
                <Novedades numero={6} opciones={datos.config.novedadesGenerales} />
              </>
            )}

            {!lab && <Novedades numero={2} opciones={datos.config.novedadesGenerales} />}
          </motion.div>
        )}
      </div>

      {/* Barra fija de guardar (encima de la navegación inferior) */}
      <div
        className="fixed inset-x-0 z-20 border-t border-black/5 bg-white/95 backdrop-blur"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-sm leading-tight text-tinta-suave" aria-live="polite">
            {!lab ? (
              <>
                Registrar <b className="text-tinta">{form.tipoDia.toLowerCase()}</b> · {fechaCorta(form.fecha)}
              </>
            ) : (
              <>
                <b className="text-tinta">{analisis.nProductos}</b> producto{analisis.nProductos === 1 ? '' : 's'} con datos
                {analisis.totalAlertas > 0 && (
                  <span className="mt-0.5 flex items-center gap-1 font-semibold text-error">
                    <AlertOctagon className="h-4 w-4" aria-hidden /> {analisis.totalAlertas} por revisar
                  </span>
                )}
              </>
            )}
          </p>
          <Boton
            tam="lg"
            icono={<Save className="h-5 w-5" />}
            onClick={() => setResumenAbierto(true)}
            disabled={cargando}
            className="shrink-0"
          >
            Guardar
          </Boton>
        </div>
      </div>

      <ResumenGuardar
        abierta={resumenAbierto}
        onCerrar={() => setResumenAbierto(false)}
        form={form}
        analisis={analisis}
        bloqueos={bloqueos}
        pdvNombre={pdv?.nombre ?? ''}
        productos={productosPorCod}
        sinConfirmar={lab ? meta.sinConfirmar.filter((c) => tieneDatos(form.items[c])).length : 0}
        guardando={guardando}
        onGuardar={() => void guardar()}
      />
    </div>
  );
}
