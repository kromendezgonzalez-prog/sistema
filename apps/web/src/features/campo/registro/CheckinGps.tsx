import { evaluarGeo, type GeoInput, type Pdv } from '@merca/shared';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, LocateFixed, MapPin, MapPinOff, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AyudaEnLinea } from '@/components/ayuda/Ayuda';
import { Aviso, Boton } from '@/components/ui';
import { fechaHora } from '@/lib/formato';
import { ErrorGeo, esIPhone, estadoPermisoGeo, obtenerUbicacion, PRECISION_BAJA_M, type TipoErrorGeo } from '@/lib/geo';
import { metros } from '../util';

type Estado = { fase: 'inicial' } | { fase: 'pidiendo' } | { fase: 'error'; tipo: TipoErrorGeo } | { fase: 'listo' };

/** Mini "radar": el punto en el centro, el círculo del radio permitido y la trabajadora. */
function Radar({ geo, pdv }: { geo: GeoInput; pdv: Pdv }) {
  if (!pdv.ubicacion) return null;
  const R = 56;
  const radio = pdv.radioM ?? 300;
  const latRad = (pdv.ubicacion.lat * Math.PI) / 180;
  const dx = (geo.lng - pdv.ubicacion.lng) * 111_320 * Math.cos(latRad);
  const dy = (geo.lat - pdv.ubicacion.lat) * 110_540;
  const dist = Math.hypot(dx, dy);
  const escala = R / Math.max(radio * 1.4, dist * 1.15, 1);
  const x = 64 + dx * escala;
  const y = 64 - dy * escala;
  const dentro = dist <= radio;
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" role="img" aria-label={`Estás a ${metros(Math.round(dist))} del punto`}>
      <circle cx="64" cy="64" r={R} className="fill-black/[.03] stroke-black/10" strokeWidth="1" />
      <circle
        cx="64"
        cy="64"
        r={radio * escala}
        className={dentro ? 'fill-ok/10 stroke-ok/60' : 'fill-marca-600/5 stroke-marca-600/40'}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <circle cx={x} cy={y} r={Math.min(R, geo.precisionM * escala)} className="fill-sky-500/10" />
      <g transform="translate(64 64)">
        <path d="M0 -12 C 6 -12 8 -7 8 -4 C 8 2 0 8 0 8 C 0 8 -8 2 -8 -4 C -8 -7 -6 -12 0 -12 Z" className="fill-marca-600" />
        <circle cx="0" cy="-4" r="3" className="fill-white" />
      </g>
      <circle cx={x} cy={y} r="6" className="fill-sky-600 stroke-white" strokeWidth="2">
        <animate attributeName="r" values="6;7.5;6" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function InstruccionesPermiso({ tipo }: { tipo: TipoErrorGeo }) {
  const iphone = esIPhone();
  const [plataforma, setPlataforma] = useState<'android' | 'iphone'>(iphone ? 'iphone' : 'android');
  if (tipo === 'no-soportado')
    return (
      <p className="text-sm text-tinta-suave">
        Abre la app desde <b>Google Chrome</b> (Android) o <b>Safari</b> (iPhone) actualizados.
      </p>
    );
  const pasosDenegado = {
    android: [
      'Toca el candado 🔒 o el ícono ⓘ al lado de la dirección, arriba en Chrome.',
      'Entra a "Permisos" → "Ubicación" y elige "Permitir".',
      'Si instalaste la app: mantén presionado el ícono → "Información de la app" → Permisos → Ubicación → Permitir.',
      'Vuelve aquí y toca "Ya lo activé, reintentar".',
    ],
    iphone: [
      'Abre Ajustes → Privacidad y seguridad → Localización: debe estar activada.',
      'En esa misma lista busca Safari (o "Sitios web de Safari") y elige "Al usarse la app".',
      'Activa también "Ubicación exacta".',
      'Vuelve aquí y toca "Ya lo activé, reintentar".',
    ],
  };
  const pasosGps = {
    android: [
      'Desliza desde arriba de la pantalla y activa "Ubicación" (ícono 📍).',
      'Si estás dentro de la nevera o bodega, acércate a la entrada del almacén o a una ventana.',
      'Toca "Reintentar".',
    ],
    iphone: [
      'Abre Ajustes → Privacidad y seguridad → Localización y actívala.',
      'Si estás dentro de la nevera o bodega, acércate a la entrada del almacén.',
      'Toca "Reintentar".',
    ],
  };
  const pasos = (tipo === 'denegado' ? pasosDenegado : pasosGps)[plataforma];
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full bg-black/5 p-1" role="tablist" aria-label="Tipo de celular">
        {(['android', 'iphone'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={plataforma === p}
            onClick={() => setPlataforma(p)}
            className={clsx(
              'min-h-[40px] rounded-full px-4 text-sm font-semibold transition',
              plataforma === p ? 'bg-white text-marca-700 shadow' : 'text-tinta-suave',
            )}
          >
            {p === 'android' ? 'Android' : 'iPhone'}
          </button>
        ))}
      </div>
      <ol className="space-y-2">
        {pasos.map((t, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-marca-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-tinta-suave">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const TITULO_ERROR: Record<TipoErrorGeo, string> = {
  denegado: 'La app no tiene permiso para ver tu ubicación',
  'no-disponible': 'No encontramos señal de GPS',
  tiempo: 'El GPS se está demorando',
  'no-soportado': 'Este navegador no permite la ubicación',
};

/**
 * Check-in GPS obligatorio para días laborales.
 * Sin permiso o con el GPS apagado NO deja continuar (geo queda en null).
 */
export function CheckinGps({
  pdv,
  geo,
  onGeo,
}: {
  pdv: Pdv | undefined;
  geo: GeoInput | null;
  onGeo: (g: GeoInput) => void;
}) {
  const [estado, setEstado] = useState<Estado>(geo ? { fase: 'listo' } : { fase: 'inicial' });
  const montado = useRef(true);
  useEffect(() => {
    // Se reactiva en cada montaje (StrictMode monta, desmonta y vuelve a montar).
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const pedir = useCallback(async () => {
    setEstado({ fase: 'pidiendo' });
    try {
      const g = await obtenerUbicacion();
      if (!montado.current) return;
      onGeo(g);
      setEstado({ fase: 'listo' });
    } catch (e) {
      if (!montado.current) return;
      setEstado({ fase: 'error', tipo: e instanceof ErrorGeo ? e.tipo : 'no-disponible' });
    }
  }, [onGeo]);

  // Si el permiso ya está concedido, tomamos la ubicación sin pedir un toque extra.
  useEffect(() => {
    if (geo) return;
    let vivo = true;
    void estadoPermisoGeo().then((p) => {
      if (vivo && p === 'granted') void pedir();
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (geo && estado.fase !== 'pidiendo') setEstado({ fase: 'listo' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const ev = geo && pdv ? evaluarGeo(geo, pdv) : null;
  const bajaPrecision = !!geo && geo.precisionM > PRECISION_BAJA_M;

  return (
    <section className="tarjeta" aria-labelledby="gps-titulo" data-testid="checkin-gps">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="gps-titulo" className="flex items-center gap-2 text-base font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-marca-600 text-white">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          Ubicación (check-in)
        </h2>
        <AyudaEnLinea tema="registrar.gps" etiqueta="Ayuda sobre la ubicación" />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={estado.fase + (estado.fase === 'error' ? estado.tipo : '')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
        >
          {estado.fase === 'inicial' && (
            <div className="space-y-3">
              <p className="text-sm text-tinta-suave">
                Para registrar un día laboral necesitamos confirmar que estás en el punto. Tomamos tu ubicación{' '}
                <b>una sola vez</b>, al iniciar el conteo; no te seguimos durante el día.
              </p>
              <Boton bloque tam="lg" icono={<LocateFixed className="h-5 w-5" />} onClick={pedir}>
                Tomar mi ubicación
              </Boton>
            </div>
          )}

          {estado.fase === 'pidiendo' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
              <span className="relative grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-marca-600/20" />
                <span className="relative grid h-12 w-12 place-items-center rounded-full bg-marca-600 text-white">
                  <Crosshair className="h-6 w-6" aria-hidden />
                </span>
              </span>
              <p className="font-semibold">Buscando tu ubicación…</p>
              <p className="max-w-xs text-sm text-tinta-suave">
                Puede tardar unos segundos. Si estás dentro de la nevera, acércate a la entrada. Si el celular pregunta,
                toca <b>Permitir</b>.
              </p>
            </div>
          )}

          {estado.fase === 'error' && (
            <div className="space-y-3">
              <Aviso tono="error" icono={<MapPinOff className="h-5 w-5" />} titulo={TITULO_ERROR[estado.tipo]}>
                Sin ubicación no se puede guardar un día laboral. Sigue estos pasos:
              </Aviso>
              <InstruccionesPermiso tipo={estado.tipo} />
              {estado.tipo !== 'no-soportado' && (
                <Boton bloque tam="lg" icono={<RefreshCw className="h-5 w-5" />} onClick={pedir}>
                  {estado.tipo === 'denegado' ? 'Ya lo activé, reintentar' : 'Reintentar'}
                </Boton>
              )}
            </div>
          )}

          {estado.fase === 'listo' && geo && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {pdv?.ubicacion && <Radar geo={geo} pdv={pdv} />}
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  {ev?.dentroDeRango === true && (
                    <p className="text-base font-bold text-ok">✓ Estás en el punto</p>
                  )}
                  {ev?.dentroDeRango === false && (
                    <p className="text-base font-bold text-aviso">! Fuera de rango</p>
                  )}
                  {(!pdv?.ubicacion || ev?.dentroDeRango === null) && (
                    <p className="text-base font-bold text-tinta">📍 Ubicación tomada</p>
                  )}
                  {ev?.distanciaPdvM !== null && ev?.distanciaPdvM !== undefined && (
                    <p className="text-tinta-suave">
                      A <b className="text-tinta">{metros(ev.distanciaPdvM)}</b> del punto
                    </p>
                  )}
                  <p className="text-tinta-suave">Precisión: ±{metros(geo.precisionM)}</p>
                  <p className="text-xs text-tinta-tenue">Tomada: {fechaHora(geo.capturadoEn)}</p>
                </div>
              </div>

              {ev?.dentroDeRango === false && (
                <Aviso tono="aviso" icono={<ShieldAlert className="h-5 w-5" />} titulo={`Estás a ${metros(ev.distanciaPdvM ?? 0)} del punto`}>
                  {pdv ? `${pdv.nombre} queda más lejos de ${metros(pdv.radioM ?? 300)}. ` : ''}Puedes continuar, pero el
                  registro quedará marcado como <b>“fuera de rango”</b>. Si estás en el punto, actualiza la ubicación cerca de
                  la entrada.
                </Aviso>
              )}
              {pdv && !pdv.ubicacion && (
                <Aviso tono="info">
                  Este punto aún no tiene su ubicación fijada en el sistema. Guardamos tu ubicación igual; no tienes que hacer
                  nada más.
                </Aviso>
              )}
              {bajaPrecision && (
                <Aviso tono="aviso">
                  La precisión es baja (±{metros(geo.precisionM)}). Si puedes, acércate a una ventana o a la entrada y toca
                  “Actualizar ubicación”.
                </Aviso>
              )}
              <Boton variante="secundario" bloque icono={<RefreshCw className="h-4 w-4" />} onClick={pedir}>
                Actualizar ubicación
              </Boton>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
