import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginForm } from '../../hooks/useLoginForm';

/**
 * Login — Pantalla de autenticación
 *
 * Componente que maneja el inicio de sesión con JWT.
 * Si el usuario ya tiene un token válido, redirige automáticamente a selección de ciclo.
 * Usa useLoginForm (react-hook-form) para validación de campos y estado de carga.
 */
function Login() {
  const navigate = useNavigate();
  const { register, handleSubmit, errors, isLoading, onSubmit } = useLoginForm();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleLogin = handleSubmit(async (data) => {
    try {
      setError('');
      await onSubmit(data);
      navigate('/');
    } catch {
      setError('Usuario o contraseña incorrectos');
    }
  });

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
        {errors.username && <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(196, 30, 58, 0.15)', color: '#e63950', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(196, 30, 58, 0.3)', fontSize: '0.875rem' }}>{errors.username.message}</div>}
        <input {...register('username')} type="text" placeholder="Usuario" style={{ width: '100%', padding: '0.875rem 1rem', marginBottom: '1rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', color: '#ffffff', fontSize: '1rem' }} />
        {errors.password && <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(196, 30, 58, 0.15)', color: '#e63950', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(196, 30, 58, 0.3)', fontSize: '0.875rem' }}>{errors.password.message}</div>}
        <input {...register('password')} type="password" placeholder="Contraseña" style={{ width: '100%', padding: '0.875rem 1rem', marginBottom: '1.25rem', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', color: '#ffffff', fontSize: '1rem' }} />
        <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.875rem', background: isLoading ? 'rgba(212, 175, 55, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', color: '#0a0a0a', border: 'none', borderRadius: '10px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '1rem', boxShadow: isLoading ? 'none' : '0 4px 12px rgba(212, 175, 55, 0.3)' }}>{isLoading ? 'Cargando...' : 'Iniciar sesión'}</button>
      </form>
    </div>
  );
}

export default memo(Login);
