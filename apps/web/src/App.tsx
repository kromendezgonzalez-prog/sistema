import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Protegida } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { Cargando } from '@/components/ui';

/* ── Campo (agente Frontend-Campo) ── */
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const CambiarPasswordPage = lazy(() => import('@/features/auth/CambiarPasswordPage'));
const InicioPage = lazy(() => import('@/features/campo/InicioPage'));
const RegistrarPage = lazy(() => import('@/features/campo/RegistrarPage'));
const MisRegistrosPage = lazy(() => import('@/features/campo/MisRegistrosPage'));

/* ── Tablero y Admin (agente Frontend-Admin) ── */
const TableroPage = lazy(() => import('@/features/tablero/TableroPage'));
const IndicadoresPage = lazy(() => import('@/features/tablero/IndicadoresPage'));
const NovedadesPage = lazy(() => import('@/features/admin/NovedadesPage'));
const AdminInicioPage = lazy(() => import('@/features/admin/AdminInicioPage'));
const UsuariosPage = lazy(() => import('@/features/admin/UsuariosPage'));
const PuntosPage = lazy(() => import('@/features/admin/PuntosPage'));
const ProductosPage = lazy(() => import('@/features/admin/ProductosPage'));
const ConfigPage = lazy(() => import('@/features/admin/ConfigPage'));
const AuditoriaPage = lazy(() => import('@/features/admin/AuditoriaPage'));

export default function App() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/cambiar-password"
          element={
            <Protegida>
              <CambiarPasswordPage />
            </Protegida>
          }
        />
        <Route
          element={
            <Protegida>
              <AppShell />
            </Protegida>
          }
        >
          <Route
            index
            element={
              <Protegida roles={['impulsadora', 'admin']}>
                <InicioPage />
              </Protegida>
            }
          />
          <Route
            path="registrar"
            element={
              <Protegida roles={['impulsadora', 'admin']}>
                <RegistrarPage />
              </Protegida>
            }
          />
          <Route path="mis-registros" element={<MisRegistrosPage />} />
          <Route path="tablero" element={<TableroPage />} />
          <Route path="indicadores" element={<IndicadoresPage />} />
          <Route
            path="novedades"
            element={
              <Protegida roles={['admin', 'supervisor']}>
                <NovedadesPage />
              </Protegida>
            }
          />
          <Route
            path="admin"
            element={
              <Protegida roles={['admin']}>
                <AdminInicioPage />
              </Protegida>
            }
          />
          <Route path="admin/usuarios" element={<Protegida roles={['admin']}><UsuariosPage /></Protegida>} />
          <Route path="admin/puntos" element={<Protegida roles={['admin']}><PuntosPage /></Protegida>} />
          <Route path="admin/productos" element={<Protegida roles={['admin']}><ProductosPage /></Protegida>} />
          <Route path="admin/config" element={<Protegida roles={['admin']}><ConfigPage /></Protegida>} />
          <Route path="admin/auditoria" element={<Protegida roles={['admin']}><AuditoriaPage /></Protegida>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
