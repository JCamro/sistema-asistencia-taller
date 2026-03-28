import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loading } from '../components/ui/Loading';

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/');
    } else {
      setIsChecking(false);
    }
  }, [navigate]);

  if (isChecking) {
    return <Loading />;
  }
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      await login(data.username, data.password);
      navigate('/');
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F23', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(30, 27, 75, 0.3) 0%, transparent 70%)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(67, 56, 202, 0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
      
      <div style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', backgroundColor: '#1E1B4B', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative', zIndex: 1, border: '1px solid rgba(248, 250, 252, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 16px rgba(30, 27, 75, 0.5)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#F8FAFC', marginBottom: '0.5rem' }}>
            Taller de Música Elguera
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#F8FAFC', opacity: 0.6 }}>
            Panel de Admin
          </p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.875rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', borderRadius: '10px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          
          <Input
            label="Usuario"
            {...register('username')}
            error={errors.username?.message}
          />
          <Input
            label="Contraseña"
            type="password"
            {...register('password')}
            error={errors.password?.message}
          />

          <Button
            type="submit"
            style={{ width: '100%', marginTop: '0.5rem' }}
            isLoading={isLoading}
          >
            Iniciar sesión
          </Button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', color: '#F8FAFC', opacity: 0.5 }}>
          Sistema de gestión del Taller de Música
        </p>
      </div>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      `}</style>
    </div>
  );
}
