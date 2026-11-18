import { hoyBogota, METAS_DEF, RIESGO_DEF, sumarDias } from '@merca/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AyudaProvider } from '@/components/ayuda/Ayuda';
import { api } from '@/lib/api';
import { construirKpis } from '../kpis';
import { fechasRango } from '../rango';
import TableroPage, { ContenidoTablero } from '../TableroPage';
import { tableroEjemplo } from './fixture';

vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn(),
  descargar: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    usuario: { _id: 'adm', nombre: 'Carolina', rol: 'admin' },
    tieneRol: (...r: string[]) => r.includes('admin'),
  }),
}));
vi.mock('@/lib/config', () => ({
  useConfig: () => ({
    data: {
      config: {
        metas: METAS_DEF,
        riesgoVto: RIESGO_DEF,
        marcasCompetencia: [],
        novedadesGenerales: [],
        novedadesProducto: [],
      },
      equipo: [
        {
          _id: 'u1',
          nombre: 'Ana Pérez',
          rol: 'impulsadora',
          ciudad: '',
          pdvIds: [],
          activo: true,
        },
      ],
      pdvs: [],
      productos: [],
      version: '1',
    },
    productosPorCod: {},
    pdvsPorId: {},
  }),
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  // Recharts (ResponsiveContainer) necesita ResizeObserver, que jsdom no trae.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function envolver(ui: ReactNode, ruta = '/tablero') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <AyudaProvider>{ui}</AyudaProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('construirKpis', () => {
  it('genera las 13 tarjetas con los semáforos del servidor', () => {
    const k = construirKpis(tableroEjemplo(), METAS_DEF);
    expect(k).toHaveLength(13);
    const por = Object.fromEntries(k.map((x) => [x.id, x]));
    expect(por.doh.estado).toBe('warn');
    expect(por.merma.estado).toBe('crit');
    expect(por.osa.estado).toBe('good');
    expect(por.fueraDeRango.estado).toBe('crit');
    expect(por.inconsistencias.estado).toBe('warn');
    expect(por.sellout.valor).toBe('250,5');
    expect(por.doh.detalle).toContain('Meta ≤ 4 días');
  });
});

describe('fechasRango', () => {
  it('calcula desde/hasta en hora Colombia', () => {
    expect(fechasRango('7', '2026-11-16')).toEqual({ desde: '2026-11-10', hasta: '2026-11-16' });
    expect(fechasRango('hoy', '2026-11-16')).toEqual({ desde: '2026-11-16', hasta: '2026-11-16' });
    expect(fechasRango('mes', '2026-11-16')).toEqual({ desde: '2026-11-01', hasta: '2026-11-16' });
  });
});

describe('ContenidoTablero', () => {
  it('muestra KPIs con semáforo (ícono + texto) y el banner de vencimiento', () => {
    envolver(
      <ContenidoTablero
        t={tableroEjemplo()}
        esEquipo
        filtroPersona={false}
        hoyEnRango
        metas={METAS_DEF}
        umbrales={RIESGO_DEF}
      />,
    );

    const doh = screen.getByTestId('kpi-doh');
    expect(within(doh).getByText('Días de inventario')).toBeInTheDocument();
    expect(within(doh).getByText(/5,2/)).toBeInTheDocument();
    expect(within(doh).getByText('Atención')).toBeInTheDocument();

    const merma = screen.getByTestId('kpi-merma');
    expect(within(merma).getByText('5 %')).toBeInTheDocument();
    expect(within(merma).getByText('Crítico')).toBeInTheDocument();

    expect(within(screen.getByTestId('kpi-osa')).getByText('En meta')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-fueraDeRango')).getByText('Crítico')).toBeInTheDocument();
    // Sell-out no tiene semáforo
    expect(
      within(screen.getByTestId('kpi-sellout')).queryByText(/En meta|Atención|Crítico/),
    ).toBeNull();

    // Banner de riesgo (1 vencido + 2 emergencia)
    expect(
      within(screen.getByTestId('banner-riesgo')).getByText(/3 lotes vencidos o en emergencia/),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('riesgo-vencido')).getByText('Vencido')).toBeInTheDocument();
    expect(within(screen.getByTestId('riesgo-emergencia')).getByText('2')).toBeInTheDocument();

    // Quién no reportó hoy
    expect(screen.getByText('Sin registro hoy')).toBeInTheDocument();
    // Acción sugerida del nivel vencido
    expect(screen.getByText('Retiro inmediato de góndola y reportar novedad.')).toBeInTheDocument();
    // Check-in fuera de rango con enlace a mapa
    expect(screen.getAllByText('✕ Fuera de rango').length).toBeGreaterThan(0);
    const mapa = screen.getAllByRole('link', { name: /Ver en mapa el check-in de Luz Gómez/ })[0];
    expect(mapa).toHaveAttribute('href', 'https://www.google.com/maps?q=4.7,-74.1');
  });

  it('muestra estado vacío cuando no hay registros', () => {
    const t = tableroEjemplo();
    envolver(
      <ContenidoTablero
        t={{
          ...t,
          resumen: { ...t.resumen, registros: 0, registrosLaborales: 0 },
          riesgo: {
            ...t.riesgo,
            porNivel: {
              vencido: { lotes: 0, kg: 0 },
              emergencia: { lotes: 0, kg: 0 },
              critico: { lotes: 0, kg: 0 },
              medio: { lotes: 0, kg: 0 },
            },
          },
        }}
        esEquipo={false}
        filtroPersona={false}
        hoyEnRango
        metas={METAS_DEF}
        umbrales={RIESGO_DEF}
      />,
    );
    expect(screen.getByText('No hay registros en este rango')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-doh')).toBeNull();
  });
});

describe('TableroPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('pide /tablero con el rango por defecto (7 días) y lo pinta', async () => {
    vi.mocked(api).mockResolvedValue(tableroEjemplo());
    envolver(<TableroPage />);
    expect(await screen.findByTestId('kpi-sellout')).toBeInTheDocument();
    const hoy = hoyBogota();
    expect(api).toHaveBeenCalledWith('/tablero', {
      query: { desde: sumarDias(hoy, -6), hasta: hoy, impulsadoraId: undefined, pdvId: undefined },
    });
    expect(screen.getByRole('button', { name: /Descargar Excel/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '7 días' })).toHaveAttribute('aria-checked', 'true');
  });

  it('lee los filtros desde la URL', async () => {
    vi.mocked(api).mockResolvedValue(tableroEjemplo());
    envolver(<TableroPage />, '/tablero?rango=30&persona=u1');
    await screen.findByTestId('kpi-sellout');
    const hoy = hoyBogota();
    expect(api).toHaveBeenCalledWith('/tablero', {
      query: { desde: sumarDias(hoy, -29), hasta: hoy, impulsadoraId: 'u1', pdvId: undefined },
    });
    expect(screen.getByText('Quitar filtros')).toBeInTheDocument();
  });

  it('muestra error con botón Reintentar', async () => {
    vi.mocked(api).mockImplementation(() => Promise.reject(new Error('Servidor caído')));
    envolver(<TableroPage />);
    expect(await screen.findByText('No se pudo cargar el tablero')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});
