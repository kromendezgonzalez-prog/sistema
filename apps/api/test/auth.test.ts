import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { Auditoria, Usuario } from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { PASS, app, auth, login, sembrarBasico, usarBaseDePruebas } from './helpers.js';

usarBaseDePruebas();
beforeAll(sembrarBasico);

describe('GET /health', () => {
  it('responde ok sin tocar la BD', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('CORS estricto con credenciales: solo los orígenes de CORS_ORIGIN', async () => {
    const ok = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const malo = await request(app).get('/health').set('Origin', 'https://sitio-malo.com');
    expect(malo.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('JSON mal formado → 400 en español, sin stack', async () => {
    const r = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"usuario":');
    expect(r.status).toBe(400);
    expect(r.body.codigo).toBe('VALIDACION');
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.js/);
  });

  it('404 en JSON y en español', async () => {
    const r = await request(app).get('/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.codigo).toBe('NO_ENCONTRADO');
  });
});

describe('POST /auth/login', () => {
  it('login correcto: access token, usuario público y cookie rt httpOnly en /api/v1/auth', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'ANA ', password: PASS });
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTypeOf('string');
    expect(r.body.usuario).toMatchObject({ _id: 'ana', usuario: 'ana', rol: 'impulsadora', pdvIds: ['p1'] });
    expect(r.body.usuario.passwordHash).toBeUndefined();
    const p = jwt.decode(r.body.accessToken) as Record<string, unknown>;
    expect(p).toMatchObject({ sub: 'ana', rol: 'impulsadora', nombre: 'Ana Impulsadora' });
    const ck = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('rt='))!;
    expect(ck).toMatch(/HttpOnly/i);
    expect(ck).toMatch(/Path=\/api\/v1\/auth/);
    expect(ck).toMatch(/SameSite=Lax/i);
    expect(await Auditoria.exists({ accion: 'LOGIN_OK', usuarioId: 'ana' })).toBeTruthy();
  });

  it('contraseña incorrecta → 401 y auditoría LOGIN_FALLIDO', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'bea', password: 'mala' });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/incorrectos/);
    expect(await Auditoria.exists({ accion: 'LOGIN_FALLIDO', usuarioId: 'bea' })).toBeTruthy();
    // un login correcto reinicia el contador
    await login('bea');
    expect((await Usuario.findById('bea').lean())!.intentosFallidos).toBe(0);
  });

  it('usuario inexistente → 401 con el mismo mensaje', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'nadie', password: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/incorrectos/);
  });

  it('datos vacíos → 400', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({});
    expect(r.status).toBe(400);
    expect(r.body.codigo).toBe('VALIDACION');
  });

  it('5 intentos fallidos → 423 BLOQUEADO durante 15 min (incluso con la contraseña correcta)', async () => {
    await Usuario.create({
      _id: 'bloq',
      nombre: 'Para Bloquear',
      usuario: 'bloq',
      rol: 'impulsadora',
      passwordHash: await hashPassword(PASS),
      debeCambiarPassword: false,
    });
    for (let i = 1; i <= 4; i++) {
      const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'bloq', password: 'mala' });
      expect(r.status).toBe(401);
    }
    const r5 = await request(app).post('/api/v1/auth/login').send({ usuario: 'bloq', password: 'mala' });
    expect(r5.status).toBe(423);
    expect(r5.body.codigo).toBe('BLOQUEADO');
    const ok = await request(app).post('/api/v1/auth/login').send({ usuario: 'bloq', password: PASS });
    expect(ok.status).toBe(423);
    expect(ok.body.codigo).toBe('BLOQUEADO');
    const u = await Usuario.findById('bloq').lean();
    const min = (u!.bloqueadoHasta!.getTime() - Date.now()) / 60_000;
    expect(min).toBeGreaterThan(14);
    expect(min).toBeLessThanOrEqual(15);
    expect(await Auditoria.exists({ accion: 'BLOQUEO', usuarioId: 'bloq' })).toBeTruthy();
  });

  it('usuario inactivo → 403 con mensaje claro', async () => {
    await Usuario.create({
      _id: 'inac',
      nombre: 'Inactiva',
      usuario: 'inac',
      rol: 'impulsadora',
      passwordHash: await hashPassword(PASS),
      debeCambiarPassword: false,
      activo: false,
    });
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'inac', password: PASS });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/desactivado/);
  });
});

