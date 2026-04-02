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

const Loading = memo(function Loading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTop: '4px solid #22C55E', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

function Sidebar({ cicloNombre }: { cicloNombre: string }) {
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

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/alumnos', label: 'Alumnos', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { to: '/profesores', label: 'Profesores', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { to: '/talleres', label: 'Talleres', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { to: '/horarios', label: 'Horarios', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/matriculas', label: 'Matrículas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { to: '/asistencias', label: 'Asistencias', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/recibos', label: 'Recibos', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z' },
    { to: '/pagos-profesores', label: 'Pagos Profesores', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <aside style={{ width: '260px', minHeight: '100vh', background: '#0F0F23', color: '#F8FAFC', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0 }}>
      {/* Logo */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#FFFFFF', display: 'block' }}>Taller de Música Elguera</span>
            <span style={{ fontSize: '0.6875rem', color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</span>
          </div>
        </div>
      </div>
      
      {/* Ciclo Actual */}
      <div style={{ padding: '1rem 1.5rem', background: 'rgba(30, 27, 75, 0.5)', borderBottom: '1px solid rgba(248, 250, 252, 0.1)' }}>
        <p style={{ fontSize: '0.6875rem', color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Ciclo Activo</p>
        <p style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '0.75rem' }}>{cicloNombre}</p>
        <button
          onClick={handleCambiarCiclo}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(248, 250, 252, 0.1)',
            color: '#F8FAFC',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#A5B4FC';
          }}
        >
          ← Cambiar ciclo
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
        {navItems.map(item => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.9375rem',
                fontWeight: '500',
                color: isActive ? '#22C55E' : '#F8FAFC',
                backgroundColor: isActive ? 'rgba(30, 27, 75, 0.5)' : 'transparent',
                textDecoration: 'none',
                marginBottom: '0.25rem',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 27, 75, 0.3)';
                  e.currentTarget.style.color = '#F8FAFC';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#F8FAFC';
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer - Logout */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(248, 250, 252, 0.1)' }}>
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
            color: '#F8FAFC',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = '#EF4444';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#F8FAFC';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

const SidebarMemo = memo(Sidebar);

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { cicloActual } = useCiclo();

  if (!cicloActual) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <SidebarMemo cicloNombre={cicloActual.nombre} />
      <main style={{ marginLeft: '260px', padding: '1.5rem 2rem', minHeight: '100vh' }}>
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
    try {
      const res = await fetch('/api/auth/login/', { 
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F0F23' }}>
      <form onSubmit={handleLogin} style={{ background: '#1E1B4B', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(248, 250, 252, 0.1)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1.5rem', color: '#F8FAFC' }}>Taller de Música Elguera</h1>
        {error && <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
        <input type="text" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid rgba(248, 250, 252, 0.2)', borderRadius: '8px', background: 'rgba(248, 250, 252, 0.05)', color: '#F8FAFC' }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid rgba(248, 250, 252, 0.2)', borderRadius: '8px', background: 'rgba(248, 250, 252, 0.05)', color: '#F8FAFC' }} />
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', background: loading ? '#4338CA' : '#22C55E', color: '#F8FAFC', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.15s ease' }}>{loading ? 'Cargando...' : 'Iniciar sesión'}</button>
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
  const { ciclos, cicloActual, seleccionarCiclo, recargar, isLoading } = useCiclo();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [cicloEditando, setCicloEditando] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('anual');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  if (isLoading) return <Loading />;

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const token = localStorage.getItem('access_token');
    try {
      await fetch('/api/ciclos/', {
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
      await fetch(`/api/ciclos/${cicloEditando.id}/`, {
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
      await fetch(`/api/ciclos/${id}/`, {
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
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>Bienvenido a Taller de Música Elguera</h1>
        <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>Selecciona un ciclo para continuar</p>
      </div>
      
      {(mostrarForm || mostrarEditar) && (
        <form onSubmit={mostrarEditar ? handleGuardarEdicion : handleCrear} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e5e7eb', width: '100%', maxWidth: '600px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: '600', color: '#111827' }}>{mostrarEditar ? 'Editar ciclo' : 'Crear nuevo ciclo'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>Nombre</label>
              <input type="text" placeholder="Ej: Ciclo Anual 2026" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', color: '#111827' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', color: '#111827' }}>
                <option value="anual">Anual</option>
                <option value="verano">Verano</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', color: '#111827' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', color: '#111827' }} />
            </div>
            {mostrarEditar && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#22C55E' }} />
                  Ciclo activo
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" disabled={guardando} style={{ padding: '0.5rem 1.5rem', background: '#22C55E', color: 'white', border: 'none', borderRadius: '6px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setMostrarForm(false); setMostrarEditar(false); setCicloEditando(null); }} style={{ padding: '0.5rem 1.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      
      {ciclos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', border: '1px dashed #d1d5db', maxWidth: '400px' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No hay ciclos creados</p>
          <button onClick={abrirFormulario} style={{ padding: '0.75rem 1.5rem', background: '#22C55E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
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
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: cicloActual?.id === ciclo.id ? '2px solid #22C55E' : '1px solid #e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: cicloActual?.id === ciclo.id ? '0 0 0 4px rgba(34, 197, 94, 0.1)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: ciclo.activo ? '#d1fae5' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: ciclo.activo ? '#22C55E' : '#6b7280' }}>
                      {ciclo.nombre.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontWeight: '600', fontSize: '1.125rem', color: '#111827' }}>{ciclo.nombre}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'capitalize' }}>{ciclo.tipo}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MenuOpcionesMemo 
                    onEditar={() => handleEditar(ciclo)} 
                    onEliminar={() => handleEliminar(ciclo.id)} 
                  />
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500', background: ciclo.activo ? '#d1fae5' : '#f3f4f6', color: ciclo.activo ? '#22c55e' : '#6b7280' }}>
                    {ciclo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <span style={{ color: '#22C55E', fontSize: '1.25rem' }}>→</span>
                </div>
              </div>
            </div>
          ))}
          <button 
            onClick={abrirFormulario}
            style={{ padding: '1rem', background: 'transparent', border: '2px dashed #d1d5db', borderRadius: '12px', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem' }}
          >
            + Crear nuevo ciclo
          </button>
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
          <Route path="/pagos-profesores" element={<ProtectedRoute><DashboardLayoutMemo><PagosProfesoresPage /></DashboardLayoutMemo></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </CicloProvider>
    </ToastProvider>
  );
}
