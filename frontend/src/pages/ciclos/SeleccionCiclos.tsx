import { useState, useMemo, memo } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { getApiBaseUrl } from '../../utils/api';
import { Loading } from '../../components/ui/Loading';
import MenuOpciones from '../../components/ui/MenuOpciones';

function SeleccionCiclos() {
  const apiBase = getApiBaseUrl();
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
  const [busquedaCiclo, setBusquedaCiclo] = useState('');
  const [ordenCiclo, setOrdenCiclo] = useState<'nombre' | 'fecha_nueva' | 'fecha_vieja'>('fecha_nueva');
  
  // Estado para config de usuario
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState('');

  // Filtrar y ordenar ciclos
  const ciclosFiltradosOrdenados = useMemo(() => {
    let result = [...ciclos];
    
    // Filtrar por nombre
    if (busquedaCiclo.trim()) {
      const search = busquedaCiclo.toLowerCase();
      result = result.filter(c => c.nombre.toLowerCase().includes(search));
    }
    
    // Ordenar
    result.sort((a, b) => {
      if (ordenCiclo === 'nombre') {
        return a.nombre.localeCompare(b.nombre);
      } else if (ordenCiclo === 'fecha_nueva') {
        return new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime();
      } else {
        return new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime();
      }
    });
    
    return result;
  }, [ciclos, busquedaCiclo, ordenCiclo]);

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
          src="/logo-taller.png" 
          alt="Logo"
          style={{ width: '72px', height: '72px', borderRadius: '18px', margin: '0 auto 1.25rem', objectFit: 'contain', boxShadow: '0 8px 32px rgba(212, 175, 55, 0.4)' }}
        />
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#d4af37', margin: 0, letterSpacing: '-0.02em' }}>Taller de Música Elguera</h1>
        <p style={{ fontSize: '0.9375rem', color: '#888', marginTop: '0.5rem' }}>Seleccioná un ciclo para continuar</p>
      </div>
      
      {(mostrarForm || mostrarEditar) && (
        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', border: '1px solid rgba(212,175,55,0.12)', width: '100%', maxWidth: '600px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontWeight: 600, fontSize: '1rem', color: '#d4af37', margin: 0 }}>{mostrarEditar ? 'Editar ciclo' : 'Crear nuevo ciclo'}</h3>
            <button type="button" onClick={() => { setMostrarForm(false); setMostrarEditar(false); setCicloEditando(null); }} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#888', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <form onSubmit={mostrarEditar ? handleGuardarEdicion : handleCrear}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre</label>
                <input type="text" placeholder="Ej: Ciclo Anual 2026" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.875rem' }}>
                  <option value="anual">Anual</option>
                  <option value="verano">Verano</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha inicio</label>
                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha fin</label>
                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} required style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.875rem' }} />
              </div>
              {mostrarEditar && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#aaa', cursor: 'pointer' }}>
                    <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#d4af37' }} /> Ciclo activo
                  </label>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" disabled={guardando} style={{ flex: 1, padding: '0.625rem', background: guardando ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #d4af37, #b8962e)', color: '#0a0a0a', border: 'none', borderRadius: '10px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              <button type="button" onClick={() => { setMostrarForm(false); setMostrarEditar(false); setCicloEditando(null); }} style={{ flex: 1, padding: '0.625rem', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
      
      {ciclos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: 'rgba(28,28,28,0.6)', borderRadius: '20px', border: '2px dashed rgba(212,175,55,0.2)', maxWidth: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ width: 64, height: 64, background: 'rgba(212,175,55,0.08)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>No hay ciclos creados</p>
          <button onClick={abrirFormulario} style={{ padding: '0.7rem 1.5rem', background: 'linear-gradient(135deg,#d4af37,#b8962e)', color: '#0a0a0a', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 4px 12px rgba(212,175,55,0.3)' }}>Crear primer ciclo</button>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', maxWidth: '600px' }}>
            {/* Search and Sort Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Buscar ciclo..." value={busquedaCiclo} onChange={e => setBusquedaCiclo(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.1)', overflow: 'hidden' }}>
                {[{key:'nombre',label:'A-Z'},{key:'fecha_nueva',label:'↓ Nuevo'},{key:'fecha_vieja',label:'↑ Viejo'}].map(o => (
                  <button key={o.key} onClick={() => setOrdenCiclo(o.key as any)}
                    style={{ padding: '0.5rem 0.7rem', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: ordenCiclo===o.key?600:400,
                      background: ordenCiclo===o.key?'rgba(212,175,55,0.15)':'transparent', color: ordenCiclo===o.key?'#d4af37':'#666', transition: 'all 0.15s' }}
                  >{o.label}</button>
                ))}
              </div>
            </div>

            {/* Ciclos List */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              {ciclosFiltradosOrdenados.map(ciclo => (
              <div 
                key={ciclo.id}
                onClick={() => handleSeleccionar(ciclo)}
                style={{ 
                  background: cicloActual?.id === ciclo.id ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(28, 28, 28, 0.9) 100%)' : '#1c1c1c', 
                  padding: '1.25rem 1.5rem', 
                  borderRadius: '14px', 
                  border: cicloActual?.id === ciclo.id ? '1.5px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: cicloActual?.id === ciclo.id ? '0 0 24px rgba(212, 175, 55, 0.15), 0 4px 16px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={e => { if (cicloActual?.id !== ciclo.id) { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.background = '#1e1e1e'; } }}
                onMouseLeave={e => { if (cicloActual?.id !== ciclo.id) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = '#1c1c1c'; } }}
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
                    <MenuOpciones 
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
            </div>
          </div>
          <button 
            onClick={abrirFormulario}
            style={{ marginTop: '1rem', padding: '1rem', background: 'transparent', border: '2px dashed rgba(212, 175, 55, 0.2)', borderRadius: '12px', cursor: 'pointer', color: '#888', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s ease', width: '100%', maxWidth: '600px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4af37'; e.currentTarget.style.color = '#d4af37'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'; e.currentTarget.style.color = '#888'; }}
          >
            + Crear nuevo ciclo
          </button>
        </>
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
                    const response = await fetch(`${apiBase}/usuarios/cambiar-password/`, {
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
                    const jsonData = await response.json();
                    if (response.ok) {
                      setMensajePassword('✓ Contraseña actualizada correctamente');
                      setPasswordActual('');
                      setNuevaPassword('');
                      setConfirmarPassword('');
                    } else {
                      setMensajePassword(`Error: ${jsonData.detail || 'Error al cambiar contraseña'}`);
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


export default memo(SeleccionCiclos);
