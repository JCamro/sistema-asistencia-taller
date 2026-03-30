import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

interface Ciclo {
  id: number;
  nombre: string;
  tipo: string;
  activo: boolean;
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

export function CicloProvider({ children }: { children: ReactNode }) {
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

    const fetchCiclos = fetch('/api/ciclos/', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        throw new Error('Unauthorized');
      }
      return r.json();
    });

    const fetchConfig = fetch('/api/config/', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.status === 401) {
        return { ciclo_activo: null };
      }
      return r.json();
    }).catch(() => ({ ciclo_activo: null }));

    Promise.all([fetchCiclos, fetchConfig])
    .then(([ciclosData, configData]) => {
      const results = Array.isArray(ciclosData) ? ciclosData : (ciclosData.results || []);
      setCiclos(results);
      
      let activo: Ciclo | null = null;
      const localStorageCicloId = localStorage.getItem('ciclo_activo_id');
      
      if (configData.ciclo_activo) {
        activo = results.find((c: Ciclo) => c.id === configData.ciclo_activo) || null;
      }
      
      if (!activo && localStorageCicloId) {
        activo = results.find((c: Ciclo) => c.id === parseInt(localStorageCicloId)) || null;
      }
      
      if (!activo && results.length > 0) {
        activo = results.find((c: Ciclo) => c.activo) || results[0];
      }
      
      setCicloActualState(activo);
      setIsLoading(false);
    })
    .catch((err) => {
      if (err.message === 'Unauthorized') {
        setCiclos([]);
        window.location.href = '/login';
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const setCicloActual = (ciclo: Ciclo | null) => {
    setCicloActualState(ciclo);
    
    const token = localStorage.getItem('access_token');
    if (token && ciclo) {
      fetch('/api/config/', {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ciclo_activo: ciclo.id })
      }).catch(() => {});
    }
  };

  const seleccionarCiclo = async (ciclo: Ciclo) => {
    localStorage.setItem('ciclo_activo_id', String(ciclo.id));
    setCicloActualState(ciclo);
    
    const token = localStorage.getItem('access_token');
    if (token) {
      await fetch('/api/config/', {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ciclo_activo: ciclo.id })
      });
    }
    
    window.location.href = '/dashboard';
  };

  return (
    <CicloContext.Provider value={{ cicloActual, ciclos, setCicloActual, seleccionarCiclo, recargar, isLoading }}>
      {children}
    </CicloContext.Provider>
  );
}

export function useCiclo() {
  const context = useContext(CicloContext);
  if (!context) {
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
