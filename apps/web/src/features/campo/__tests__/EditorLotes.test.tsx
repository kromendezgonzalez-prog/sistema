import type { Producto } from '@merca/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formNuevo } from '../registro/modelo';
import { useRegistro } from '../registro/store';
import { TarjetaProducto } from '../registro/TarjetaProducto';

const HOY = '2026-11-16';
const PUNTA: Producto = { _id: '33017', nombre: 'PUNTA DE ANCA DE CERDO', unidad: 'kg', pesoKg: null, activo: true };
const PAQUETE: Producto = { _id: '33100', nombre: 'CHULETA PAQUETE 500 G', unidad: 'und', pesoKg: 0.5, activo: true };

const estado = () => useRegistro.getState();
const item = (cod = PUNTA._id) => estado().form.items[cod];

function montar(producto: Producto = PUNTA) {
  return render(
    <TarjetaProducto producto={producto} abierta onAlternar={vi.fn()} onNovedad={vi.fn()} hoy={HOY} />,
  );
}

beforeEach(() => {
  act(() => estado().cargar(formNuevo({ fecha: HOY, turno: 'Mañana', pdvId: 'mercacentro-4' })));
});

describe('Editor de lotes', () => {
  it('agrega un lote con cantidad decimal (coma) y muestra el nivel de riesgo en vivo', () => {
    montar();
    const llegada = screen.getByTestId('lotes-ini');
    expect(within(llegada).getByTestId('total-ini')).toHaveTextContent('Sin registrar');

    fireEvent.click(within(llegada).getByRole('button', { name: /agregar lote/i }));
    fireEvent.change(within(llegada).getByLabelText('Peso (kg)'), { target: { value: '1,5' } });
    fireEvent.change(within(llegada).getByLabelText('Vence'), { target: { value: '2026-11-19' } });
    // 3 días → Emergencia (umbral 5)
    expect(within(llegada).getByText(/Emergencia/)).toBeInTheDocument();
    fireEvent.click(within(llegada).getByRole('button', { name: /^agregar$/i }));

    expect(item().lotesIni).toHaveLength(1);
    expect(item().lotesIni?.[0]).toMatchObject({ cantidad: 1.5, vto: '2026-11-19' });
    expect(item().lotesIni?.[0].id).toHaveLength(10);
    expect(within(llegada).getAllByTestId('fila-lote')).toHaveLength(1);
    expect(within(llegada).getByTestId('total-ini')).toHaveTextContent('1,5 kg · 1 lote');
  });

  it('pide la cantidad antes de agregar', () => {
    montar();
    const llegada = screen.getByTestId('lotes-ini');
    fireEvent.click(within(llegada).getByRole('button', { name: /agregar lote/i }));
    fireEvent.click(within(llegada).getByRole('button', { name: /^agregar$/i }));
    expect(within(llegada).getByRole('alert')).toHaveTextContent('Escribe el peso en kg.');
    expect(item()?.lotesIni).toBeUndefined();
  });

  it('copia los lotes de llegada al cierre y calcula la venta en vivo', () => {
    act(() => {
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 10, vto: '2026-12-20' });
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 5, vto: '2026-11-25' });
      estado().setItem(PUNTA._id, { rec: 2 });
    });
    montar();
    expect(screen.getByTestId('venta-en-vivo')).toHaveTextContent('Venta: –');

    const cierre = screen.getByTestId('lotes-fin');
    fireEvent.click(within(cierre).getByRole('button', { name: /copiar lotes de llegada/i }));
    const fin = item().lotesFin!;
    expect(fin).toHaveLength(2);
    expect(fin.map((l) => l.cantidad)).toEqual([10, 5]);
    // ids nuevos (no se comparten con la llegada)
    expect(fin[0].id).not.toBe(item().lotesIni![0].id);
    // venta = 15 + 2 − 15 − 0
    expect(screen.getByTestId('venta-en-vivo')).toHaveTextContent('Venta: 2 kg');

    // se vendieron 3 kg del primer lote
    fireEvent.change(within(cierre).getByLabelText('Cantidad del lote 1 (kg)'), { target: { value: '7' } });
    expect(item().lotesFin![0].cantidad).toBe(7);
    expect(screen.getByTestId('venta-en-vivo')).toHaveTextContent('Venta: 5 kg');
  });

  it('quita un lote', () => {
    act(() => {
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 1.2, vto: '2026-11-20' });
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 1.4, vto: '2026-11-20' });
    });
    montar();
    const llegada = screen.getByTestId('lotes-ini');
    fireEvent.click(within(llegada).getByRole('button', { name: 'Quitar lote 1' }));
    expect(item().lotesIni).toHaveLength(1);
    expect(item().lotesIni![0].cantidad).toBe(1.4);
  });

  it('"No quedó (0)" deja el cierre en cero (distinto de sin registrar)', () => {
    act(() => estado().agregarLote(PUNTA._id, 'ini', { cantidad: 4, vto: '2026-12-01' }));
    montar();
    fireEvent.click(within(screen.getByTestId('lotes-fin')).getByRole('button', { name: /no quedó/i }));
    expect(item().lotesFin).toEqual([]);
    expect(screen.getByTestId('venta-en-vivo')).toHaveTextContent('Venta: 4 kg');
  });

  it('muestra el chip de nivel de cada lote (vencido, medio, sin riesgo)', () => {
    act(() => {
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 1, vto: '2026-11-14' });
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 1, vto: '2026-11-25' });
      estado().agregarLote(PUNTA._id, 'ini', { cantidad: 1, vto: '2026-12-30' });
    });
    montar();
    const filas = within(screen.getByTestId('lotes-ini')).getAllByTestId('fila-lote');
    expect(filas[0]).toHaveTextContent('Vencido');
    expect(filas[1]).toHaveTextContent('Medio');
    expect(filas[2]).toHaveTextContent('OK');
    // alerta de lote vencido en rojo
    expect(screen.getAllByRole('alert').some((a) => /vencido hace 2/.test(a.textContent ?? ''))).toBe(true);
  });

  it('paquetes: cuenta unidades enteras', () => {
    montar(PAQUETE);
    const llegada = screen.getByTestId('lotes-ini');
    fireEvent.click(within(llegada).getByRole('button', { name: /agregar lote/i }));
    fireEvent.change(within(llegada).getByLabelText('Unidades'), { target: { value: '8' } });
    fireEvent.change(within(llegada).getByLabelText('Vence'), { target: { value: '2026-11-25' } });
    fireEvent.click(within(llegada).getByRole('button', { name: /^agregar$/i }));
    // la fecha se conserva para el siguiente lote
    expect(within(llegada).getByLabelText('Vence')).toHaveValue('2026-11-25');
    fireEvent.change(within(llegada).getByLabelText('Unidades'), { target: { value: '4' } });
    fireEvent.change(within(llegada).getByLabelText('Vence'), { target: { value: '2026-11-28' } });
    fireEvent.click(within(llegada).getByRole('button', { name: /^agregar$/i }));
    expect(item(PAQUETE._id).lotesIni?.map((l) => [l.cantidad, l.vto])).toEqual([
      [8, '2026-11-25'],
      [4, '2026-11-28'],
    ]);
    expect(within(llegada).getByTestId('total-ini')).toHaveTextContent('12 und · 2 lotes');
  });
});
