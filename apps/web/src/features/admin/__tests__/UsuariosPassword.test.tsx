import type { PasswordTemporalResponse, UsuarioPublico } from '@merca/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AyudaProvider } from '@/components/ayuda/Ayuda';
import { api } from '@/lib/api';
import { DialogoPassword } from '../comun/DialogoPassword';
import UsuariosPage from '../UsuariosPage';

vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    usuario: { _id: 'adm', nombre: 'Carolina Admin', rol: 'admin' },
    tieneRol: (...r: string[]) => r.includes('admin'),
  }),
}));

const base = {
  ciudad: 'Bogotá',
  pdvIds: [],
  activo: true,
  debeCambiarPassword: false,
  ultimoAcceso: null,
  bloqueadoHasta: null,
  creadoEn: '2026-11-01T00:00:00Z',
};
const ADMIN: UsuarioPublico = {
  ...base,
  _id: 'adm',
  nombre: 'Carolina Admin',
  usuario: 'carolina',
  rol: 'admin',
};
const MARIA: UsuarioPublico = {
  ...base,
  _id: 'u2',
  nombre: 'María López',
  usuario: 'maria.lopez',
  rol: 'impulsadora',
  pdvIds: ['mercacentro-4'],
};
const TEMPORAL: PasswordTemporalResponse = {
  usuario: { ...MARIA, debeCambiarPassword: true },
  passwordTemporal: 'Lomus-4821',
};

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

function montar(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AyudaProvider>{ui}</AyudaProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DialogoPassword', () => {
  it('muestra la contraseña una sola vez: al cerrar desaparece y no queda en pantalla', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    function Arnes() {
      const [d, setD] = useState<PasswordTemporalResponse | null>(TEMPORAL);
      return <DialogoPassword datos={d} motivo="creado" onCerrar={() => setD(null)} />;
    }
    render(<Arnes />);

    expect(screen.getByTestId('password-temporal')).toHaveTextContent('Lomus-4821');
    expect(screen.getByText('Solo se muestra esta vez')).toBeInTheDocument();
    expect(screen.getByText(/no se podrá ver después/)).toBeInTheDocument();
    expect(screen.getByText(/al entrar deberá\s+cambiarla/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Lomus-4821'));
    expect(await screen.findByRole('button', { name: 'Copiada' })).toBeInTheDocument();

    // Escape no la cierra por accidente
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('password-temporal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Listo, ya la entregué/ }));
    await waitFor(() => expect(screen.queryByText('Lomus-4821')).not.toBeInTheDocument());
  });
});

describe('UsuariosPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockImplementation(async (ruta: string, op?: { method?: string }) => {
      if (ruta === '/admin/usuarios' && !op?.method) return { items: [ADMIN, MARIA] };
      if (ruta === '/admin/pdvs')
        return {
          items: [
            {
              _id: 'mercacentro-4',
              nombre: 'Mercacentro 4',
              cadena: 'Mercacentro',
              ciudad: 'Bogotá',
              portafolio: [],
              ubicacion: null,
              radioM: 300,
              activo: true,
            },
          ],
        };
      if (ruta === '/admin/usuarios/u2/reset-password' && op?.method === 'POST') return TEMPORAL;
      throw new Error(`ruta no esperada ${ruta}`);
    });
  });

  it('resetear contraseña: confirma, muestra la temporal una vez y luego desaparece', async () => {
    montar(<UsuariosPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resetear contraseña de María López' }),
    );
    expect(screen.getByText('¿Resetear contraseña?')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/admin/usuarios/u2/reset-password', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: /Sí, generar contraseña temporal/ }));
    const pass = await screen.findByTestId('password-temporal');
    expect(pass).toHaveTextContent('Lomus-4821');
    expect(api).toHaveBeenCalledWith('/admin/usuarios/u2/reset-password', { method: 'POST' });

    fireEvent.click(screen.getByRole('button', { name: /Listo, ya la entregué/ }));
    await waitFor(() => expect(screen.queryByText('Lomus-4821')).not.toBeInTheDocument());
  });

  it('la admin no puede desactivarse a sí misma', async () => {
    montar(<UsuariosPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar a Carolina Admin' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('switch', { name: 'Usuario activo' })).toBeDisabled();
    expect(within(dialogo).getByText('No puedes desactivarte a ti misma.')).toBeInTheDocument();
  });

  it('muestra puntos asignados y estado de cada usuario', async () => {
    montar(<UsuariosPage />);
    const tarjeta = await screen.findByRole('article', { name: 'María López' });
    expect(await within(tarjeta).findByText('Mercacentro 4')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Nunca ha entrado')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Mercaimpulsadora')).toBeInTheDocument();
  });
});
