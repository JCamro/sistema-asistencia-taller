import { memo } from 'react';
import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCiclo } from '../contexts/CicloContext';
import { Loading } from './ui/Loading';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute — Guard de autenticación
 *
 * Verifica que exista un token JWT en localStorage.
 * Si no hay token, redirige a /login.
 * Mientras carga el estado del ciclo (CicloProvider), muestra spinner.
 */
function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading } = useCiclo();

  if (isLoading) {
    return <Loading />;
  }

  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default memo(ProtectedRoute);
