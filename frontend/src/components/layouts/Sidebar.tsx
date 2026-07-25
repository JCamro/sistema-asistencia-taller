import { memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { NAV_ITEMS, type NavItem } from '../../config/navigation';

interface SidebarProps {
  cicloNombre: string;
  abierto: boolean;
  onToggle: () => void;
}

function Sidebar({ cicloNombre, abierto, onToggle }: SidebarProps) {
  const { setCicloActual } = useCiclo();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleCambiarCiclo = () => {
    setCicloActual(null);
    navigate('/');
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.to;
    return (
      <Link
        to={item.to}
        onClick={() => { if (window.innerWidth < 768) onToggle(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.625rem 0.75rem',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: isActive ? '#d4af37' : '#a1a1a1',
          backgroundColor: isActive ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
          textDecoration: 'none',
          marginBottom: '0.125rem',
          transition: 'all 0.15s ease',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#d4af37' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={item.icon} />
        </svg>
        {item.label}
      </Link>
    );
  };

  // Estructura del sidebar dividida en secciones semánticas
  const secciones = [
    { titulo: 'Gestión', items: NAV_ITEMS.slice(0, 4) },      // Dashboard, Alumnos, Profesores, Talleres
    { titulo: 'Operaciones', items: NAV_ITEMS.slice(4, 7) },   // Horarios, Matrículas, Asistencias
    { titulo: 'Caja', items: NAV_ITEMS.slice(7, 9) },          // Recibos, Egresos
    { titulo: 'Nómina', items: NAV_ITEMS.slice(9, 10) },      // Horas Profesores
    { titulo: 'Resumen', items: NAV_ITEMS.slice(10, 11) },    // Finanzas
  ];

  return (
    <>
      {/* Overlay oscuro para mobile: cierra el sidebar al tocar fuera */}
      {abierto && (
        <div
          onClick={onToggle}
          className="sidebar-overlay"
        />
      )}
      <aside className={`sidebar ${abierto ? 'sidebar-open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo-taller.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#d4af37', display: 'block' }}>Taller de Música</span>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#c41e3a', display: 'block' }}>Elguera</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', background: 'linear-gradient(135deg, rgba(196, 30, 58, 0.08) 0%, rgba(212, 175, 55, 0.04) 100%)', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
          <p style={{ fontSize: '0.6875rem', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Ciclo Activo</p>
          <p style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#ffffff', marginBottom: '0.75rem' }}>{cicloNombre}</p>
          <button onClick={handleCambiarCiclo} style={{ padding: '0.5rem 0.75rem', background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', width: '100%' }}>
            ← Cambiar ciclo
          </button>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
          <style>{`
            nav::-webkit-scrollbar { width: 6px; }
            nav::-webkit-scrollbar-track { background: #1a1a1a; }
            nav::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
            nav::-webkit-scrollbar-thumb:hover { background: #555; }
            nav { scrollbar-width: thin; scrollbar-color: #444 #1a1a1a; }
          `}</style>
          {secciones.map(seccion => (
            <div key={seccion.titulo} style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.6875rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', padding: '0 0.5rem' }}>{seccion.titulo}</p>
              {seccion.items.map(item => <NavLink key={item.to} item={item} />)}
            </div>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(212, 175, 55, 0.1)' }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem 1rem', backgroundColor: 'transparent', border: '1px solid rgba(196, 30, 58, 0.2)', borderRadius: '10px', fontSize: '0.9375rem', fontWeight: '500', color: '#c41e3a', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

export default memo(Sidebar);
