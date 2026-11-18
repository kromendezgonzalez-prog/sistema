import {
  CambiarPasswordSchema,
  LoginInputSchema,
  type AuthResponse,
} from '@merca/shared';
import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { esTest } from '../config/env.js';
import { autenticar } from '../middleware/auth.js';
import { validarBody } from '../middleware/validar.js';
import { Usuario } from '../models/index.js';
import { auditar } from '../services/auditoria.js';
import { turnstileActivo, verificarTurnstile } from '../services/turnstile.js';
import { HttpError, ah, invalido, noAutenticado } from '../utils/errores.js';
import { compararFalso, hashPassword, verificarPassword } from '../utils/password.js';
import {
  COOKIE_RT,
  borrarCookieRefresh,
  firmarAccess,
  firmarRefresh,
  ponerCookieRefresh,
  verificarRefresh,
} from '../utils/tokens.js';
import { usuarioPublico } from '../utils/usuarios.js';

export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

const router = Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: esTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de ingreso desde esta conexión. Espera 15 minutos e intenta de nuevo.',
    codigo: 'BLOQUEADO',
  },
});

type UsuarioDocLike = Parameters<typeof usuarioPublico>[0] & { tokenVersion?: number | null };

/** Emite access + refresh (cookie) y responde AuthResponse. */
function emitirSesion(res: Response, u: UsuarioDocLike) {
  const accessToken = firmarAccess({ sub: String(u._id), rol: u.rol, nombre: u.nombre });
  ponerCookieRefresh(res, firmarRefresh({ sub: String(u._id), tv: u.tokenVersion ?? 0 }));
  const body: AuthResponse = { accessToken, usuario: usuarioPublico(u) };
  res.json(body);
}

const minutosRestantes = (hasta: Date) => Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));

/* POST /auth/login */
router.post(
  '/login',
  limiteLogin,
  ah(async (req, res) => {
    const turnstileToken = typeof req.body?.turnstileToken === 'string' ? req.body.turnstileToken : '';
    const r = LoginInputSchema.safeParse(req.body ?? {});
    if (!r.success) throw invalido('Escribe tu usuario y tu contraseña.');
    const { usuario, password } = r.data;

    if (turnstileActivo()) {
      if (!turnstileToken || !(await verificarTurnstile(turnstileToken, req.ip)))
        throw invalido('No pudimos verificar que eres una persona. Recarga la página e intenta de nuevo.');
    }

    const u = await Usuario.findOne({ usuario });
    if (!u) {
      await compararFalso(password);
      await auditar(req, {
        accion: 'LOGIN_FALLIDO',
        entidad: 'usuario',
        entidadId: null,
        resumen: `Intento de ingreso con usuario inexistente "${usuario}"`,
        usuario: { _id: null, nombre: usuario, rol: null },
      });
      throw noAutenticado('Usuario o contraseña incorrectos.');
    }
    const quien = { _id: u._id, nombre: u.nombre, rol: u.rol };

    if (u.bloqueadoHasta && u.bloqueadoHasta > new Date()) {
      throw new HttpError(
        423,
        `Tu usuario está bloqueado por varios intentos fallidos. Intenta de nuevo en ${minutosRestantes(u.bloqueadoHasta)} minuto(s) o pide a la administradora que restablezca tu contraseña.`,
        'BLOQUEADO',
      );
    }

    const ok = await verificarPassword(password, u.passwordHash);
    if (!ok) {
      u.intentosFallidos = (u.intentosFallidos ?? 0) + 1;
      if (u.intentosFallidos >= MAX_INTENTOS) {
        u.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MS);
        u.intentosFallidos = 0;
        await u.save();
        await auditar(req, {
          accion: 'BLOQUEO',
          entidad: 'usuario',
          entidadId: u._id,
          resumen: `Usuario "${u.usuario}" bloqueado 15 minutos por ${MAX_INTENTOS} intentos fallidos`,
          usuario: quien,
        });
        throw new HttpError(
          423,
          'Tu usuario quedó bloqueado 15 minutos por varios intentos fallidos. Si olvidaste tu contraseña, pide a la administradora que la restablezca.',
          'BLOQUEADO',
        );
      }
      await u.save();
      await auditar(req, {
        accion: 'LOGIN_FALLIDO',
        entidad: 'usuario',
        entidadId: u._id,
        resumen: `Contraseña incorrecta para "${u.usuario}" (intento ${u.intentosFallidos} de ${MAX_INTENTOS})`,
        usuario: quien,
      });
      throw noAutenticado('Usuario o contraseña incorrectos.');
    }

    if (!u.activo) {
      throw new HttpError(
        403,
        'Tu usuario está desactivado. Habla con la administradora para reactivarlo.',
        'SIN_PERMISO',
      );
    }

    u.intentosFallidos = 0;
    u.bloqueadoHasta = null;
    u.ultimoAcceso = new Date();
    await u.save();
    await auditar(req, {
      accion: 'LOGIN_OK',
      entidad: 'usuario',
      entidadId: u._id,
      resumen: `Ingresó "${u.usuario}"`,
      usuario: quien,
    });
    emitirSesion(res, u.toObject() as UsuarioDocLike);
  }),
);

