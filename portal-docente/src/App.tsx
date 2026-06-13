import { memo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AlumnosPage from './pages/AlumnosPage';

const ProtectedRoute = memo(function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
});

const LoginPage = memo(function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#64748b' }}>Redirigiendo al login...</p>
    </div>
  );
});

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/alumnos"
        element={
          <ProtectedRoute>
            <AlumnosPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/alumnos" replace />} />
    </Routes>
  );
}

export default memo(function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
});
