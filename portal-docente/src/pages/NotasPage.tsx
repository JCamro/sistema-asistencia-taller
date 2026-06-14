import { memo } from 'react';

const NotasPage = memo(function NotasPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
        Notas
      </h2>
      <p>Próximamente — Gestión de notas y evaluaciones</p>
    </div>
  );
});

export default NotasPage;
