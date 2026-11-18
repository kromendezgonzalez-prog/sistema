import { INFO_NIVEL, type Producto } from '@merca/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertOctagon, CheckCircle2, CloudOff, History, MapPin, PackageCheck, Save, ShieldAlert, XCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AyudaEnLinea } from '@/components/ayuda/Ayuda';
import { Boton, HojaInferior, NivelChip } from '@/components/ui';
import { esFotoLocal, fotosDe, idFotoLocal } from '@/lib/fotos';
import { fechaCorta } from '@/lib/formato';
import { db, type FormRegistro } from '@/offline/db';
import { cantidadTxt, metros } from '../util';
import type { Analisis } from './modelo';

function Fila({ icono, titulo, children, tono = 'neutro' }: { icono: ReactNode; titulo: ReactNode; children?: ReactNode; tono?: 'ok' | 'aviso' | 'error' | 'neutro' }) {
  const color = { ok: 'text-ok', aviso: 'text-aviso', error: 'text-error', neutro: 'text-tinta-suave' }[tono];
  return (
    <li className="flex gap-3 py-2.5">
      <span className={`mt-0.5 shrink-0 ${color}`}>{icono}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-tinta">{titulo}</p>
        {children && <div className="text-tinta-suave">{children}</div>}
      </div>
    </li>
  );
}

