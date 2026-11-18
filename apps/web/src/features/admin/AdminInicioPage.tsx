import { hoyBogota } from '@merca/shared';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ChevronRight,
  DatabaseBackup,
  Images,
  Package,
  ScrollText,
  Settings2,
  Store,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Boton, Chip, Encabezado } from '@/components/ui';
import { AyudaEnLinea, useTemaAyuda } from '@/components/ayuda/Ayuda';
import { descargar, mensajeError } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { Confirmar, Pagina } from './comun';

const HOJAS_BACKUP = [
  'Registros',
  'Detalle productos',
  'Lotes',
  'Novedades (con link a la foto)',
  'Usuarios (sin contraseñas)',
  'Puntos de venta',
  'Productos',
  'Configuración',
  'Auditoría',
];

export default function AdminInicioPage() {
  useTemaAyuda('admin');
  const cfg = useConfig();
  const [confirmar, setConfirmar] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const pdvs = cfg.data?.pdvs ?? [];
  const sinUbicacion = pdvs.filter((p) => p.activo && !p.ubicacion).length;
  const undSinPeso = (cfg.data?.productos ?? []).filter(
    (p) => p.activo && p.unidad === 'und' && !p.pesoKg,
  ).length;
  const equipoActivo = (cfg.data?.equipo ?? []).filter((e) => e.activo).length;

  const tarjetas: {
    a: string;
    titulo: string;
    texto: string;
    icono: ReactNode;
    aviso?: ReactNode;
  }[] = [
    {
      a: '/admin/usuarios',
      titulo: 'Usuarios',
      texto: 'Crear, editar, asignar puntos y resetear contraseñas.',
      icono: <Users />,
      aviso: cfg.data ? <Chip>{equipoActivo} activos</Chip> : undefined,
    },
    {
      a: '/admin/puntos',
      titulo: 'Puntos de venta',
      texto: 'Datos, portafolio, radio y ubicación GPS de cada punto.',
      icono: <Store />,
      aviso: sinUbicacion ? <Chip tono="aviso">! {sinUbicacion} sin ubicación</Chip> : undefined,
    },
    {
      a: '/admin/productos',
      titulo: 'Catálogo',
      texto: 'Referencias, unidad de medida y peso por unidad.',
      icono: <Package />,
      aviso: undSinPeso ? <Chip tono="aviso">! {undSinPeso} und sin peso</Chip> : undefined,
    },
    {
      a: '/admin/config',
      titulo: 'Metas y riesgo',
      texto: 'Metas de los indicadores, umbrales de vencimiento, marcas y tipos de novedad.',
      icono: <Settings2 />,
    },
    {
      a: '/admin/auditoria',
      titulo: 'Auditoría',
      texto: 'Todo lo que pasa en la app: quién, qué, cuándo y desde dónde.',
      icono: <ScrollText />,
    },
    {
      a: '/novedades',
      titulo: 'Galería de novedades',
      texto: 'Fotos de producto con novedad, por punto y tipo.',
      icono: <Images />,
    },
    {
      a: '/tablero',
      titulo: 'Tablero',
      texto: 'Indicadores del equipo, riesgo de vencimiento y check-ins.',
      icono: <BarChart3 />,
    },
  ];

  const descargarBackup = async () => {
    setDescargando(true);
    try {
      await descargar('/admin/backup.xlsx', `mercaimpulso-backup-${hoyBogota()}.xlsx`);
      toast.success('Backup descargado', {
        description: 'Guárdalo en un lugar seguro (por ejemplo, tu Drive).',
      });
      setConfirmar(false);
    } catch (e) {
      toast.error('No se pudo descargar el backup', { description: mensajeError(e) });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Pagina>
      <Encabezado
        titulo="Administración"
        subtitulo="Configura la app y revisa lo que pasa en el equipo"
      />

      {/* Backup destacado */}
      <section className="flex flex-col gap-4 rounded-xl2 bg-gradient-to-br from-marca-600 to-marca-800 p-5 text-white shadow-tarjeta sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"
            aria-hidden
          >
            <DatabaseBackup className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Copia de seguridad</h2>
            <p className="text-sm text-white/85">
              Un archivo Excel con toda la información de la app, cada tabla en su hoja.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Boton
            variante="secundario"
            className="border-white/0 bg-white text-marca-700 hover:bg-marca-50"
            icono={<DatabaseBackup className="h-5 w-5" />}
            onClick={() => setConfirmar(true)}
          >
            Descargar backup Excel
          </Boton>
          <span className="rounded-full bg-white">
            <AyudaEnLinea tema="admin.backup" etiqueta="Ayuda sobre el backup" />
          </span>
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map((t, i) => (
          <motion.li
            key={t.a}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={t.a}
              className="group flex h-full items-start gap-4 rounded-xl2 bg-white p-5 shadow-tarjeta ring-1 ring-transparent transition hover:-translate-y-0.5 hover:ring-marca-600/20"
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-marca-50 text-marca-600 [&>svg]:h-6 [&>svg]:w-6"
                aria-hidden
              >
                {t.icono}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold text-tinta">{t.titulo}</span>
                  <ChevronRight
                    className="h-5 w-5 text-tinta-tenue transition group-hover:translate-x-0.5 group-hover:text-marca-600"
                    aria-hidden
                  />
                </span>
                <span className="mt-0.5 block text-sm text-tinta-suave">{t.texto}</span>
                {t.aviso && <span className="mt-2 block">{t.aviso}</span>}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>

      <Confirmar
        abierta={confirmar}
        titulo="Descargar backup Excel"
        textoConfirmar="Descargar ahora"
        cargando={descargando}
        onConfirmar={descargarBackup}
        onCerrar={() => !descargando && setConfirmar(false)}
      >
        <p>
          Se descargará un archivo{' '}
          <b className="text-tinta">mercaimpulso-backup-{hoyBogota()}.xlsx</b> con estas hojas:
        </p>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {HOJAS_BACKUP.map((h) => (
            <li key={h} className="flex items-center gap-2 text-sm text-tinta">
              <span className="text-ok" aria-hidden>
                ✓
              </span>
              {h}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Contiene datos personales del equipo: guárdalo en un lugar seguro y no lo compartas. Las
          contraseñas <b className="text-tinta">no</b> se incluyen. La descarga queda registrada en
          la auditoría.
        </p>
        {descargando && (
          <p className="text-sm text-tinta-tenue">
            Preparando el archivo… puede tardar unos segundos.
          </p>
        )}
      </Confirmar>
    </Pagina>
  );
}
