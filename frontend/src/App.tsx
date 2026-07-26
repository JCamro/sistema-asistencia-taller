import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CicloProvider } from './contexts/CicloContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import DashboardLayout from './components/layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/login/Login';
import SeleccionCiclos from './pages/ciclos/SeleccionCiclos';
import DashboardPage from './pages/dashboard/Dashboard';
import AlumnosPage from './pages/alumnos/Alumnos';
import ProfesoresPage from './pages/profesores/Profesores';
import ProfesorDetallePage from './pages/profesores/ProfesorDetalle';
import TalleresPage from './pages/talleres/Talleres';
import TallerDetalle from './pages/talleres/TallerDetalle';
import HorariosPage from './pages/horarios/Horarios';
import MatriculasPage from './pages/matriculas/Matriculas';
import MatriculaDetallePage from './pages/matriculas/MatriculaDetalle';
import AsistenciasPage from './pages/asistencias/Asistencias';
import RecibosPage from './pages/recibos/Recibos';
import FeriadosPage from './pages/feriados/Feriados';
import AlumnoDetallePage from './pages/alumnos/AlumnoDetalle';
import PagosProfesoresPage from './pages/profesores/HorasProfesores';
import EgresosPage from './pages/egresos/Egresos';
import FinanzasPage from './pages/finanzas/Finanzas';
import ConfiguracionPreciosPage from './pages/precios/ConfiguracionPrecios';
import CalculadoraPreciosPage from './pages/precios/CalculadoraPrecios';

// React Query: instancia global con staleTime de 30s, 1 retry, sin refetch al focus
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/**
 * App — Componente raíz de la aplicación
 *
 * Provee la jerarquía de contextos necesaria para toda la app:
 *   ToastProvider → BrowserRouter → CicloProvider → QueryClientProvider → ErrorBoundary → Routes
 *
 * La estructura de rutas está dividida en tres tipos de acceso:
 * - /login: público, sin ciclo requerido
 * - / (SeleccionCiclos): protegido por token, sin layout de dashboard
 * - Rutas con DashboardLayout: protegidas y con sidebar + header (requieren ciclo activo)
 */
export default function App() {
  return (
    // Proveedor de notificaciones toast — debe envolver todo para que cualquier componente pueda usarlo
    <ToastProvider>
      <BrowserRouter>
        {/* Gestión de ciclo activo: carga ciclos disponibles, mantiene el seleccionado en estado global */}
        <CicloProvider>
          {/*
           * React Query: caché de datos del servidor con staleTime de 30s.
           * Todas las páginas usan queryKeys + useQuery/useMutation para datos del backend.
           */}
          <QueryClientProvider client={queryClient}>
            {/* Error Boundary: captura errores de renderizado y muestra pantalla de fallback */}
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><SeleccionCiclos /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/alumnos" element={<ProtectedRoute><DashboardLayout><AlumnosPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/profesores" element={<ProtectedRoute><DashboardLayout><ProfesoresPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/profesores/:profesorId" element={<ProtectedRoute><DashboardLayout><ProfesorDetallePage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/talleres" element={<ProtectedRoute><DashboardLayout><TalleresPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/talleres/:tallerId" element={<ProtectedRoute><DashboardLayout><TallerDetalle /></DashboardLayout></ProtectedRoute>} />
                <Route path="/horarios" element={<ProtectedRoute><DashboardLayout><HorariosPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/matriculas" element={<ProtectedRoute><DashboardLayout><MatriculasPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/matriculas/:matriculaId" element={<ProtectedRoute><DashboardLayout><MatriculaDetallePage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/alumnos/:alumnoId" element={<ProtectedRoute><DashboardLayout><AlumnoDetallePage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/asistencias" element={<ProtectedRoute><DashboardLayout><AsistenciasPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/feriados" element={<ProtectedRoute><DashboardLayout><FeriadosPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/recibos" element={<ProtectedRoute><DashboardLayout><RecibosPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/egresos" element={<ProtectedRoute><DashboardLayout><EgresosPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/finanzas" element={<ProtectedRoute><DashboardLayout><FinanzasPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/pagos-profesores" element={<ProtectedRoute><DashboardLayout><PagosProfesoresPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/configuracion-precios" element={<ProtectedRoute><DashboardLayout><ConfiguracionPreciosPage /></DashboardLayout></ProtectedRoute>} />
                <Route path="/calculadora-precios" element={<ProtectedRoute><DashboardLayout><CalculadoraPreciosPage /></DashboardLayout></ProtectedRoute>} />
              </Routes>
            </ErrorBoundary>
          </QueryClientProvider>
        </CicloProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