/** Resumen antes de guardar: alertas, lotes urgentes, fotos pendientes y GPS. Doble confirmación si hay alertas. */
export function ResumenGuardar({
  abierta,
  onCerrar,
  form,
  analisis,
  bloqueos,
  pdvNombre,
  productos,
  sinConfirmar,
  guardando,
  onGuardar,
}: {
  abierta: boolean;
  onCerrar: () => void;
  form: FormRegistro;
  analisis: Analisis;
  bloqueos: string[];
  pdvNombre: string;
  productos: Record<string, Producto>;
  sinConfirmar: number;
  guardando: boolean;
  onGuardar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => {
    if (!abierta) setConfirmando(false);
  }, [abierta]);

  const idsLocales = fotosDe(form).filter(esFotoLocal).map(idFotoLocal);
  const fotosPendientes =
    useLiveQuery(
      async () => (await db.fotosPendientes.bulkGet(idsLocales)).filter((f) => f && !f.subida).length,
      [idsLocales.join(',')],
    ) ?? analisis.fotosLocales;

  const lab = form.tipoDia === 'Laboral';
  const urgentes = analisis.riesgos.filter((r) => r.nivel === 'vencido' || r.nivel === 'emergencia');
  const otrosRiesgos = analisis.riesgos.length - urgentes.length;
  const hayAlertas = analisis.totalAlertas > 0 || analisis.vencidosSinNovedad > 0;

  const tocarGuardar = () => {
    if (hayAlertas && !confirmando) return setConfirmando(true);
    onGuardar();
  };

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Revisa antes de guardar"
      pie={
        bloqueos.length > 0 ? (
          <Boton bloque tam="lg" variante="secundario" onClick={onCerrar}>
            Volver a completar
          </Boton>
        ) : confirmando ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-error" role="alert">
              Hay datos en rojo. ¿Seguro que están bien? Si los revisaste, puedes guardar igual.
            </p>
            <div className="flex gap-2">
              <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
                Revisar
              </Boton>
              <Boton variante="peligro" className="flex-1" cargando={guardando} onClick={onGuardar}>
                Sí, guardar igual
              </Boton>
            </div>
          </div>
        ) : (
          <Boton bloque tam="lg" cargando={guardando} icono={<Save className="h-5 w-5" />} onClick={tocarGuardar}>
            {guardando ? 'Guardando…' : 'Guardar registro'}
          </Boton>
        )
      }
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-marca-50 p-3 text-sm text-marca-800">
          <p>
            <b>{pdvNombre || 'Sin punto'}</b>
            <br />
            {fechaCorta(form.fecha)} · {form.turno} · {form.tipoDia}
          </p>
          <AyudaEnLinea tema="registrar.guardar" etiqueta="Ayuda sobre guardar" />
        </div>

        <ul className="divide-y divide-black/5">
          {bloqueos.map((b) => (
            <Fila key={b} icono={<XCircle className="h-5 w-5" />} titulo={b} tono="error" />
          ))}

          {lab && form.geo && (
            <Fila
              icono={analisis.geo?.dentroDeRango === false ? <ShieldAlert className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
              tono={analisis.geo?.dentroDeRango === false ? 'aviso' : 'ok'}
              titulo={
                analisis.geo?.dentroDeRango === false
                  ? `Fuera de rango: a ${metros(analisis.geo.distanciaPdvM ?? 0)} del punto`
                  : analisis.geo?.dentroDeRango
                    ? `Ubicación OK (a ${metros(analisis.geo.distanciaPdvM ?? 0)})`
                    : 'Ubicación tomada'
              }
            >
              {analisis.geo?.dentroDeRango === false && 'Se guardará con la marca “fuera de rango”.'}
            </Fila>
          )}

          {lab && (
            <Fila
              icono={<PackageCheck className="h-5 w-5" />}
              tono={analisis.nProductos ? 'ok' : 'neutro'}
              titulo={`${analisis.nProductos} producto${analisis.nProductos === 1 ? '' : 's'} con datos`}
            >
              {analisis.sinCierre > 0 &&
                `${analisis.sinCierre} sin lotes de cierre: puedes guardar ahora y completar el cierre más tarde.`}
            </Fila>
          )}

          {sinConfirmar > 0 && (
            <Fila icono={<History className="h-5 w-5" />} tono="aviso" titulo={`${sinConfirmar} producto(s) precargados sin confirmar`}>
              Verifica que los lotes de llegada coincidan con lo que hay en la nevera.
            </Fila>
          )}

          {analisis.alertas.length > 0 && (
            <Fila
              icono={<AlertOctagon className="h-5 w-5" />}
              tono="error"
              titulo={`${analisis.totalAlertas} alerta${analisis.totalAlertas === 1 ? '' : 's'} por revisar`}
            >
              <ul className="mt-1 space-y-1">
                {analisis.alertas.map((a) => (
                  <li key={a.cod}>
                    <b className="text-tinta">{a.nombre}:</b> {a.alertas.map((x) => x.mensaje).join(' ')}
                  </li>
                ))}
              </ul>
            </Fila>
          )}

          {analisis.vencidosSinNovedad > 0 && (
            <Fila icono={<AlertOctagon className="h-5 w-5" />} tono="error" titulo="Lotes vencidos sin novedad">
              Retíralos de la góndola y usa “Reportar novedad” en cada lote vencido.
            </Fila>
          )}

          {urgentes.length > 0 && (
            <Fila icono={<ShieldAlert className="h-5 w-5" />} tono="error" titulo="Acción hoy: lotes en emergencia o vencidos">
              <ul className="mt-1 space-y-1.5">
                {urgentes.map((r) => (
                  <li key={r.cod + r.loteId} className="flex flex-wrap items-center gap-1.5">
                    <NivelChip nivel={r.nivel} dias={r.dias} />
                    <span>
                      {r.nombre} · {cantidadTxt(r.cantidad, productos[r.cod])}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">{INFO_NIVEL.emergencia.accion}</p>
            </Fila>
          )}

          {otrosRiesgos > 0 && (
            <Fila icono={<ShieldAlert className="h-5 w-5" />} tono="aviso" titulo={`${otrosRiesgos} lote(s) en riesgo medio o crítico`}>
              {INFO_NIVEL.critico.accion}
            </Fila>
          )}

          {fotosPendientes > 0 && (
            <Fila icono={<CloudOff className="h-5 w-5" />} tono="aviso" titulo={`${fotosPendientes} foto(s) por subir`}>
              Se suben al guardar; si no hay señal, se envían solas después.
            </Fila>
          )}

          {bloqueos.length === 0 && !hayAlertas && (
            <Fila icono={<CheckCircle2 className="h-5 w-5" />} tono="ok" titulo="Todo listo para guardar" />
          )}
        </ul>
      </div>
    </HojaInferior>
  );
}