/* POST /auth/refresh */
router.post(
  '/refresh',
  ah(async (req, res) => {
    const token = req.cookies?.[COOKIE_RT] as string | undefined;
    const fallar = () => {
      borrarCookieRefresh(res);
      return noAutenticado('Tu sesión terminó. Vuelve a ingresar.');
    };
    if (!token) throw fallar();
    let p: { sub: string; tv: number };
    try {
      p = verificarRefresh(token);
    } catch {
      throw fallar();
    }
    const u = await Usuario.findById(p.sub).lean();
    if (!u || !u.activo || (u.tokenVersion ?? 0) !== p.tv) throw fallar();
    emitirSesion(res, u as UsuarioDocLike);
  }),
);

/* POST /auth/logout (no exige access token: puede estar vencido) */
router.post(
  '/logout',
  ah(async (req, res) => {
    const token = req.cookies?.[COOKIE_RT] as string | undefined;
    if (token) {
      try {
        const p = verificarRefresh(token);
        const u = await Usuario.findById(p.sub).select('nombre rol usuario').lean();
        if (u)
          await auditar(req, {
            accion: 'LOGOUT',
            entidad: 'usuario',
            entidadId: String(u._id),
            resumen: `Cerró sesión "${u.usuario}"`,
            usuario: { _id: String(u._id), nombre: u.nombre, rol: u.rol },
          });
      } catch {
        /* token inválido: igual se borra la cookie */
      }
    }
    borrarCookieRefresh(res);
    res.status(204).end();
  }),
);

/* GET /auth/me */
router.get(
  '/me',
  autenticar,
  ah(async (req, res) => {
    const u = await Usuario.findById(req.usuario!._id).lean();
    if (!u) throw noAutenticado();
    res.json({ usuario: usuarioPublico(u) });
  }),
);

/* POST /auth/cambiar-password */
router.post(
  '/cambiar-password',
  autenticar,
  validarBody(CambiarPasswordSchema),
  ah(async (req, res) => {
    const { actual, nueva } = req.body as z.infer<typeof CambiarPasswordSchema>;
    const u = await Usuario.findById(req.usuario!._id);
    if (!u) throw noAutenticado();
    if (!(await verificarPassword(actual, u.passwordHash)))
      throw invalido('La contraseña actual no es correcta.', [
        { path: 'actual', message: 'La contraseña actual no es correcta.' },
      ]);
    if (actual === nueva)
      throw invalido('La nueva contraseña debe ser diferente a la actual.', [
        { path: 'nueva', message: 'Debe ser diferente a la actual.' },
      ]);
    u.passwordHash = await hashPassword(nueva);
    u.debeCambiarPassword = false;
    u.tokenVersion = (u.tokenVersion ?? 0) + 1; // cierra las otras sesiones
    await u.save();
    await auditar(req, {
      accion: 'PASSWORD_CAMBIADA',
      entidad: 'usuario',
      entidadId: u._id,
      resumen: `"${u.usuario}" cambió su contraseña`,
    });
    emitirSesion(res, u.toObject() as UsuarioDocLike);
  }),
);

export default router;
