import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCiclo } from '../contexts/CicloContext';
import { getDashboardKpis } from '../api/endpoints';
import CalculadoraPrecios from './CalculadoraPrecios';

interface KpiData {
  alumnos_sin_asistencia_hoy: number;
  matriculas_por_concluir: number;
  matriculas_sin_recibo: number;
  matriculas_sin_pago_completo: number;
}

interface KpiCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  onClick: () => void;
}

function KpiCard({ title, value, icon, color, onClick }: KpiCardProps) {
  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: `1px solid ${color}20`,
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px ${color}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{title}</p>
          <p style={{ margin: '8px 0 0', fontSize: '2.25rem', fontWeight: 700, color: color, fontFamily: "'Inter', sans-serif" }}>{value}</p>
        </div>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          borderRadius: 12, 
          background: `${color}15`,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '1.375rem',
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { cicloActual } = useCiclo();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cicloActual) {
      loadKpis();
    }
  }, [cicloActual]);

  const loadKpis = async () => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const response = await getDashboardKpis(cicloActual.id);
      setKpis(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!cicloActual) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
        <p>Seleccioná un ciclo para ver el dashboard</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #e2e8f0', 
          borderTop: '#d4af37', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }} />
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Cargando dashboard...</p>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '1.75rem', 
          fontWeight: 700, 
          color: '#1e293b', 
          fontFamily: "'Inter', sans-serif",
          marginBottom: '0.25rem'
        }}>
          Dashboard
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', fontFamily: "'Inter', sans-serif" }}>
          Ciclo: <span style={{ color: '#d4af37', fontWeight: 600 }}>{cicloActual.nombre}</span>
        </p>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        <KpiCard
          title="Sin asistencia hoy"
          value={kpis?.alumnos_sin_asistencia_hoy ?? 0}
          icon="📋"
          color="#f59e0b"
          onClick={() => navigate('/asistencias')}
        />
        
        <KpiCard
          title="Matrículas por concluir"
          value={kpis?.matriculas_por_concluir ?? 0}
          icon="⚠️"
          color="#c41e3a"
          onClick={() => navigate('/matriculas')}
        />
        
        <KpiCard
          title="Sin recibo"
          value={kpis?.matriculas_sin_recibo ?? 0}
          icon="📄"
          color="#3b82f6"
          onClick={() => navigate('/recibos')}
        />
        
        <KpiCard
          title="Pago incompleto"
          value={kpis?.matriculas_sin_pago_completo ?? 0}
          icon="💰"
          color="#22c55e"
          onClick={() => navigate('/recibos')}
        />
      </div>

      {/* Calculadora de Precios */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', fontFamily: "'Inter', sans-serif" }}>Calculadora de Precios</h2>
          <button
            onClick={() => navigate('/configuracion-precios')}
            title="Configurar precios"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#d4af37';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <CalculadoraPrecios />
      </div>
    </div>
  );
}
