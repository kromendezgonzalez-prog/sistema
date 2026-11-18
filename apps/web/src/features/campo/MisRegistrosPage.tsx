import {
  DIAS_EDICION,
  finOf,
  hoyBogota,
  iniOf,
  peorNivel,
  sumarDias,
  ventaOf,
  type NivelRiesgo,
  type Paginado,
  type Registro,
} from '@merca/shared';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertOctagon, CheckCircle2, ChevronRight, ClipboardList, Clock, Eye, MapPinOff, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AyudaEnLinea, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { Aviso, Boton, Cargando, Chip, Encabezado, HojaInferior, NivelChip, Vacio } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { borrarFotosLocales, esFotoLocal, fotosDe, idFotoLocal } from '@/lib/fotos';
import { fechaCorta, fechaHora, fmt, pct } from '@/lib/formato';
import { descartarDeCola } from '@/offline/cola';
import type { RegistroEnCola } from '@/offline/db';
import { useCola, useEstadoSync, useSincronizarAhora } from '@/offline/sincronizador';
import { tieneDatos } from './registro/modelo';
import { cantidadTxt, nombreProducto, ordenTurno } from './util';

interface Fila {
  id: string;
  fecha: string;
  turno: string;
  tipoDia: string;
  pdvId: string;
  pdvNombre: string;
  nProductos: number;
  peor: NivelRiesgo;
  fueraDeRango: boolean;
  estado: 'enviado' | 'pendiente' | 'error';
  error?: string | null;
  registro?: Registro;
  cola?: RegistroEnCola;
  actualizado?: string;
}

const ESTADO = {
  enviado: { texto: 'Enviado', icono: <CheckCircle2 className="h-4 w-4" aria-hidden />, tono: 'ok' as const },
  pendiente: { texto: 'Pendiente', icono: <Clock className="h-4 w-4" aria-hidden />, tono: 'aviso' as const },
  error: { texto: 'Error', icono: <AlertOctagon className="h-4 w-4" aria-hidden />, tono: 'error' as const },
};

