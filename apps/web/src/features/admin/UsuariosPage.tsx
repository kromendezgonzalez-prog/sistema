import {
  ROLES,
  UsuarioCrearSchema,
  type PasswordTemporalResponse,
  type Rol,
  type UsuarioPublico,
} from '@merca/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, KeyRound, Lock, MapPin, Pencil, UserPlus, Users } from 'lucide-react';
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
import { useAuth } from '@/lib/auth';
import { fechaHora } from '@/lib/formato';
import {
  Buscador,
  Confirmar,
  ErrorCarga,
  EsqueletoLista,
  Interruptor,
  normalizar,
  Pagina,
  plural,
} from './comun';
import { DialogoPassword } from './comun/DialogoPassword';
import { SelectorMultiple } from './comun/SelectorMultiple';
import {
  CLAVES,
  erroresZod,
  iniciales,
  ROL_TEXTO,
  sugerirUsuario,
  usePdvsAdmin,
  useUsuariosAdmin,
} from './datos';

const FILTRO_ROL = ['Todos', ...ROLES.map((r) => ROL_TEXTO[r])] as const;
const FILTRO_ESTADO = ['Activos', 'Inactivos', 'Todos'] as const;

interface Formulario {
  nombre: string;
  usuario: string;
  rol: Rol;
  ciudad: string;
  pdvIds: string[];
  activo: boolean;
}
const VACIO: Formulario = {
  nombre: '',
  usuario: '',
  rol: 'impulsadora',
  ciudad: '',
  pdvIds: [],
  activo: true,
};

