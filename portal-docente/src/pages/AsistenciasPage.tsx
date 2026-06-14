import { memo } from 'react';

const AsistenciasPage = memo(function AsistenciasPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
        Asistencias
      </h2>
      <p>Próximamente — Registro de asistencias</p>
    </div>
  );
});

export default AsistenciasPage;
