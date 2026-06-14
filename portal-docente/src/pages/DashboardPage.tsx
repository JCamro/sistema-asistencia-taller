import { memo } from 'react';

const DashboardPage = memo(function DashboardPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
        Dashboard
      </h2>
      <p>Próximamente — Resumen de actividad del docente</p>
    </div>
  );
});

export default DashboardPage;
