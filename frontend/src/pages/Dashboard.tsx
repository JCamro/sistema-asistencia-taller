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
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 24,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${color}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, color: '#666', fontWeight: 500 }}>{title}</p>
          <p style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 700, color: '#1a1a1a' }}>{value}</p>
        </div>
        <div style={{ fontSize: 32 }}>{icon}</div>
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
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>Seleccioná un ciclo para ver el dashboard</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Ciclo: {cicloActual.nombre}
      </p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 20 
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
          color="#ef4444"
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
          color="#10b981"
          onClick={() => navigate('/recibos')}
        />
      </div>

      {/* Calculadora de Precios */}
      <div style={{ marginTop: 32 }}>
        <CalculadoraPrecios />
      </div>
    </div>
  );
}