export default function UsuariosPage() {
  useTemaAyuda('admin.usuarios');
  const { usuario: yo } = useAuth();
  const qc = useQueryClient();
  const usuarios = useUsuariosAdmin();
  const pdvs = usePdvsAdmin();

  const [q, setQ] = useState('');
  const [rolF, setRolF] = useState<(typeof FILTRO_ROL)[number]>('Todos');
  const [estadoF, setEstadoF] = useState<(typeof FILTRO_ESTADO)[number]>('Activos');
  const [editando, setEditando] = useState<UsuarioPublico | 'nuevo' | null>(null);
  const [resetear, setResetear] = useState<UsuarioPublico | null>(null);
  const [temporal, setTemporal] = useState<{
    datos: PasswordTemporalResponse;
    motivo: 'creado' | 'reseteada';
  } | null>(null);

  const nombrePdv = useMemo(
    () => new Map((pdvs.data ?? []).map((p) => [p._id, p.nombre])),
    [pdvs.data],
  );

  const lista = useMemo(() => {
    const n = normalizar(q);
    return (usuarios.data ?? [])
      .filter((u) => rolF === 'Todos' || ROL_TEXTO[u.rol] === rolF)
      .filter((u) => estadoF === 'Todos' || (estadoF === 'Activos' ? u.activo : !u.activo))
      .filter((u) => !n || normalizar(`${u.nombre} ${u.usuario} ${u.ciudad}`).includes(n))
      .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
  }, [usuarios.data, q, rolF, estadoF]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: CLAVES.usuarios });
    qc.invalidateQueries({ queryKey: ['config'] });
  };

  const reset = useMutation({
    mutationFn: (u: UsuarioPublico) =>
      api<PasswordTemporalResponse>(`/admin/usuarios/${encodeURIComponent(u._id)}/reset-password`, {
        method: 'POST',
      }),
    onSuccess: (r) => {
      setResetear(null);
      setTemporal({ datos: r, motivo: 'reseteada' });
      invalidar();
    },
    onError: (e) =>
      toast.error('No se pudo resetear la contraseña', { description: mensajeError(e) }),
  });

  return (
    <Pagina>
      <Encabezado
        titulo="Usuarios"
        subtitulo={
          usuarios.data
            ? plural(
                usuarios.data.filter((u) => u.activo).length,
                'usuario activo',
                'usuarios activos',
              )
            : 'Equipo con acceso a la app'
        }
        accion={
          <Boton onClick={() => setEditando('nuevo')} icono={<UserPlus className="h-5 w-5" />}>
            <span className="hidden sm:inline">Nuevo usuario</span>
            <span className="sm:hidden">Nuevo</span>
          </Boton>
        }
      />

      <div className="tarjeta space-y-3">
        <Buscador
          valor={q}
          onChange={setQ}
          placeholder="Buscar por nombre, usuario o ciudad"
          etiqueta="Buscar usuarios"
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
          <Pildoras etiqueta="Rol" opciones={FILTRO_ROL} valor={rolF} onChange={setRolF} />
          <Pildoras
            etiqueta="Estado"
            opciones={FILTRO_ESTADO}
            valor={estadoF}
            onChange={setEstadoF}
          />
        </div>
      </div>

      {usuarios.isPending ? (
        <EsqueletoLista />
      ) : usuarios.isError ? (
        <ErrorCarga
          error={usuarios.error}
          onReintentar={() => usuarios.refetch()}
          titulo="No se pudieron cargar los usuarios"
        />
      ) : !lista.length ? (
        <div className="tarjeta">
          <Vacio
            icono={<Users className="h-12 w-12" />}
            titulo="No hay usuarios con estos filtros"
            texto="Cambia la búsqueda o los filtros."
          />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Lista de usuarios">
          <AnimatePresence initial={false}>
            {lista.map((u) => (
              <motion.li
                key={u._id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <TarjetaUsuario
                  u={u}
                  esYo={u._id === yo?._id}
                  nombrePdv={(id) => nombrePdv.get(id) ?? id}
                  onEditar={() => setEditando(u)}
                  onResetear={() => setResetear(u)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <FormUsuario
        abierto={editando !== null}
        usuario={editando === 'nuevo' ? null : editando}
        esYo={editando !== null && editando !== 'nuevo' && editando._id === yo?._id}
        pdvs={(pdvs.data ?? []).map((p) => ({
          valor: p._id,
          texto: p.nombre,
          detalle:
            [p.cadena, p.ciudad].filter(Boolean).join(' · ') + (p.activo ? '' : ' · inactivo'),
        }))}
        ciudades={[...new Set((pdvs.data ?? []).map((p) => p.ciudad).filter(Boolean))].sort()}
        onCerrar={() => setEditando(null)}
        onCreado={(r) => {
          setEditando(null);
          setTemporal({ datos: r, motivo: 'creado' });
          invalidar();
        }}
        onGuardado={() => {
          setEditando(null);
          invalidar();
        }}
      />

      <Confirmar
        abierta={!!resetear}
        titulo="¿Resetear contraseña?"
        textoConfirmar="Sí, generar contraseña temporal"
        cargando={reset.isPending}
        onConfirmar={() => resetear && reset.mutate(resetear)}
        onCerrar={() => !reset.isPending && setResetear(null)}
      >
        <p>
          Se generará una contraseña temporal nueva para{' '}
          <b className="text-tinta">{resetear?.nombre}</b> y la actual dejará de funcionar.
        </p>
        <p>
          Si estaba bloqueada por intentos fallidos, quedará desbloqueada. Al entrar, deberá cambiar
          la contraseña temporal por una propia.
        </p>
      </Confirmar>

      <DialogoPassword
        datos={temporal?.datos ?? null}
        motivo={temporal?.motivo ?? 'creado'}
        onCerrar={() => setTemporal(null)}
      />
    </Pagina>
  );
}

/* ───────── Tarjeta de usuario ───────── */

function TarjetaUsuario({
  u,
  esYo,
  nombrePdv,
  onEditar,
  onResetear,
}: {
  u: UsuarioPublico;
  esYo: boolean;
  nombrePdv: (id: string) => string;
  onEditar: () => void;
  onResetear: () => void;
}) {
  const bloqueado = !!u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();
  return (
    <article
      className={clsx('tarjeta flex h-full flex-col gap-3', !u.activo && 'opacity-70')}
      aria-label={u.nombre}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold',
            u.activo ? 'bg-marca-50 text-marca-700' : 'bg-black/5 text-tinta-tenue',
          )}
          aria-hidden
        >
          {iniciales(u.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-tinta">
            {u.nombre} {esYo && <Chip tono="marca">Tú</Chip>}
          </p>
          <p className="truncate font-mono text-sm text-tinta-suave">{u.usuario}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tono={u.rol === 'admin' ? 'marca' : 'neutro'}>{ROL_TEXTO[u.rol]}</Chip>
        {u.ciudad && <Chip>{u.ciudad}</Chip>}
        {u.activo ? <Chip tono="ok">✓ Activo</Chip> : <Chip>· Inactivo</Chip>}
        {bloqueado && (
          <Chip tono="error">
            <Lock className="h-3 w-3" aria-hidden /> Bloqueado hasta {fechaHora(u.bloqueadoHasta)}
          </Chip>
        )}
        {u.debeCambiarPassword && <Chip tono="aviso">! Debe cambiar contraseña</Chip>}
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-tinta-tenue">
            <MapPin className="h-4 w-4" aria-label="Puntos asignados" />
          </dt>
          <dd className="min-w-0 text-tinta-suave">
            {u.rol !== 'impulsadora' && !u.pdvIds.length ? (
              'No necesita puntos asignados'
            ) : u.pdvIds.length ? (
              `${u.pdvIds.slice(0, 2).map(nombrePdv).join(', ')}${u.pdvIds.length > 2 ? ` y ${u.pdvIds.length - 2} más` : ''}`
            ) : (
              <span className="font-medium text-aviso">! Sin puntos asignados</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-tinta-tenue">
            <Clock className="h-4 w-4" aria-label="Último acceso" />
          </dt>
          <dd className="text-tinta-suave">
            {u.ultimoAcceso ? `Último acceso: ${fechaHora(u.ultimoAcceso)}` : 'Nunca ha entrado'}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-black/5 pt-3">
        <Boton
          tam="sm"
          variante="secundario"
          icono={<Pencil className="h-4 w-4" />}
          onClick={onEditar}
          aria-label={`Editar a ${u.nombre}`}
        >
          Editar
        </Boton>
        <Boton
          tam="sm"
          variante="fantasma"
          icono={<KeyRound className="h-4 w-4" />}
          onClick={onResetear}
          aria-label={`Resetear contraseña de ${u.nombre}`}
        >
          Resetear contraseña
        </Boton>
      </div>
    </article>
  );
}

/* ───────── Formulario crear / editar ───────── */

function FormUsuario({
  abierto,
  usuario,
  esYo,
  pdvs,
  ciudades,
  onCerrar,
  onCreado,
  onGuardado,
}: {
  abierto: boolean;
  usuario: UsuarioPublico | null;
  esYo: boolean;
  pdvs: { valor: string; texto: string; detalle?: string }[];
  ciudades: string[];
  onCerrar: () => void;
  onCreado: (r: PasswordTemporalResponse) => void;
  onGuardado: () => void;
}) {
  const [f, setF] = useState<Formulario>(VACIO);
  const [usuarioTocado, setUsuarioTocado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [abiertoPara, setAbiertoPara] = useState<string | null>(null);

  // Reinicia el formulario cada vez que se abre para otro usuario
  const llave = abierto ? (usuario?._id ?? 'nuevo') : null;
  if (llave !== abiertoPara) {
    setAbiertoPara(llave);
    if (llave) {
      setF(
        usuario
          ? {
              nombre: usuario.nombre,
              usuario: usuario.usuario,
              rol: usuario.rol,
              ciudad: usuario.ciudad,
              pdvIds: usuario.pdvIds,
              activo: usuario.activo,
            }
          : VACIO,
      );
      setUsuarioTocado(!!usuario);
      setErrores({});
    }
  }

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({ ...e, [k]: '' }));
  };

  const guardar = useMutation({
    mutationFn: async (datos: Formulario) => {
      if (!usuario)
        return {
          creado: await api<PasswordTemporalResponse>('/admin/usuarios', {
            method: 'POST',
            body: datos,
          }),
        };
      const { usuario: _u, ...resto } = datos;
      void _u;
      await api(`/admin/usuarios/${encodeURIComponent(usuario._id)}`, {
        method: 'PATCH',
        body: esYo ? { ...resto, rol: undefined, activo: undefined } : resto,
      });
      return { creado: null };
    },
    onSuccess: (r) => {
      if (r.creado) {
        toast.success('Usuario creado');
        onCreado(r.creado);
      } else {
        toast.success('Cambios guardados');
        onGuardado();
      }
    },
    onError: (e) =>
      toast.error(usuario ? 'No se pudieron guardar los cambios' : 'No se pudo crear el usuario', {
        description: mensajeError(e),
      }),
  });

  const enviar = () => {
    const datos = {
      ...f,
      nombre: f.nombre.trim(),
      usuario: f.usuario.trim().toLowerCase(),
      ciudad: f.ciudad.trim(),
    };
    const r = UsuarioCrearSchema.safeParse(datos);
    if (!r.success) {
      setErrores(erroresZod(r.error, { nombre: 'Escribe el nombre completo (mínimo 2 letras)' }));
      return;
    }
    guardar.mutate(datos);
  };

  const rolTextos = ROLES.map((r) => ROL_TEXTO[r]);
  const desactivando = !!usuario && usuario.activo && !f.activo;

  return (
    <HojaInferior
      abierta={abierto}
      onCerrar={() => !guardar.isPending && onCerrar()}
      titulo={usuario ? `Editar a ${usuario.nombre.split(' ')[0]}` : 'Nuevo usuario'}
      pie={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={enviar} cargando={guardar.isPending}>
            {usuario ? 'Guardar cambios' : 'Crear y generar contraseña'}
          </Boton>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        noValidate
      >
        <Campo
          etiqueta="Nombre completo"
          value={f.nombre}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            set('nombre', v);
            if (!usuarioTocado) setF((x) => ({ ...x, nombre: v, usuario: sugerirUsuario(v) }));
          }}
          error={errores.nombre || null}
        />
        <Campo
          etiqueta="Usuario para entrar"
          value={f.usuario}
          disabled={!!usuario}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setUsuarioTocado(true);
            set('usuario', e.target.value.toLowerCase().replace(/\s/g, ''));
          }}
          error={errores.usuario || null}
          ayuda={
            usuario
              ? 'El usuario no se puede cambiar.'
              : 'Minúsculas, sin espacios. Ej.: maria.lopez'
          }
        />

        <div>
          {esYo ? (
            <>
              <span className="etiqueta">Rol</span>
              <p className="text-sm text-tinta">
                {ROL_TEXTO[f.rol]}{' '}
                <span className="text-tinta-tenue">· no puedes cambiar tu propio rol.</span>
              </p>
            </>
          ) : (
            <Pildoras
              etiqueta="Rol"
              opciones={rolTextos}
              valor={ROL_TEXTO[f.rol]}
              onChange={(t) =>
                set(
                  'rol',
                  ROLES.find((r) => ROL_TEXTO[r] === t)!,
                )
              }
            />
          )}
          <p className="mt-1.5 text-sm text-tinta-tenue">
            {f.rol === 'impulsadora' && 'Registra conteos en sus puntos y ve solo su tablero.'}
            {f.rol === 'supervisor' &&
              'Ve el tablero de todo el equipo y la galería. No configura ni ve auditoría.'}
            {f.rol === 'admin' &&
              'Acceso total: usuarios, puntos, catálogo, metas, auditoría y backup.'}
          </p>
        </div>

        <Campo
          etiqueta="Ciudad"
          value={f.ciudad}
          list="ciudades-usuarios"
          onChange={(e) => set('ciudad', e.target.value)}
          error={errores.ciudad || null}
        />
        <datalist id="ciudades-usuarios">
          {ciudades.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <SelectorMultiple
          etiqueta="Puntos asignados"
          opciones={pdvs}
          seleccion={f.pdvIds}
          onChange={(v) => set('pdvIds', v)}
          ayuda={
            f.rol === 'impulsadora'
              ? 'Solo podrá registrar conteos en estos puntos.'
              : 'Opcional para este rol.'
          }
        />
        {errores.pdvIds && <p className="text-sm text-error">{errores.pdvIds}</p>}

        <Interruptor
          etiqueta="Usuario activo"
          activo={f.activo}
          onChange={(v) => set('activo', v)}
          disabled={esYo}
          descripcion={
            esYo
              ? 'No puedes desactivarte a ti misma.'
              : 'Si lo desactivas, no podrá entrar. Sus registros se conservan.'
          }
        />
        {desactivando && (
          <Aviso tono="aviso" titulo="Vas a desactivar este usuario">
            Al guardar, {usuario?.nombre} no podrá entrar a la app.
          </Aviso>
        )}
        {!usuario && (
          <Aviso tono="info" icono={<KeyRound className="h-5 w-5" />}>
            Al crear el usuario se genera una <b>contraseña temporal</b> que verás una sola vez.
          </Aviso>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </HojaInferior>
  );
}
