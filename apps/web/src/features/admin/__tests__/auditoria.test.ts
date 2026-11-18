import { ACCIONES_AUDITORIA } from '@merca/shared';
import { describe, expect, it } from 'vitest';
import { dispositivoLegible } from '../AuditoriaPage';
import {
  accionesPorGrupo,
  etiquetaAccion,
  INFO_ACCION,
  infoAccion,
  valorLegible,
} from '../auditoria';
import { miniaturaCloudinary } from '../comun';

describe('etiquetas de acciones de auditoría', () => {
  it('cada acción tiene etiqueta legible en español, ícono y grupo', () => {
    for (const a of ACCIONES_AUDITORIA) {
      const i = INFO_ACCION[a];
      expect(i, a).toBeDefined();
      expect(i.etiqueta.length, a).toBeGreaterThan(3);
      expect(i.etiqueta, a).not.toBe(a);
      expect(i.etiqueta, a).not.toMatch(/_/);
      expect(i.Icono, a).toBeTruthy();
    }
  });

  it('las etiquetas no se repiten', () => {
    const e = ACCIONES_AUDITORIA.map((a) => INFO_ACCION[a].etiqueta);
    expect(new Set(e).size).toBe(e.length);
  });

  it('textos clave', () => {
    expect(etiquetaAccion('LOGIN_OK')).toBe('Inicio de sesión');
    expect(etiquetaAccion('PASSWORD_RESETEADA')).toBe('Contraseña reseteada');
    expect(etiquetaAccion('GPS_FUERA_DE_RANGO')).toBe('GPS fuera de rango');
    expect(etiquetaAccion('BACKUP_EXCEL')).toBe('Descargó backup completo');
  });

  it('humaniza acciones desconocidas', () => {
    expect(infoAccion('PASSWORD_VISTA').etiqueta).toBe('Password vista');
  });

  it('el filtro agrupado incluye todas las acciones', () => {
    const todas = accionesPorGrupo().flatMap((g) => g.acciones.map((a) => a.valor));
    expect(todas.sort()).toEqual([...ACCIONES_AUDITORIA].sort());
  });
});

describe('utilidades', () => {
  it('valorLegible', () => {
    expect(valorLegible(true)).toBe('Sí');
    expect(valorLegible(null)).toBe('—');
    expect(valorLegible(['a', 'b'])).toBe('a, b');
    expect(valorLegible([])).toBe('(vacío)');
  });

  it('dispositivoLegible', () => {
    expect(
      dispositivoLegible(
        'Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      ),
    ).toBe('Android · Chrome');
    expect(dispositivoLegible(null)).toBe('—');
  });

  it('miniatura de Cloudinary', () => {
    expect(
      miniaturaCloudinary('https://res.cloudinary.com/demo/image/upload/v1/mercaimpulso/a.jpg'),
    ).toBe('https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_300/v1/mercaimpulso/a.jpg');
  });
});
