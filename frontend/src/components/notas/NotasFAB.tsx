import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

const DocumentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

function NotasFAB() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/notificaciones?filter=notas')}
      title="Notas"
      aria-label="Notas"
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #d4af37 0%, #f0d878 100%)',
        color: '#0a0a0a',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
      }}
    >
      <DocumentIcon />
    </button>
  );
}

export default memo(NotasFAB);
