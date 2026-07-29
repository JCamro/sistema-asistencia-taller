import { useState, memo } from 'react';
import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import Sidebar from './Sidebar';
import NotificationBell from '../NotificationBell';
import NotasFAB from '../notas/NotasFAB';

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const { cicloActual } = useCiclo();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // Si no hay ciclo seleccionado, redirigir a selección
  if (!cicloActual) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Botón hamburguesa: visible solo en mobile (≤768px). Controla apertura/cierre del sidebar. */}
      <button
        onClick={() => setSidebarAbierto(!sidebarAbierto)}
        style={{
          display: 'none',
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 60,
          width: '40px',
          height: '40px',
          background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
        }}
        className="hamburger-btn"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidebarAbierto ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>
      <Sidebar cicloNombre={cicloActual.nombre} abierto={sidebarAbierto} onToggle={() => setSidebarAbierto(!sidebarAbierto)} />
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 55, display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        <NotasFAB />
        <NotificationBell />
      </div>
      <main style={{ marginLeft: '260px', padding: '1.5rem 2rem', minHeight: '100vh', boxSizing: 'border-box' }} className="main-content">
        {children}
      </main>
    </div>
  );
}

export default memo(DashboardLayout);
