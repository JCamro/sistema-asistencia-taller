import { useState, useEffect, memo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { CicloProvider, useCiclo } from './contexts/CicloContext';
import { ToastProvider } from './contexts/ToastContext';
import DashboardPage from './pages/Dashboard';
import AlumnosPage from './pages/Alumnos';
import ProfesoresPage from './pages/Profesores';
import TalleresPage from './pages/Talleres';
import TallerDetalle from './pages/TallerDetalle';
import HorariosPage from './pages/Horarios';
import MatriculasPage from './pages/Matriculas';
import AsistenciasPage from './pages/Asistencias';
import RecibosPage from './pages/Recibos';
import PagosProfesoresPage from './pages/PagosProfesores';
import EgresosPage from './pages/Egresos';
import FinanzasPage from './pages/Finanzas';
import ConfiguracionPreciosPage from './pages/ConfiguracionPrecios';
import CalculadoraPreciosPage from './pages/CalculadoraPrecios';

const Loading = memo(function Loading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid rgba(212, 175, 55, 0.2)', borderTop: '4px solid #d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

function Sidebar({ cicloNombre, abierto, onToggle }: { cicloNombre: string, abierto: boolean, onToggle: () => void }) {
  const { setCicloActual } = useCiclo();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleCambiarCiclo = () => {
    setCicloActual(null);
    window.location.href = '/';
  };

  const NavLink = ({ item }: { item: { to: string; label: string; icon: string } }) => {
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
          cursor: 'pointer' 
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#d4af37' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={item.icon} />
        </svg>
        {item.label}
      </Link>
    );
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/alumnos', label: 'Alumnos', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { to: '/profesores', label: 'Profesores', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { to: '/talleres', label: 'Talleres', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { to: '/horarios', label: 'Horarios', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/matriculas', label: 'Matrículas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { to: '/asistencias', label: 'Asistencias', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/recibos', label: 'Recibos', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z' },
    { to: '/egresos', label: 'Egresos', icon: 'M3 3h18v18H3V3zm3 9h12v6H6v-6zm3-6v4h12V6H6z' },
    { to: '/finanzas', label: 'Finanzas', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { to: '/pagos-profesores', label: 'Pagos Profesores', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const secciones = [
    { titulo: 'Gestión', items: navItems.slice(0, 4) },
    { titulo: 'Operaciones', items: navItems.slice(4, 7) },
    { titulo: 'Finanzas', items: navItems.slice(7, 11) },
  ];

  return (
    <>
      {/* Overlay for mobile */}
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

const SidebarMemo = memo(Sidebar);

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { cicloActual } = useCiclo();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  if (!cicloActual) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hamburger menu button for mobile */}
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
      <SidebarMemo cicloNombre={cicloActual.nombre} abierto={sidebarAbierto} onToggle={() => setSidebarAbierto(!sidebarAbierto)} />
      <main style={{ marginLeft: '260px', padding: '1.5rem 2rem', minHeight: '100vh', boxSizing: 'border-box' }} className="main-content">
        {children}
      </main>
    </div>
  );
}

const DashboardLayoutMemo = memo(DashboardLayout);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading } = useCiclo();
  
  if (isLoading) {
    return <Loading />;
  }
  
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      window.location.href = '/';
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL || (() => { throw new Error('VITE_API_URL no está configurado'); })();
    try {
      const res = await fetch(`${apiUrl}/api/auth/login/`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ username, password }) 
      });
      if (!res.ok) throw new Error('Invalid');
      const data = await res.json();
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      window.location.href = '/';
    } catch { 
      setError('Usuario o contraseña incorrectos'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(196, 30, 58, 0.06) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <form onSubmit={handleLogin} style={{ background: 'linear-gradient(145deg, #141414 0%, #1c1c1c 100%)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img 
            src="/logo-taller.png"
            alt="Logo Taller de Música Elguera"
            style={{ width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 1rem', objectFit: 'contain', boxShadow: '0 8px 24px rgba(212, 175, 55, 0.35)' }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d4af37', fontFamily: "'Inter', sans-serif" }}>Taller de Música</h1>
          <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#c41e3a', fontFamily: "'Inter', sans-serif" }}>Elguera</p>
        </div>
        {error && <div style={{ padding: '0.75rem', background: 'rgba(196, 30, 58, 0.15)', color: '#e63950', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(196, 30, 58, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
        <input type="text" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '0.875rem 1rem', marginBottom: '1rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', color: '#ffffff', fontSize: '1rem' }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.875rem 1rem', marginBottom: '1.25rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', color: '#ffffff', fontSize: '1rem' }} />
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.875rem', background: loading ? 'rgba(212, 175, 55, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', color: '#0a0a0a', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '1rem', boxShadow: loading ? 'none' : '0 4px 12px rgba(212, 175, 55, 0.3)' }}>{loading ? 'Cargando...' : 'Iniciar sesión'}</button>
      </form>
    </div>
  );
}

const LoginMemo = memo(Login);

function MenuOpciones({ onEditar, onEliminar }: { onEditar: () => void, onEliminar: () => void }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setAbierto(!abierto); }}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          background: '#f3f4f6',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          color: '#6b7280'
        }}
      >
        ⋮
      </button>
      {abierto && (
        <>
          <div 
            onClick={(e) => { e.stopPropagation(); setAbierto(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
          />
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '4px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb',
              minWidth: '140px',
              zIndex: 20,
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => { setAbierto(false); onEditar(); }}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => { setAbierto(false); onEliminar(); }}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              🗑️ Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const MenuOpcionesMemo = memo(MenuOpciones);

function SeleccionCiclos() {
  const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
  const { ciclos, cicloActual, seleccionarCiclo, recargar, isLoading } = useCiclo();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [mostrarConfigUsuario, setMostrarConfigUsuario] = useState(false);
  const [cicloEditando, setCicloEditando] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('anual');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  // Estado para config de usuario
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState('');

  if (isLoading) return <Loading />;

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${apiBase}/ciclos/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre, tipo, fecha_inicio: fechaInicio, fecha_fin: fechaFin, activo: true })
      });
      recargar();
      setMostrarForm(false);
      setNombre('');
      setTipo('anual');
      setFechaInicio('');
      setFechaFin('');
    } catch (error) {
      console.error('Error:', error);
    }
    setGuardando(false);
  };

  const handleEditar = (ciclo: any) => {
    setCicloEditando(ciclo);
    setNombre(ciclo.nombre);
    setTipo(ciclo.tipo);
    setFechaInicio(ciclo.fecha_inicio);
    setFechaFin(ciclo.fecha_fin);
    setActivo(ciclo.activo);
    setMostrarEditar(true);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloEditando) return;
    setGuardando(true);
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${apiBase}/ciclos/${cicloEditando.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre, tipo, fecha_inicio: fechaInicio, fecha_fin: fechaFin, activo })
      });
      recargar();
      setMostrarEditar(false);
      setCicloEditando(null);
    } catch (error) {
      console.error('Error:', error);
    }
    setGuardando(false);
  };

  const handleEliminar = async (id: number) => {
    const confirmar = window.confirm('¿Estás seguro de que deseas eliminar este ciclo? Se eliminarán todos los datos asociados (alumnos, profesores, talleres, etc.).');
    if (!confirmar) return;
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${apiBase}/ciclos/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      recargar();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const abrirFormulario = () => {
    setNombre('');
    setTipo('anual');
    setFechaInicio('');
    setFechaFin('');
    setMostrarForm(true);
  };

  const handleSeleccionar = (ciclo: any) => {
    seleccionarCiclo(ciclo);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Botón de configuración */}
      <button
        onClick={() => setMostrarConfigUsuario(true)}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          background: 'rgba(28, 28, 28, 0.8)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
        title="Configurar cuenta"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <img 
          src="/src/assets/logo-taller.png" 
          alt="Logo Taller de Música Elguera"
          style={{ width: '80px', height: '80px', borderRadius: '20px', margin: '0 auto 1.5rem', objectFit: 'contain', boxShadow: '0 8px 24px rgba(212, 175, 55, 0.35)' }}
        />
        <h1 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#d4af37', fontFamily: "'Inter', sans-serif" }}>Taller de Música Elguera</h1>
        <p style={{ fontSize: '1rem', color: '#a1a1a1', letterSpacing: '0.05em' }}>Selecciona un ciclo para continuar</p>
      </div>
      
      {(mostrarForm || mostrarEditar) && (
        <form onSubmit={mostrarEditar ? handleGuardarEdicion : handleCrear} style={{ background: '#1c1c1c', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(212, 175, 55, 0.15)', width: '100%', maxWidth: '600px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: '600', color: '#d4af37', fontFamily: "'Inter', sans-serif" }}>{mostrarEditar ? 'Editar ciclo' : 'Crear nuevo ciclo'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#a1a1a1' }}>Nombre</label>
              <input type="text" placeholder="Ej: Ciclo Anual 2026" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: '100%', padding: '0.625rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#a1a1a1' }}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', padding: '0.625rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff' }}>
                <option value="anual">Anual</option>
                <option value="verano">Verano</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#a1a1a1' }}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required style={{ width: '100%', padding: '0.625rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#a1a1a1' }}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} required style={{ width: '100%', padding: '0.625rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff' }} />
            </div>
            {mostrarEditar && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#a1a1a1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#d4af37' }} />
                  Ciclo activo
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" disabled={guardando} style={{ padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setMostrarForm(false); setMostrarEditar(false); setCicloEditando(null); }} style={{ padding: '0.625rem 1.5rem', background: 'rgba(255,255,255,0.05)', color: '#a1a1a1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      
      {ciclos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(28, 28, 28, 0.8)', borderRadius: '16px', border: '2px dashed rgba(212, 175, 55, 0.3)', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <p style={{ color: '#a1a1a1', marginBottom: '1.25rem' }}>No hay ciclos creados</p>
          <button onClick={abrirFormulario} style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)' }}>
            Crear primer ciclo
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '600px' }}>
          {ciclos.map(ciclo => (
            <div 
              key={ciclo.id}
              onClick={() => handleSeleccionar(ciclo)}
              style={{ 
                background: cicloActual?.id === ciclo.id ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(28, 28, 28, 0.9) 100%)' : '#1c1c1c', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: cicloActual?.id === ciclo.id ? '2px solid #d4af37' : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: cicloActual?.id === ciclo.id ? '0 0 24px rgba(212, 175, 55, 0.2), 0 8px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: ciclo.activo ? 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: ciclo.activo ? '0 4px 12px rgba(212, 175, 55, 0.3)' : 'none' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: '700', color: ciclo.activo ? '#0a0a0a' : '#666666' }}>
                      {ciclo.nombre.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontWeight: '600', fontSize: '1.125rem', color: '#ffffff' }}>{ciclo.nombre}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#a1a1a1', textTransform: 'capitalize' }}>{ciclo.tipo}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <MenuOpcionesMemo 
                    onEditar={() => handleEditar(ciclo)} 
                    onEliminar={() => handleEliminar(ciclo.id)} 
                  />
                  <span style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: ciclo.activo ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.08)', color: ciclo.activo ? '#d4af37' : '#666666', letterSpacing: '0.05em' }}>
                    {ciclo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <span style={{ color: '#d4af37', fontSize: '1.25rem', marginLeft: '0.25rem' }}>→</span>
                </div>
              </div>
            </div>
          ))}
          <button 
            onClick={abrirFormulario}
            style={{ padding: '1.25rem', background: 'transparent', border: '2px dashed rgba(212, 175, 55, 0.25)', borderRadius: '12px', cursor: 'pointer', color: '#a1a1a1', fontSize: '0.9375rem', fontWeight: 500, transition: 'all 0.2s ease' }}
          >
            + Crear nuevo ciclo
          </button>
        </div>
      )}
      
      {/* Modal de configuración de usuario */}
      {mostrarConfigUsuario && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#1c1c1c',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '450px',
            border: '1px solid rgba(212, 175, 55, 0.15)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#d4af37', fontSize: '1.25rem', fontWeight: 600 }}>Configurar Cuenta</h2>
              <button 
                onClick={() => { setMostrarConfigUsuario(false); setMensajePassword(''); }}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}
              >
                ×
              </button>
            </div>
            
            <p style={{ color: '#a1a1a1', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Cambia tu contraseña de acceso al sistema.
            </p>
            
            {mensajePassword && (
              <div style={{ 
                padding: '0.75rem', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                background: mensajePassword.includes('Error') ? 'rgba(196, 30, 58, 0.15)' : 'rgba(212, 175, 55, 0.15)',
                color: mensajePassword.includes('Error') ? '#e63950' : '#d4af37',
                fontSize: '0.875rem',
              }}>
                {mensajePassword}
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1a1', fontSize: '0.875rem' }}>Contraseña Actual</label>
                <input 
                  type="password" 
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff', fontSize: '1rem' }}
                  placeholder="Ingresa tu contraseña actual"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1a1', fontSize: '0.875rem' }}>Nueva Contraseña</label>
                <input 
                  type="password" 
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff', fontSize: '1rem' }}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1a1', fontSize: '0.875rem' }}>Confirmar Nueva Contraseña</label>
                <input 
                  type="password" 
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#ffffff', fontSize: '1rem' }}
                  placeholder="Repite la nueva contraseña"
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={async () => {
                  if (!passwordActual || !nuevaPassword || !confirmarPassword) {
                    setMensajePassword('Error: Todos los campos son requeridos');
                    return;
                  }
                  if (nuevaPassword !== confirmarPassword) {
                    setMensajePassword('Error: Las contraseñas nuevas no coinciden');
                    return;
                  }
                  if (nuevaPassword.length < 8) {
                    setMensajePassword('Error: La contraseña debe tener al menos 8 caracteres');
                    return;
                  }
                  
                  setGuardandoPassword(true);
                  const token = localStorage.getItem('access_token');
                  try {
                    const res = await fetch(`${apiBase}/usuarios/cambiar-password/`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        old_password: passwordActual,
                        new_password: nuevaPassword,
                        new_password_confirm: confirmarPassword,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setMensajePassword('✓ Contraseña actualizada correctamente');
                      setPasswordActual('');
                      setNuevaPassword('');
                      setConfirmarPassword('');
                    } else {
                      setMensajePassword(`Error: ${data.detail || 'Error al cambiar contraseña'}`);
                    }
                  } catch (err) {
                    setMensajePassword('Error: No se pudo conectar con el servidor');
                  }
                  setGuardandoPassword(false);
                }}
                disabled={guardandoPassword}
                style={{ 
                  flex: 1, 
                  padding: '0.875rem', 
                  background: guardandoPassword ? 'rgba(212, 175, 55, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', 
                  color: '#0a0a0a', 
                  border: 'none', 
                  borderRadius: '10px', 
                  cursor: guardandoPassword ? 'not-allowed' : 'pointer', 
                  fontWeight: 600,
                }}
              >
                {guardandoPassword ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
              <button
                onClick={() => { setMostrarConfigUsuario(false); setMensajePassword(''); }}
                style={{ 
                  padding: '0.875rem 1.5rem', 
                  background: 'transparent', 
                  color: '#a1a1a1', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '10px', 
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SeleccionCiclosMemo = memo(SeleccionCiclos);

const DashboardMemo = memo(DashboardPage);

export default function App() {
  return (
    <ToastProvider>
    <CicloProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginMemo />} />
          <Route path="/" element={<ProtectedRoute><SeleccionCiclosMemo /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayoutMemo><DashboardMemo /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/alumnos" element={<ProtectedRoute><DashboardLayoutMemo><AlumnosPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/profesores" element={<ProtectedRoute><DashboardLayoutMemo><ProfesoresPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/talleres" element={<ProtectedRoute><DashboardLayoutMemo><TalleresPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/talleres/:tallerId" element={<ProtectedRoute><DashboardLayoutMemo><TallerDetalle /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/horarios" element={<ProtectedRoute><DashboardLayoutMemo><HorariosPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/matriculas" element={<ProtectedRoute><DashboardLayoutMemo><MatriculasPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/asistencias" element={<ProtectedRoute><DashboardLayoutMemo><AsistenciasPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/recibos" element={<ProtectedRoute><DashboardLayoutMemo><RecibosPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/egresos" element={<ProtectedRoute><DashboardLayoutMemo><EgresosPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/finanzas" element={<ProtectedRoute><DashboardLayoutMemo><FinanzasPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/pagos-profesores" element={<ProtectedRoute><DashboardLayoutMemo><PagosProfesoresPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/configuracion-precios" element={<ProtectedRoute><DashboardLayoutMemo><ConfiguracionPreciosPage /></DashboardLayoutMemo></ProtectedRoute>} />
          <Route path="/calculadora-precios" element={<ProtectedRoute><DashboardLayoutMemo><CalculadoraPreciosPage /></DashboardLayoutMemo></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </CicloProvider>
    </ToastProvider>
  );
}
