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
      setIsLoading(false);
      return;
    }

    Promise.all([
      fetch('/api/ciclos/', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()),
      fetch('/api/config/', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ ciclo_activo: null }))
    ])
    .then(([ciclosData, configData]) => {
      const results = ciclosData.results || ciclosData;
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
    .catch(() => {
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
