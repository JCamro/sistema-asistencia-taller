import { memo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { logoutApi } from '../../api/portalDocente';
import type { CicloBasic } from '../../api/portalDocente';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  ciclos: CicloBasic[];
  sidebarAbierto: boolean;
  onToggleSidebar: () => void;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#1e293b',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  cycleSelector: {
    position: 'relative',
    marginLeft: 'auto',
  },
  cycleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '44px',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    minWidth: '180px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 200,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#1e293b',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: '44px',
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    fontWeight: 600,
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '8px',
    minHeight: '44px',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s ease, background-color 0.15s ease',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Header = memo(function Header({ ciclos, sidebarAbierto, onToggleSidebar }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const cicloActual = useAuthStore((s) => s.cicloActual);
  const setCicloActual = useAuthStore((s) => s.setCicloActual);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCicloChange = (ciclo: CicloBasic): void => {
    setCicloActual({ id: ciclo.id, nombre: ciclo.nombre });
    setDropdownOpen(false);
    /* Force full reload so data refreshes with the new cycle */
    window.location.href = window.location.pathname;
  };

  const handleLogout = async (): Promise<void> => {
    try {
      if (refreshToken) {
        await logoutApi(refreshToken);
      }
    } catch {
      /* Even if the server call fails, clear local tokens */
    }
    logout();
    navigate('/login', { replace: true });
  };

  /* Generate initials from user name */
  const initials = user
    ? `${user.nombre.charAt(0).toUpperCase()}${user.apellido.charAt(0).toUpperCase()}`
    : '??';
  const fullName = user ? `${user.nombre} ${user.apellido}` : '...';

  return (
    <header className="pd-header">
      {/* Hamburger button — visible only on mobile */}
      <button
        className="pd-hamburger-btn"
        onClick={onToggleSidebar}
        aria-label={sidebarAbierto ? 'Cerrar menú' : 'Abrir menú'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidebarAbierto ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* User avatar + name */}
      <div style={styles.userInfo}>
        <div style={styles.avatar}>{initials}</div>
        <span style={styles.userName}>{fullName}</span>
      </div>

      {/* Cycle selector dropdown */}
      <div ref={dropdownRef} style={styles.cycleSelector}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          style={styles.cycleButton}
          className="touch-target"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <span>{cicloActual?.nombre ?? 'Seleccionar ciclo'}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {dropdownOpen && (
          <div style={styles.dropdown} role="listbox">
            {ciclos.length === 0 ? (
              <div style={{ ...styles.dropdownItem, color: '#94a3b8', cursor: 'default' }}>
                Sin ciclos disponibles
              </div>
            ) : (
              ciclos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCicloChange(c)}
                  style={{
                    ...styles.dropdownItem,
                    ...(cicloActual?.id === c.id ? styles.dropdownItemActive : {}),
                  }}
                  role="option"
                  aria-selected={cicloActual?.id === c.id}
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        style={styles.logoutButton}
        className="touch-target"
        title="Cerrar sesión"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="hide-mobile">Cerrar sesión</span>
      </button>
    </header>
  );
});

export default Header;
