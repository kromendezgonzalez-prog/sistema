import { GeoInputSchema, RegistroInputSchema, type Pdv } from '@merca/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AyudaProvider } from '@/components/ayuda/Ayuda';
import { obtenerUbicacion } from '@/lib/geo';
import { CheckinGps } from '../registro/CheckinGps';
import { analizar, bloqueos, construirInput, formNuevo } from '../registro/modelo';

const PDV: Pdv = {
  _id: 'mercacentro-4',
  nombre: 'Mercacentro 4',
  cadena: 'Mercacentro',
  ciudad: 'Ibagué',
  portafolio: [],
  ubicacion: { lat: 4.4389, lng: -75.2322 },
  radioM: 300,
  activo: true,
};

type Exito = (p: GeolocationPosition) => void;
type Fallo = (e: { code: number }) => void;

function mockGeo(impl: (ok: Exito, err: Fallo, opts?: PositionOptions) => void) {
  const getCurrentPosition = vi.fn(impl);
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

const posicion = (lat: number, lng: number, accuracy = 12) =>
  ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.now() }) as unknown as GeolocationPosition;

function montar(onGeo = vi.fn(), pdv: Pdv = PDV) {
  render(
    <AyudaProvider>
      <CheckinGps pdv={pdv} geo={null} onGeo={onGeo} />
    </AyudaProvider>,
  );
  return onGeo;
}

afterEach(() => vi.restoreAllMocks());

describe('Check-in GPS', () => {
  it('permiso denegado: muestra instrucciones, reintentar y NO entrega ubicación', async () => {
    mockGeo((_ok, err) => err({ code: 1 }));
    const onGeo = montar();
    fireEvent.click(screen.getByRole('button', { name: /tomar mi ubicación/i }));
    expect(await screen.findByText('La app no tiene permiso para ver tu ubicación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ya lo activé, reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Android' })).toBeInTheDocument();
    expect(onGeo).not.toHaveBeenCalled();
  });

  it('GPS apagado: pide activarlo y no deja continuar', async () => {
    mockGeo((_ok, err) => err({ code: 2 }));
    const onGeo = montar();
    fireEvent.click(screen.getByRole('button', { name: /tomar mi ubicación/i }));
    expect(await screen.findByText('No encontramos señal de GPS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reintentar$/i })).toBeInTheDocument();
    expect(onGeo).not.toHaveBeenCalled();
  });

  it('dentro del radio: entrega una ubicación válida para el esquema', async () => {
    mockGeo((ok) => ok(posicion(4.4392, -75.2321)));
    const onGeo = montar();
    fireEvent.click(screen.getByRole('button', { name: /tomar mi ubicación/i }));
    await waitFor(() => expect(onGeo).toHaveBeenCalledTimes(1));
    const g = onGeo.mock.calls[0][0];
    expect(GeoInputSchema.safeParse(g).success).toBe(true);
    expect(g).toMatchObject({ lat: 4.4392, lng: -75.2321, precisionM: 12 });
  });

  it('fuera de rango: avisa la distancia pero permite continuar', async () => {
    const onGeo = vi.fn();
    const pos = { lat: 4.4489, lng: -75.2322, precisionM: 10, capturadoEn: new Date().toISOString() };
    render(
      <AyudaProvider>
        <CheckinGps pdv={PDV} geo={pos} onGeo={onGeo} />
      </AyudaProvider>,
    );
    expect(screen.getByText('! Fuera de rango')).toBeInTheDocument();
    expect(screen.getByText(/Estás a 1,1 km del punto/)).toBeInTheDocument();
    expect(screen.getByText(/fuera de rango”/)).toBeInTheDocument();
  });

  it('punto sin ubicación fijada: mensaje neutro', () => {
    const pos = { lat: 4.4, lng: -75.2, precisionM: 20, capturadoEn: new Date().toISOString() };
    render(
      <AyudaProvider>
        <CheckinGps pdv={{ ...PDV, ubicacion: null }} geo={pos} onGeo={vi.fn()} />
      </AyudaProvider>,
    );
    expect(screen.getByText(/aún no tiene su ubicación fijada/)).toBeInTheDocument();
  });

  it('si el GPS se demora, reintenta con baja precisión', async () => {
    let n = 0;
    const fn = mockGeo((ok, err) => (n++ === 0 ? err({ code: 3 }) : ok(posicion(4.43, -75.23, 80))));
    const g = await obtenerUbicacion({ timeoutMs: 100 });
    expect(g.precisionM).toBe(80);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true });
    expect(fn.mock.calls[1][2]).toMatchObject({ enableHighAccuracy: false });
  });
});

describe('GPS obligatorio para día laboral', () => {
  const base = () => {
    const f = formNuevo({ fecha: '2026-11-16', turno: 'Mañana', pdvId: PDV._id });
    f.items = { '33017': { agot: false, lotesIni: [{ id: 'a', cantidad: 2, vto: '2026-12-01', novedad: null }] } };
    return f;
  };
  const ctx = { productos: {}, hoy: '2026-11-16', pdv: PDV };

  it('sin geo: bloquea guardar y el esquema lo rechaza', () => {
    const f = base();
    expect(bloqueos(f, analizar(f, ctx))).toContain('Falta tu ubicación (GPS). Es obligatoria para un día laboral.');
    const r = RegistroInputSchema.safeParse(construirInput(f));
    expect(r.success).toBe(false);
  });

  it('con geo: se puede guardar', () => {
    const f = { ...base(), geo: { lat: 4.4389, lng: -75.2322, precisionM: 9, capturadoEn: new Date().toISOString() } };
    expect(bloqueos(f, analizar(f, ctx))).toEqual([]);
    expect(RegistroInputSchema.safeParse(construirInput(f)).success).toBe(true);
  });

  it('día no laboral: no pide GPS ni inventario', () => {
    const f = { ...base(), tipoDia: 'Descanso' as const, obs: 'Día de descanso' };
    expect(bloqueos(f, analizar(f, ctx))).toEqual([]);
    const input = construirInput(f);
    expect(input.geo).toBeNull();
    expect(input.items).toEqual({});
    expect(RegistroInputSchema.safeParse(input).success).toBe(true);
  });
});
