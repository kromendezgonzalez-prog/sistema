import { DIAS_EDICION, sumarDias, TIPOS_DIA, TURNOS, type Pdv, type TipoDia, type Turno } from '@merca/shared';
import clsx from 'clsx';
import { Check, ChevronRight, MapPin, Search, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AyudaEnLinea } from '@/components/ayuda/Ayuda';
import { HojaInferior, Pildoras, Tarjeta } from '@/components/ui';
import { fechaCorta } from '@/lib/formato';

function OpcionPunto({ pdv, activo, onClick }: { pdv: Pdv; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={clsx(
        'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
        activo ? 'border-marca-600 bg-marca-50 ring-2 ring-marca-600/20' : 'border-black/10 bg-white hover:border-marca-600/40',
      )}
    >
      <Store className={clsx('h-5 w-5 shrink-0', activo ? 'text-marca-600' : 'text-tinta-tenue')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{pdv.nombre}</span>
        <span className="block text-xs text-tinta-tenue">
          {[pdv.cadena, pdv.ciudad].filter(Boolean).join(' · ') || 'Punto de venta'}
          {!pdv.ubicacion && ' · sin ubicación fijada'}
        </span>
      </span>
      {activo && <Check className="h-5 w-5 text-marca-600" aria-hidden />}
    </button>
  );
}

/** Selector de punto SOLO desde la lista: tarjetas si son pocos; hoja con buscador si son muchos. */
export function SelectorPunto({
  asignados,
  otros,
  valor,
  onCambio,
}: {
  asignados: Pdv[];
  otros: Pdv[];
  valor: string;
  onCambio: (id: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const todos = [...asignados, ...otros];
  const sel = todos.find((p) => p._id === valor);
  const filtrar = (ps: Pdv[]) => {
    const t = q.trim().toLowerCase();
    return t ? ps.filter((p) => `${p.nombre} ${p.cadena} ${p.ciudad}`.toLowerCase().includes(t)) : ps;
  };

  if (todos.length === 0)
    return (
      <p className="rounded-xl bg-aviso-bg p-3 text-sm text-aviso">
        No tienes puntos de venta asignados. Avísale a tu supervisora para que te los asigne.
      </p>
    );

  if (todos.length <= 4)
    return (
      <div role="radiogroup" aria-label="Punto de venta" className="space-y-2">
        {todos.map((p) => (
          <OpcionPunto key={p._id} pdv={p} activo={p._id === valor} onClick={() => onCambio(p._id)} />
        ))}
      </div>
    );

  const grupo = (titulo: string, ps: Pdv[]) =>
    ps.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-tinta-tenue">{titulo}</p>
        {ps.map((p) => (
          <OpcionPunto
            key={p._id}
            pdv={p}
            activo={p._id === valor}
            onClick={() => {
              onCambio(p._id);
              setAbierta(false);
            }}
          />
        ))}
      </div>
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3 text-left hover:border-marca-600/40"
        aria-haspopup="dialog"
      >
        <MapPin className="h-5 w-5 text-marca-600" aria-hidden />
        <span className="min-w-0 flex-1">
          {sel ? (
            <>
              <span className="block font-semibold">{sel.nombre}</span>
              <span className="block text-xs text-tinta-tenue">{[sel.cadena, sel.ciudad].filter(Boolean).join(' · ')}</span>
            </>
          ) : (
            <span className="text-tinta-tenue">Elige el punto de venta</span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 text-tinta-tenue" aria-hidden />
      </button>
      <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Punto de venta">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-tenue" aria-hidden />
            <input
              type="search"
              aria-label="Buscar punto de venta"
              className="campo pl-10"
              placeholder="Buscar por nombre o ciudad"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div role="radiogroup" aria-label="Punto de venta" className="space-y-4">
            {grupo('Mis puntos asignados', filtrar(asignados))}
            {grupo(asignados.length ? 'Otros puntos' : 'Puntos de venta', filtrar(otros))}
          </div>
        </div>
      </HojaInferior>
    </>
  );
}

export function Jornada({
  hoy,
  fecha,
  turno,
  tipoDia,
  pdvId,
  asignados,
  otros,
  onCambiarClave,
  onTipoDia,
}: {
  hoy: string;
  fecha: string;
  turno: Turno;
  tipoDia: TipoDia;
  pdvId: string;
  asignados: Pdv[];
  otros: Pdv[];
  onCambiarClave: (p: { fecha?: string; turno?: Turno; pdvId?: string }) => void;
  onTipoDia: (t: TipoDia) => void;
}) {
  const min = useMemo(() => sumarDias(hoy, -DIAS_EDICION), [hoy]);
  const atajos = [
    { f: hoy, t: 'Hoy' },
    { f: sumarDias(hoy, -1), t: 'Ayer' },
  ];
  return (
    <Tarjeta numero={1} titulo="Jornada" accion={<AyudaEnLinea tema="registrar.jornada" etiqueta="Ayuda sobre la jornada" />}>
      <div className="space-y-4">
        <div>
          <label htmlFor="fecha-registro" className="etiqueta">
            Fecha
          </label>
          <div className="flex gap-2">
            <input
              id="fecha-registro"
              type="date"
              className="campo flex-1"
              value={fecha}
              min={min}
              max={hoy}
              onChange={(e) => {
                const v = e.target.value;
                if (v && v >= min && v <= hoy) onCambiarClave({ fecha: v });
              }}
              aria-describedby="fecha-ayuda"
            />
            {atajos.map((a) => (
              <button
                key={a.t}
                type="button"
                onClick={() => onCambiarClave({ fecha: a.f })}
                aria-pressed={fecha === a.f}
                className={clsx(
                  'min-h-[48px] rounded-xl border px-3 text-sm font-semibold transition',
                  fecha === a.f ? 'border-marca-600 bg-marca-600 text-white' : 'border-black/10 bg-white text-tinta',
                )}
              >
                {a.t}
              </button>
            ))}
          </div>
          <p id="fecha-ayuda" className="mt-1 text-xs text-tinta-tenue">
            {fechaCorta(fecha)} · puedes registrar hasta {DIAS_EDICION} días atrás.
          </p>
        </div>

        <Pildoras etiqueta="Turno" opciones={TURNOS} valor={turno} onChange={(t) => onCambiarClave({ turno: t })} />

        <div>
          <Pildoras etiqueta="Tipo de día" opciones={TIPOS_DIA} valor={tipoDia} onChange={onTipoDia} />
          {tipoDia !== 'Laboral' && (
            <p className="mt-2 rounded-xl bg-marca-50 p-3 text-sm text-marca-800">
              Para <b>{tipoDia.toLowerCase()}</b> solo necesitas dejar una nota en Novedades. No se pide ubicación ni
              inventario.
            </p>
          )}
        </div>

        <div>
          <span className="etiqueta" id="pdv-etiqueta">
            Punto de venta
          </span>
          <SelectorPunto asignados={asignados} otros={otros} valor={pdvId} onCambio={(id) => onCambiarClave({ pdvId: id })} />
        </div>
      </div>
    </Tarjeta>
  );
}
