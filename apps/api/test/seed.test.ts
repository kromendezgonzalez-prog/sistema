import { beforeAll, describe, expect, it } from 'vitest';
import { leerSeedConfig, sembrar } from '../../../scripts/seed.js';
import { ConfigModel, Pdv, Producto, Usuario } from '../src/models/index.js';
import { verificarPassword } from '../src/utils/password.js';
import { usarBaseDePruebas } from './helpers.js';

usarBaseDePruebas();

describe('scripts/seed.ts', () => {
  let datos: Awaited<ReturnType<typeof leerSeedConfig>>;
  beforeAll(async () => {
    datos = await leerSeedConfig();
  });

  it('carga catálogo, puntos, config, equipo y admin; es idempotente y no cambia contraseñas', async () => {
    const r1 = await sembrar(datos, { usuario: 'Carolina', password: 'ClaveAdmin123', nombre: 'Carolina' });
    expect(r1.productos.creados).toBe(datos.catalogo.length);
    expect(r1.pdvs.creados).toBe(datos.pdvs.length);
    expect(r1.config).toBe('creada');
    expect(r1.admin).toBe('creado');
    expect(r1.usuariosNuevos.length).toBe(datos.equipo.length);
    expect(r1.usuariosNuevos.every((u) => /^Lomus-[a-z2-9]{4}$/.test(u.passwordTemporal))).toBe(true);

    const p = await Producto.findById('33062').lean();
    expect(p).toMatchObject({ unidad: 'und', pesoKg: 0.5 });
    const pdv = await Pdv.findById('mercacentro-4').lean();
    expect(pdv).toMatchObject({ ubicacion: null, radioM: 300, portafolio: [] });
    const c = await ConfigModel.findById('general').lean();
    expect(c!.metas).toEqual({ doh: 4, merma: 0.02, osa: 0.95, sos: 0.3, conv: 0.15 });
    expect(c!.riesgoVto).toEqual({ medio: 10, critico: 7, emergencia: 5 });
    expect(c!.novedadesProducto).toContain('Vacío perdido');
    const kena = await Usuario.findById('kena').lean();
    expect(kena).toMatchObject({ usuario: 'kena', rol: 'impulsadora', debeCambiarPassword: true });
    expect(kena!.pdvIds).toContain('mercacentro-4');
    const hashKena = kena!.passwordHash;
    const adm = await Usuario.findOne({ usuario: 'carolina' }).lean();
    expect(adm).toMatchObject({ rol: 'admin', debeCambiarPassword: false });

    // edición desde el panel que el seed no debe pisar
    await Producto.updateOne({ _id: '33017' }, { nombre: 'PUNTA DE ANCA (editado)' });

    const r2 = await sembrar(datos, { usuario: 'carolina', password: 'OtraClave999' });
    expect(r2.productos.creados).toBe(0);
    expect(r2.pdvs.creados).toBe(0);
    expect(r2.config).toBe('existente');
    expect(r2.admin).toBe('existente');
    expect(r2.usuariosNuevos).toEqual([]);
    expect(await Producto.countDocuments()).toBe(datos.catalogo.length);
    expect(await Usuario.countDocuments()).toBe(datos.equipo.length + 1);
    expect((await Producto.findById('33017').lean())!.nombre).toBe('PUNTA DE ANCA (editado)');
    expect((await Usuario.findById('kena').lean())!.passwordHash).toBe(hashKena);
    const adm2 = await Usuario.findOne({ usuario: 'carolina' }).lean();
    expect(await verificarPassword('ClaveAdmin123', adm2!.passwordHash)).toBe(true);
  });
});
