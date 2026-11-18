import { RIESGO_DEF } from '@merca/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VistaPreviaUmbrales } from '../ConfigPage';
import { umbralesValidos, validarUmbrales } from '../umbrales';

describe('validarUmbrales', () => {
  it('acepta los valores por defecto (10 > 7 > 5)', () => {
    expect(validarUmbrales(RIESGO_DEF)).toEqual({});
    expect(umbralesValidos(RIESGO_DEF)).toBe(true);
  });

  it('acepta emergencia 0 (solo el mismo día)', () => {
    expect(validarUmbrales({ medio: 3, critico: 1, emergencia: 0 })).toEqual({});
  });

  it('exige medio > crítico', () => {
    const e = validarUmbrales({ medio: 7, critico: 7, emergencia: 5 });
    expect(e.medio).toMatch(/mayor que Crítico/);
    expect(e.general).toBe('Debe cumplirse: Medio > Crítico > Emergencia.');
  });

  it('exige crítico > emergencia', () => {
    const e = validarUmbrales({ medio: 10, critico: 4, emergencia: 5 });
    expect(e.critico).toMatch(/mayor que Emergencia/);
    expect(e.medio).toBeUndefined();
  });

  it('rechaza vacíos, decimales y fuera de rango', () => {
    expect(validarUmbrales({ medio: null, critico: 7, emergencia: 5 }).medio).toBe(
      'Escribe un número de días',
    );
    expect(validarUmbrales({ medio: 10, critico: 6.5, emergencia: 5 }).critico).toBe(
      'Debe ser un número entero de días',
    );
    expect(validarUmbrales({ medio: 91, critico: 7, emergencia: 5 }).medio).toBe(
      'Entre 1 y 90 días',
    );
    expect(validarUmbrales({ medio: 10, critico: 7, emergencia: -1 }).emergencia).toBe(
      'Entre 0 y 90 días',
    );
    expect(umbralesValidos({ medio: 5, critico: 7, emergencia: 9 })).toBe(false);
  });
});

describe('VistaPreviaUmbrales', () => {
  it('muestra cada nivel con ícono y rango de días', () => {
    render(<VistaPreviaUmbrales u={RIESGO_DEF} />);
    expect(screen.getByText('Vence en 8 a 10 días')).toBeInTheDocument();
    expect(screen.getByText('Vence en 6 a 7 días')).toBeInTheDocument();
    expect(screen.getByText('Vence hoy o en máximo 5 días')).toBeInTheDocument();
    expect(screen.getByText('Ya pasó la fecha de vencimiento')).toBeInTheDocument();
    expect(screen.getByText('Emergencia crítica – Salida:')).toBeInTheDocument();
  });

  it('pide corregir cuando los umbrales no son válidos', () => {
    render(<VistaPreviaUmbrales u={null} />);
    expect(screen.getByText(/Corrige los umbrales/)).toBeInTheDocument();
  });
});