function DetalleRegistro({ fila, onCerrar }: { fila: Fila | null; onCerrar: () => void }) {
  const cfg = useConfig();
  const r = fila?.registro;
  return (
    <HojaInferior abierta={!!fila} onCerrar={onCerrar} titulo="Detalle del registro">
      {fila && (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-marca-50 p-3 text-marca-800">
            <p className="font-bold">{fila.pdvNombre}</p>
            <p>
              {fechaCorta(fila.fecha)} · {fila.turno} · {fila.tipoDia}
            </p>
            {fila.actualizado && <p className="text-xs opacity-80">Actualizado: {fechaHora(fila.actualizado)}</p>}
          </div>
          <Aviso tono="info">Este registro tiene más de {DIAS_EDICION} días: solo se puede ver.</Aviso>
          {r && Object.keys(r.items).length > 0 && (
            <div>
              <p className="mb-1 font-semibold">Productos</p>
              <ul className="divide-y divide-black/5 rounded-xl border border-black/10">
                {Object.entries(r.items).map(([cod, it]) => {
                  const p = cfg.productosPorCod[cod];
                  return (
                    <li key={cod} className="p-2.5">
                      <p className="font-semibold">{nombreProducto(p, cod)}</p>
                      <p className="text-xs text-tinta-suave">
                        Inicial {cantidadTxt(iniOf(it), p)} · Final {cantidadTxt(finOf(it), p)} · Venta{' '}
                        {cantidadTxt(ventaOf(it), p)}
                        {it.agot ? ' · Agotado' : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {r?.impulso?.abordados ? (
            <p>
              Impulso: {fmt(r.impulso.abordados, 0)} abordados · {fmt(r.impulso.compras ?? 0, 0)} compras (
              {pct((r.impulso.compras ?? 0) / r.impulso.abordados)})
            </p>
          ) : null}
          {r && r.nov.length > 0 && <p>Novedades: {r.nov.join(', ')}</p>}
          {r?.obs && <p className="whitespace-pre-line text-tinta-suave">“{r.obs}”</p>}
        </div>
      )}
    </HojaInferior>
  );
}

export default function MisRegistrosPage() {
  useTemaAyuda('mis-registros');
  const { usuario } = useAuth();
  const nav = useNavigate();
  const hoy = hoyBogota();
  const minEdicion = sumarDias(hoy, -DIAS_EDICION);
  const [detalle, setDetalle] = useState<Fila | null>(null);
  const [descartando, setDescartando] = useState<Fila | null>(null);
  const sincronizar = useSincronizarAhora();
  const sincronizando = useEstadoSync((s) => s.sincronizando);
  const cola = useCola();

  const q = useQuery({
    queryKey: ['registros', 'mios', usuario?._id],
    enabled: !!usuario,
    queryFn: () => api<Paginado<Registro>>('/registros', { query: { porPagina: 60, impulsadoraId: usuario?._id } }),
  });

  const grupos = useMemo(() => {
    const filas: Fila[] = [];
    const enCola = new Set<string>();
    for (const c of cola ?? []) {
      enCola.add(c.id);
      filas.push({
        id: c.id,
        fecha: c.input.fecha,
        turno: c.input.turno,
        tipoDia: c.input.tipoDia,
        pdvId: c.input.pdvId,
        pdvNombre: c.resumen.pdvNombre,
        nProductos: c.resumen.nProductos,
        peor: c.resumen.peorNivel,
        fueraDeRango: c.resumen.fueraDeRango === true,
        estado: c.estado === 'error' && c.errorDeDatos ? 'error' : 'pendiente',
        error: c.ultimoError,
        cola: c,
      });
    }
    for (const r of q.data?.items ?? []) {
      if (enCola.has(r._id) || (usuario && r.impulsadoraId !== usuario._id)) continue;
      filas.push({
        id: r._id,
        fecha: r.fecha,
        turno: r.turno,
        tipoDia: r.tipoDia,
        pdvId: r.pdvId,
        pdvNombre: r.pdvNombre,
        nProductos: Object.values(r.items ?? {}).filter(tieneDatos).length,
        peor: peorNivel((r.riesgos ?? []).map((x) => x.nivel)),
        fueraDeRango: r.geo?.dentroDeRango === false,
        estado: 'enviado',
        registro: r,
        actualizado: r.actualizadoEn,
      });
    }
    filas.sort((a, b) => (a.fecha === b.fecha ? ordenTurno(b.turno) - ordenTurno(a.turno) : a.fecha < b.fecha ? 1 : -1));
    const g = new Map<string, Fila[]>();
    for (const f of filas) g.set(f.fecha, [...(g.get(f.fecha) ?? []), f]);
    return [...g.entries()];
  }, [cola, q.data, usuario]);

  const abrir = (f: Fila) => {
    if (f.fecha >= minEdicion && f.fecha <= hoy)
      nav(`/registrar?pdvId=${encodeURIComponent(f.pdvId)}&fecha=${f.fecha}&turno=${encodeURIComponent(f.turno)}`);
    else setDetalle(f);
  };

  const confirmarDescarte = async () => {
    const f = descartando;
    if (!f?.cola) return;
    await borrarFotosLocales(fotosDe(f.cola.input).filter(esFotoLocal).map(idFotoLocal));
    await descartarDeCola(f.id);
    setDescartando(null);
    toast('Registro descartado del celular.');
  };

  const nCola = cola?.length ?? 0;

  return (
    <div className="pb-8">
      <Encabezado
        titulo="Mis registros"
        subtitulo={`Últimos 60 · puedes editar hasta ${DIAS_EDICION} días atrás`}
        accion={
          <Boton
            variante="secundario"
            tam="md"
            icono={<RefreshCw className={clsx('h-4 w-4', (q.isFetching || sincronizando) && 'animate-spin')} />}
            onClick={() => {
              void q.refetch();
              if (nCola) void sincronizar({ incluirErrores: true, avisar: true });
            }}
            aria-label="Actualizar y enviar pendientes"
          >
            {nCola ? 'Enviar' : 'Actualizar'}
          </Boton>
        }
      />

      {nCola > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-aviso-bg px-3 py-1 text-sm text-aviso">
          <span>
            {nCola} en el celular: se envían solos cuando hay señal.
          </span>
          <AyudaEnLinea tema="offline" etiqueta="Cómo funciona sin señal" />
        </div>
      )}

      {q.isError && (
        <div className="mb-3">
          <Aviso tono="aviso" icono={<WifiOff className="h-5 w-5" />}>
            Sin señal: mostramos solo lo que está guardado en el celular.
          </Aviso>
        </div>
      )}

      {q.isLoading && !nCola ? (
        <Cargando texto="Cargando tus registros…" />
      ) : grupos.length === 0 ? (
        <div className="tarjeta">
          <Vacio
            icono={<ClipboardList className="h-10 w-10" />}
            titulo="Aún no tienes registros"
            texto="Cuando guardes tu primer conteo aparecerá aquí."
            accion={<Boton onClick={() => nav('/registrar')}>Registrar conteo</Boton>}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(([fecha, filas]) => (
            <section key={fecha} aria-labelledby={`dia-${fecha}`}>
              <h2 id={`dia-${fecha}`} className="mb-2 text-sm font-bold uppercase tracking-wide text-tinta-tenue">
                {fecha === hoy ? 'Hoy' : fechaCorta(fecha)}
              </h2>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {filas.map((f) => {
                    const editable = f.fecha >= minEdicion;
                    const e = ESTADO[f.estado];
                    return (
                      <motion.li key={f.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className={clsx('tarjeta !p-0', f.estado === 'error' && 'ring-1 ring-error/40')}>
                          <button
                            type="button"
                            onClick={() => abrir(f)}
                            className="flex w-full items-center gap-3 p-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{f.pdvNombre}</p>
                              <p className="text-sm text-tinta-suave">
                                {f.turno}
                                {f.tipoDia !== 'Laboral'
                                  ? ` · ${f.tipoDia}`
                                  : ` · ${f.nProductos} producto${f.nProductos === 1 ? '' : 's'}`}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <Chip tono={e.tono}>
                                  {e.icono} {e.texto}
                                </Chip>
                                {f.peor !== 'ok' && <NivelChip nivel={f.peor} />}
                                {f.fueraDeRango && (
                                  <Chip tono="error">
                                    <MapPinOff className="h-3.5 w-3.5" aria-hidden /> Fuera de rango
                                  </Chip>
                                )}
                              </div>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-marca-700">
                              {editable ? 'Editar' : <Eye className="h-4 w-4" aria-label="Ver" />}
                              <ChevronRight className="h-5 w-5" aria-hidden />
                            </span>
                          </button>
                          {f.estado !== 'enviado' && f.error && (
                            <div className="flex items-start gap-2 border-t border-black/5 px-3 py-2 text-sm">
                              <p className={clsx('flex-1', f.estado === 'error' ? 'text-error' : 'text-tinta-suave')}>
                                {f.estado === 'error' ? f.error : `Último intento: ${f.error}`}
                              </p>
                              {f.estado === 'error' && (
                                <button
                                  type="button"
                                  onClick={() => setDescartando(f)}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-xs font-semibold text-tinta-suave hover:bg-black/5"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden /> Descartar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      <DetalleRegistro fila={detalle} onCerrar={() => setDetalle(null)} />

      <HojaInferior
        abierta={!!descartando}
        onCerrar={() => setDescartando(null)}
        titulo="¿Descartar este registro?"
        pie={
          <div className="flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={() => setDescartando(null)}>
              No, conservar
            </Boton>
            <Boton variante="peligro" className="flex-1" onClick={() => void confirmarDescarte()}>
              Sí, descartar
            </Boton>
          </div>
        }
      >
        <p className="text-sm text-tinta-suave">
          Se borrará del celular el registro de <b>{descartando?.pdvNombre}</b> ({descartando && fechaCorta(descartando.fecha)},{' '}
          {descartando?.turno}) con sus fotos. <b>No se podrá recuperar.</b> Si puedes, mejor tócalo para corregirlo y vuelve a
          guardar.
        </p>
      </HojaInferior>
    </div>
  );
}
