import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface Ciclo {
  id: number;
  nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

interface ConfigResponse {
  ciclo_activo: number | null;
}

interface CicloContextType {
  cicloActual: Ciclo | null;
  ciclos: Ciclo[];
  setCicloActual: (ciclo: Ciclo | null) => void;
  seleccionarCiclo: (ciclo: Ciclo) => void;
  recargar: () => void;
  isLoading: boolean;
}

const CicloContext = createContext<CicloContextType | undefined>(undefined);

/**
 * Contexto y provider para la gestión del ciclo académico activo.
 * 
 * Al montar, consulta `/api/ciclos/` y `/api/config/` para determinar qué ciclo está activo.
 * Resuelve el ciclo activo con esta prioridad:
 *   1. Configuración del backend (DB)
 *   2. Fallback a localStorage (ciclo_activo_id)
 *   3. Fallback al primer ciclo con activo=true o el primer ciclo disponible
 *
 * Expone: cicloActual, ciclos (lista), setCicloActual, seleccionarCiclo (navega a /dashboard), recargar, isLoading.
 */
export function CicloProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [cicloActual, setCicloActualState] = useState<Ciclo | null>(null);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const recargar = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setCiclos([]);
      setIsLoading(false);
      return;
    }

    const fetchCiclos = api.get<Ciclo[] | { results: Ciclo[] }>('/ciclos/');
    const fetchConfig = api.get<ConfigResponse>('/config/').catch(() => ({ data: { ciclo_activo: null } }));

    Promise.all([fetchCiclos, fetchConfig])
      .then(([ciclosRes, configRes]) => {
        const ciclosData = ciclosRes.data;
        const results = Array.isArray(ciclosData) ? ciclosData : (ciclosData.results || []);
        setCiclos(results);

        let activo: Ciclo | null = null;
        // Resolución del ciclo activo: DB → localStorage → primer ciclo disponible
        const localStorageCicloId = localStorage.getItem('ciclo_activo_id');

        if (configRes.data.ciclo_activo) {
          activo = results.find((c: Ciclo) => c.id === configRes.data.ciclo_activo) || null;
        }

        // Fallback a localStorage cuando la DB no tiene ciclo activo configurado
        if (!activo && localStorageCicloId) {
          activo = results.find((c: Ciclo) => c.id === parseInt(localStorageCicloId)) || null;
        }

        if (!activo && results.length > 0) {
          activo = results.find((c: Ciclo) => c.activo) || results[0];
        }

        setCicloActualState(activo);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  // Actualiza el ciclo activo localmente y persiste en el backend (fire-and-forget)
  const setCicloActual = (ciclo: Ciclo | null) => {
    setCicloActualState(ciclo);

    if (ciclo) {
      api.patch('/config/', { ciclo_activo: ciclo.id }).catch(() => {});
    }
  };

  // Selecciona un ciclo y redirige al dashboard. Guarda en localStorage y backend.
  const seleccionarCiclo = async (ciclo: Ciclo) => {
    localStorage.setItem('ciclo_activo_id', String(ciclo.id));
    setCicloActualState(ciclo);

    await api.patch('/config/', { ciclo_activo: ciclo.id });
    navigate('/dashboard');
  };

  return (
    <CicloContext.Provider value={{ cicloActual, ciclos, setCicloActual, seleccionarCiclo, recargar, isLoading }}>
      {children}
    </CicloContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de ciclo desde cualquier componente dentro del provider.
 * Si el provider no está montado, devuelve valores por defecto seguros (sin lanzar error).
 */
export function useCiclo() {
  const context = useContext(CicloContext);
  if (!context) {
    // Safe defaults when used outside CicloProvider — prevents crashes on Login/page-refresh edge cases
    return {
      cicloActual: null,
      ciclos: [],
      setCicloActual: () => {},
      seleccionarCiclo: () => {},
      recargar: () => {},
      isLoading: false
    };
  }
  return context;
}
