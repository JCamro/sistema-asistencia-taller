import { Link, useLocation } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Alumnos', href: '/alumnos', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { name: 'Profesores', href: '/profesores', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { name: 'Talleres', href: '/talleres', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { name: 'Horarios', href: '/horarios', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Matrículas', href: '/matriculas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { name: 'Asistencias', href: '/asistencias', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Recibos', href: '/recibos', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { cicloActual } = useCiclo();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('ciclo_activo_id');
    window.location.href = '/login';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#F3F4F6' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#1E1B4B', minHeight: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <span style={{ fontSize: '1.125rem', fontWeight: '700', color: 'white', display: 'block' }}>ArtAcademy</span>
              <span style={{ fontSize: '0.6875rem', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Panel</span>
            </div>
          </div>
        </div>

        {/* Ciclo Actual */}
        {cicloActual && (
          <div style={{ padding: '1rem 1.5rem', background: 'rgba(79, 70, 229, 0.2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.6875rem', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Ciclo Activo</span>
            <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'white' }}>{cicloActual.nombre}</span>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href === '/' && location.pathname === '/dashboard');
            return (
              <Link
                key={item.name}
                to={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  color: isActive ? 'white' : '#A5B4FC',
                  backgroundColor: isActive ? 'rgba(79, 70, 229, 0.3)' : 'transparent',
                  textDecoration: 'none',
                  marginBottom: '0.25rem',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#A5B4FC';
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer - Logout */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.9375rem',
              fontWeight: '500',
              color: '#A5B4FC',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#EF4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#A5B4FC';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '260px', padding: '1.5rem 2rem', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
