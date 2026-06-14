import { memo } from 'react';

const PagosPage = memo(function PagosPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
        Pagos
      </h2>
      <p>Próximamente — Historial de pagos</p>
    </div>
  );
});

export default PagosPage;
