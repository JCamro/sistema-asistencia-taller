import { memo } from 'react';
import { useLocation, Link } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  abierto: boolean;
  onToggle: () => void;
}

/* ------------------------------------------------------------------ */
/*  SVG icon components                                                */
/* ------------------------------------------------------------------ */

const IconDashboard = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconHorarios = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
  </svg>
);

const IconAsistencias = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);

const IconAlumnos = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconNotas = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconHorasTrabajadas = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconPagos = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <line x1="2" y1="9" x2="7" y2="9" />
    <line x1="17" y1="15" x2="22" y2="15" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Navigation items                                                    */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/horarios', label: 'Horarios', icon: IconHorarios },
  { to: '/asistencias', label: 'Asistencias', icon: IconAsistencias },
  { to: '/alumnos', label: 'Alumnos', icon: IconAlumnos },
  { to: '/notas', label: 'Notas', icon: IconNotas },
  { to: '/horas-trabajadas', label: 'Horas Trabajadas', icon: IconHorasTrabajadas },
  { to: '/pagos', label: 'Pagos', icon: IconPagos },
] as const;

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #e2e8f0',
  },
  logoText: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0.75rem 0.5rem',
    gap: '0.125rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#64748b',
    textDecoration: 'none',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    minHeight: '44px',
  },
  navItemActive: {
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    fontWeight: 600,
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Sidebar = memo(function Sidebar({ abierto, onToggle }: SidebarProps) {
  const location = useLocation();

  const isActive = (to: string): boolean => {
    if (to === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(to);
  };

  const handleLinkClick = (): void => {
    if (window.innerWidth <= 768) {
      onToggle();
    }
  };

  return (
    <>
      {/* Overlay — only visible on mobile when sidebar is open */}
      {abierto && (
        <div
          className="pd-sidebar-overlay"
          onClick={onToggle}
          role="presentation"
        />
      )}

      <aside className={`pd-sidebar${abierto ? ' pd-sidebar-open' : ''}`}>
        {/* Logo / branding */}
        <div style={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#3b82f6">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" stroke="#fff" strokeWidth="2" fill="none" />
          </svg>
          <span style={styles.logoText}>Portal Docente</span>
        </div>

        {/* Navigation */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleLinkClick}
              style={{
                ...styles.navItem,
                ...(isActive(item.to) ? styles.navItemActive : {}),
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
});

export default Sidebar;
