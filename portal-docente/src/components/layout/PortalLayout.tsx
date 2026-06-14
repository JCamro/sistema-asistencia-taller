import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getMe, getCiclos } from '../../api/portalDocente';
import Sidebar from './Sidebar';
import Header from './Header';
import type { CicloBasic } from '../../api/portalDocente';

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#64748b',
    fontSize: '0.9375rem',
    backgroundColor: '#f8fafc',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PortalLayout() {
  const setUser = useAuthStore((s) => s.setUser);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [ciclos, setCiclos] = useState<CicloBasic[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    /* Fetch profile and cycles only once on mount */
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchData = async () => {
      try {
        const [userData, ciclosData] = await Promise.all([
          getMe(),
          getCiclos(),
        ]);
        setUser(userData);

        /* Auto-select first cycle if none selected */
        if (ciclosData.length > 0) {
          setCiclos(ciclosData);
        }
      } catch (err) {
        console.error('Error al cargar datos del portal:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [setUser]);

  const toggleSidebar = (): void => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = (): void => {
    setSidebarOpen(false);
  };

  if (!accessToken) return null;

  if (loading) {
    return <div style={styles.loadingContainer}>Cargando portal...</div>;
  }

  return (
    <div className="pd-layout">
      <Sidebar abierto={sidebarOpen} onToggle={closeSidebar} />
      <div className="pd-main-content">
        <Header
          ciclos={ciclos}
          sidebarAbierto={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
        <main className="pd-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
