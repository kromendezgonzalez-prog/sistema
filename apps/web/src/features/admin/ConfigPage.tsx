import {
  ConfigSchema,
  INFO_NIVEL,
  type Config,
  type NivelRiesgo,
  type UmbralesRiesgo,
} from '@merca/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Save, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Aviso, Boton, Campo, Encabezado, Tarjeta } from '@/components/ui';
import { AyudaEnLinea, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { api, mensajeError } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { aNumero } from '@/lib/formato';
import { ESTILO_NIVEL, textoRangoNivel } from '@/features/tablero/niveles';
import { ErrorCarga, Esqueleto, Pagina } from './comun';
import { ListaEditable } from './comun/ListaEditable';
import { validarUmbrales, type ErroresUmbrales } from './umbrales';

interface Formulario {
  doh: string;
  merma: string;
  osa: string;
  sos: string;
  conv: string;
  medio: string;
  critico: string;
  emergencia: string;
  marcasCompetencia: string[];
  novedadesGenerales: string[];
  novedadesProducto: string[];
}

/** 0,02 → "2" ; 0,955 → "95,5" (se muestra en %). */
const aPct = (v: number) => String(Math.round(v * 1000) / 10).replace('.', ',');
const deConfig = (c: Config): Formulario => ({
  doh: String(c.metas.doh).replace('.', ','),
  merma: aPct(c.metas.merma),
  osa: aPct(c.metas.osa),
  sos: aPct(c.metas.sos),
  conv: aPct(c.metas.conv),
  medio: String(c.riesgoVto.medio),
  critico: String(c.riesgoVto.critico),
  emergencia: String(c.riesgoVto.emergencia),
  marcasCompetencia: c.marcasCompetencia,
  novedadesGenerales: c.novedadesGenerales,
  novedadesProducto: c.novedadesProducto,
});

/** Convierte el formulario a Config (porcentajes 0–100 → 0–1) y valida. */
function aConfig(f: Formulario): {
  config: Config | null;
  errores: Record<string, string>;
  umbrales: ErroresUmbrales;
} {
  const errores: Record<string, string> = {};
  const doh = aNumero(f.doh);
  if (doh === null || doh <= 0 || doh > 60) errores.doh = 'Entre 0,5 y 60 días';
  const pct = (k: 'merma' | 'osa' | 'sos' | 'conv') => {
    const v = aNumero(f[k]);
    if (v === null || v < 0 || v > 100) {
      errores[k] = 'Un porcentaje entre 0 y 100';
      return 0;
    }
    return Math.round(v * 10) / 1000;
  };
  const metas = {
    doh: doh ?? 0,
    merma: pct('merma'),
    osa: pct('osa'),
    sos: pct('sos'),
    conv: pct('conv'),
  };
  const u = {
    medio: aNumero(f.medio),
    critico: aNumero(f.critico),
    emergencia: aNumero(f.emergencia),
  };
  const umbrales = validarUmbrales(u);
  if (Object.keys(errores).length || Object.keys(umbrales).length)
    return { config: null, errores, umbrales };
  const r = ConfigSchema.safeParse({
    metas,
    riesgoVto: u,
    marcasCompetencia: f.marcasCompetencia,
    novedadesGenerales: f.novedadesGenerales,
    novedadesProducto: f.novedadesProducto,
  });
  if (!r.success)
    return {
      config: null,
      errores: { general: r.error.issues[0]?.message ?? 'Revisa los datos' },
      umbrales,
    };
  return { config: r.data, errores, umbrales };
}

export default function ConfigPage() {
  useTemaAyuda('admin.config');
  const qc = useQueryClient();
  const cfg = useConfig();
  const original = cfg.data?.config;
  const [f, setF] = useState<Formulario | null>(null);
  const [intentado, setIntentado] = useState(false);

  useEffect(() => {
    if (original && !f) setF(deConfig(original));
  }, [original, f]);

  const resultado = useMemo(() => (f ? aConfig(f) : null), [f]);
  const sucio = !!f && !!original && JSON.stringify(f) !== JSON.stringify(deConfig(original));

  const guardar = useMutation({
    mutationFn: (c: Config) => api<{ config: Config }>('/admin/config', { method: 'PUT', body: c }),
    onSuccess: (r) => {
      toast.success('Configuración guardada', {
        description: 'Se aplica a todo el equipo desde ya.',
      });
      setF(deConfig(r.config));
      setIntentado(false);
      qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (e) =>
      toast.error('No se pudo guardar la configuración', { description: mensajeError(e) }),
  });

  if (cfg.isError && !original)
    return <ErrorCarga error={cfg.error} onReintentar={() => cfg.refetch()} />;
  if (!f || !resultado)
    return (
      <Pagina>
        <Encabezado titulo="Metas y riesgo" />
        <Esqueleto className="h-64" />
        <Esqueleto className="h-64" />
      </Pagina>
    );

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) =>
    setF((x) => (x ? { ...x, [k]: v } : x));
  const err = (k: string) =>
    intentado || f[k as keyof Formulario] !== '' ? resultado.errores[k] || null : null;
  const eu = resultado.umbrales;

  const enviar = () => {
    setIntentado(true);
    if (!resultado.config) {
      toast.error('Revisa los campos marcados en rojo');
      return;
    }
    guardar.mutate(resultado.config);
  };

  return (
    <Pagina className="pb-20">
      <Encabezado
        titulo="Metas y riesgo"
        subtitulo="Los cambios se aplican a todo el equipo al guardar"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta
          titulo="Metas de los indicadores"
          accion={<AyudaEnLinea tema="admin.config" etiqueta="Ayuda sobre metas" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Días de inventario máx."
              inputMode="decimal"
              sufijo="días"
              value={f.doh}
              onChange={(e) => set('doh', e.target.value)}
              error={err('doh')}
            />
            <Campo
              etiqueta="% merma máx."
              inputMode="decimal"
              sufijo="%"
              value={f.merma}
              onChange={(e) => set('merma', e.target.value)}
              error={err('merma')}
            />
            <Campo
              etiqueta="Disponibilidad (OSA) mín."
              inputMode="decimal"
              sufijo="%"
              value={f.osa}
              onChange={(e) => set('osa', e.target.value)}
              error={err('osa')}
            />
            <Campo
              etiqueta="Share of shelf mín."
              inputMode="decimal"
              sufijo="%"
              value={f.sos}
              onChange={(e) => set('sos', e.target.value)}
              error={err('sos')}
            />
            <Campo
              etiqueta="Conversión del impulso mín."
              inputMode="decimal"
              sufijo="%"
              value={f.conv}
              onChange={(e) => set('conv', e.target.value)}
              error={err('conv')}
            />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Umbrales de riesgo de vencimiento">
          <p className="-mt-1 mb-3 text-sm text-tinta-suave">
            Días que faltan para vencer. Debe cumplirse: Medio &gt; Crítico &gt; Emergencia.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Campo
              etiqueta="Medio ≤"
              inputMode="numeric"
              sufijo="d"
              value={f.medio}
              onChange={(e) => set('medio', e.target.value.replace(/[^\d]/g, ''))}
              error={eu.medio ?? null}
            />
            <Campo
              etiqueta="Crítico ≤"
              inputMode="numeric"
              sufijo="d"
              value={f.critico}
              onChange={(e) => set('critico', e.target.value.replace(/[^\d]/g, ''))}
              error={eu.critico ?? null}
            />
            <Campo
              etiqueta="Emergencia ≤"
              inputMode="numeric"
              sufijo="d"
              value={f.emergencia}
              onChange={(e) => set('emergencia', e.target.value.replace(/[^\d]/g, ''))}
              error={eu.emergencia ?? null}
            />
          </div>
          {eu.general && (
            <div className="mt-3">
              <Aviso tono="error">{eu.general}</Aviso>
            </div>
          )}
          <VistaPreviaUmbrales
            u={
              Object.keys(eu).length
                ? null
                : {
                    medio: Number(f.medio),
                    critico: Number(f.critico),
                    emergencia: Number(f.emergencia),
                  }
            }
          />
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Marcas de competencia">
          <ListaEditable
            etiqueta="Marcas"
            items={f.marcasCompetencia}
            onChange={(v) => set('marcasCompetencia', v)}
            maxLargo={60}
            placeholder="Ej.: Colanta"
          />
        </Tarjeta>
        <Tarjeta titulo="Novedades generales">
          <ListaEditable
            etiqueta="Tipos de novedad del registro"
            items={f.novedadesGenerales}
            onChange={(v) => set('novedadesGenerales', v)}
            maxLargo={80}
            placeholder="Ej.: Precio errado"
          />
        </Tarjeta>
        <Tarjeta titulo="Novedades de producto">
          <ListaEditable
            etiqueta="Tipos de novedad por lote"
            items={f.novedadesProducto}
            onChange={(v) => set('novedadesProducto', v)}
            maxLargo={60}
            placeholder="Ej.: Vacío perdido"
          />
        </Tarjeta>
      </div>

      {resultado.errores.general && intentado && (
        <Aviso tono="error">{resultado.errores.general}</Aviso>
      )}

      {/* Barra de guardado */}
      <AnimatePresence>
        {sucio && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed inset-x-0 bottom-20 z-30 px-4"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-white shadow-xl">
              <p className="text-sm font-medium">Tienes cambios sin guardar</p>
              <div className="flex gap-2">
                <Boton
                  tam="sm"
                  variante="fantasma"
                  className="text-white hover:bg-white/10"
                  icono={<Undo2 className="h-4 w-4" />}
                  onClick={() => {
                    setF(deConfig(original!));
                    setIntentado(false);
                  }}
                  disabled={guardar.isPending}
                >
                  Descartar
                </Boton>
                <Boton
                  tam="sm"
                  onClick={enviar}
                  cargando={guardar.isPending}
                  icono={<Save className="h-4 w-4" />}
                  className="bg-white text-marca-700 hover:bg-marca-50"
                >
                  Guardar
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Pagina>
  );
}

/** Vista previa de los niveles con sus colores, íconos y rangos de días. */
export function VistaPreviaUmbrales({ u }: { u: UmbralesRiesgo | null }) {
  if (!u)
    return (
      <p className="mt-4 rounded-xl bg-black/[.04] p-3 text-sm text-tinta-tenue">
        Corrige los umbrales para ver la vista previa.
      </p>
    );
  const tramos: { n: NivelRiesgo; peso: number }[] = [
    { n: 'vencido', peso: 2 },
    { n: 'emergencia', peso: u.emergencia + 1 },
    { n: 'critico', peso: u.critico - u.emergencia },
    { n: 'medio', peso: u.medio - u.critico },
    { n: 'ok', peso: 3 },
  ];
  return (
    <div className="mt-4" aria-label="Vista previa de los niveles de riesgo">
      <p className="etiqueta">Vista previa</p>
      <div className="flex h-9 overflow-hidden rounded-xl" aria-hidden>
        {tramos.map((t) => (
          <motion.div
            key={t.n}
            layout
            className={clsx(
              'grid min-w-[2rem] place-items-center text-sm font-bold',
              ESTILO_NIVEL[t.n].barra,
              t.n === 'medio' ? 'text-tinta' : 'text-white',
            )}
            style={{ flexGrow: t.peso, flexBasis: 0 }}
            title={INFO_NIVEL[t.n].etiqueta}
          >
            {INFO_NIVEL[t.n].icono}
          </motion.div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {tramos.map((t) => (
          <li key={t.n} className="flex items-center gap-2 text-sm">
            <span
              className={clsx(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                ESTILO_NIVEL[t.n].barra,
                t.n === 'medio' ? 'text-tinta' : 'text-white',
              )}
              aria-hidden
            >
              {INFO_NIVEL[t.n].icono}
            </span>
            <span className="font-semibold text-tinta">{INFO_NIVEL[t.n].etiqueta}:</span>
            <span className="text-tinta-suave">{textoRangoNivel(t.n, u)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
