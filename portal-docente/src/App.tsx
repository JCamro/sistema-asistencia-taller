import { memo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import PortalLayout from './components/layout/PortalLayout';
import AlumnosPage from './pages/AlumnosPage';
import DashboardPage from './pages/DashboardPage';
import HorariosPage from './pages/HorariosPage';
import AsistenciasPage from './pages/AsistenciasPage';
import NotasPage from './pages/NotasPage';
import HorasTrabajadasPage from './pages/HorasTrabajadasPage';
import PagosPage from './pages/PagosPage';

/* ------------------------------------------------------------------ */
/*  ProtectedRoute — redirects to /login if no token                   */
/* ------------------------------------------------------------------ */

const ProtectedRoute = memo(function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
});

/* ------------------------------------------------------------------ */
/*  LoginPage — placeholder stub                                       */
/* ------------------------------------------------------------------ */

const LoginPage = memo(function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}
    >
      <p style={{ color: '#64748b' }}>Redirigiendo al login...</p>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — wrapped in PortalLayout (sidebar + header) */}
      <Route
        element={
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/horarios" element={<HorariosPage />} />
        <Route path="/asistencias" element={<AsistenciasPage />} />
        <Route path="/alumnos" element={<AlumnosPage />} />
        <Route path="/notas" element={<NotasPage />} />
        <Route path="/horas-trabajadas" element={<HorasTrabajadasPage />} />
        <Route path="/pagos" element={<PagosPage />} />
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export default memo(function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
});