describe('Sesión: me, refresh, logout', () => {
  it('GET /auth/me sin token → 401 NO_AUTENTICADO; token vencido → TOKEN_EXPIRADO', async () => {
    const r = await request(app).get('/api/v1/auth/me');
    expect(r.status).toBe(401);
    expect(r.body.codigo).toBe('NO_AUTENTICADO');
    const vencido = jwt.sign({ sub: 'ana', rol: 'impulsadora', nombre: 'Ana', exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET!);
    const r2 = await request(app).get('/api/v1/auth/me').set(auth(vencido));
    expect(r2.status).toBe(401);
    expect(r2.body.codigo).toBe('TOKEN_EXPIRADO');
  });

  it('refresh con cookie devuelve un nuevo access token y rota la cookie', async () => {
    const s = await login('ana');
    const me = await request(app).get('/api/v1/auth/me').set(auth(s.token));
    expect(me.status).toBe(200);
    expect(me.body.usuario.usuario).toBe('ana');

    const r = await request(app).post('/api/v1/auth/refresh').set('Cookie', s.cookie);
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTypeOf('string');
    expect(r.body.usuario._id).toBe('ana');
    expect((r.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('rt='))).toBe(true);
  });

  it('refresh sin cookie o con cookie inválida → 401', async () => {
    expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', 'rt=basura')).status).toBe(401);
  });

  it('logout → 204 y borra la cookie', async () => {
    const s = await login('ana');
    const r = await request(app).post('/api/v1/auth/logout').set('Cookie', s.cookie);
    expect(r.status).toBe(204);
    const ck = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('rt='))!;
    expect(ck).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('Cambio de contraseña', () => {
  it('debeCambiarPassword → 403 DEBE_CAMBIAR_PASSWORD salvo /auth/* y GET /config; tras cambiarla todo funciona', async () => {
    await Usuario.create({
      _id: 'nueva',
      nombre: 'Nueva Persona',
      usuario: 'nueva',
      rol: 'impulsadora',
      pdvIds: ['p1'],
      passwordHash: await hashPassword('Lomus-abcd'),
      debeCambiarPassword: true,
    });
    const s = await login('nueva', 'Lomus-abcd');
    expect(s.body.usuario.debeCambiarPassword).toBe(true);

    const reg = await request(app).get('/api/v1/registros').set(auth(s.token));
    expect(reg.status).toBe(403);
    expect(reg.body.codigo).toBe('DEBE_CAMBIAR_PASSWORD');
    const tab = await request(app).get('/api/v1/tablero').set(auth(s.token));
    expect(tab.body.codigo).toBe('DEBE_CAMBIAR_PASSWORD');

    expect((await request(app).get('/api/v1/config').set(auth(s.token))).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(auth(s.token))).status).toBe(200);

    // contraseña actual errada
    const mal = await request(app)
      .post('/api/v1/auth/cambiar-password')
      .set(auth(s.token))
      .send({ actual: 'otra', nueva: 'MiClaveNueva1' });
    expect(mal.status).toBe(400);

    // nueva muy corta
    const corta = await request(app)
      .post('/api/v1/auth/cambiar-password')
      .set(auth(s.token))
      .send({ actual: 'Lomus-abcd', nueva: '123' });
    expect(corta.status).toBe(400);
    expect(corta.body.detalle[0].path).toBe('nueva');

    const ok = await request(app)
      .post('/api/v1/auth/cambiar-password')
      .set(auth(s.token))
      .send({ actual: 'Lomus-abcd', nueva: 'MiClaveNueva1' });
    expect(ok.status).toBe(200);
    expect(ok.body.usuario.debeCambiarPassword).toBe(false);
    expect(ok.body.accessToken).toBeTypeOf('string');

    const reg2 = await request(app).get('/api/v1/registros').set(auth(ok.body.accessToken));
    expect(reg2.status).toBe(200);

    // el refresh anterior quedó invalidado (tokenVersion)
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', s.cookie)).status).toBe(401);
    // y la contraseña nueva funciona
    await login('nueva', 'MiClaveNueva1');
    expect(await Auditoria.exists({ accion: 'PASSWORD_CAMBIADA', usuarioId: 'nueva' })).toBeTruthy();
    const u = await Usuario.findById('nueva').lean();
    expect(u!.passwordHash).not.toContain('MiClaveNueva1');
  });
});

describe('GET /config', () => {
  it('devuelve config, catálogo, puntos y equipo con ETag; If-None-Match → 304', async () => {
    const s = await login('admin');
    const r = await request(app).get('/api/v1/config').set(auth(s.token));
    expect(r.status).toBe(200);
    expect(r.body.config.riesgoVto).toEqual({ medio: 10, critico: 7, emergencia: 5 });
    expect(r.body.productos.length).toBe(2);
    expect(r.body.pdvs.find((p: { _id: string }) => p._id === 'p1').ubicacion).toEqual({ lat: 4.6097, lng: -74.0817 });
    expect(r.body.equipo.length).toBeGreaterThanOrEqual(4);
    expect(r.headers.etag).toBe(`"${r.body.version}"`);
    const r2 = await request(app).get('/api/v1/config').set(auth(s.token)).set('If-None-Match', r.headers.etag);
    expect(r2.status).toBe(304);
  });

  it('la impulsadora solo se ve a sí misma en el equipo', async () => {
    const s = await login('ana');
    const r = await request(app).get('/api/v1/config').set(auth(s.token));
    expect(r.body.equipo.map((e: { _id: string }) => e._id)).toEqual(['ana']);
  });
});
