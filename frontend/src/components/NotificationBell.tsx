import { memo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function NotificationBell() {
  const { backendNotes, unreadCount, markBackendRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: number) => {
    await markBackendRead(id);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          background: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#4b5563',
        }}
        aria-label="Notificaciones"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.65rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 0.5rem)',
          right: 0,
          width: 320,
          maxHeight: 420,
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #f1f5f9',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>Recordatorios</span>
            <button onClick={() => setOpen(false)} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {backendNotes.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No hay recordatorios pendientes</div>
            ) : (
              backendNotes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f8fafc',
                    background: '#fffbeb',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                      <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.8125rem' }}>{n.titulo}</span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.125rem' }}>{n.contenido || '(sin contenido)'}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginTop: '0.25rem' }}>{n.fecha_vencimiento ? `Vence ${formatDateShort(n.fecha_vencimiento)}` : formatDateShort(n.fecha)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                    title="Marcar como leída"
                    style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#fef3c7', color: '#d97706', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    ✓
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <button onClick={() => { setOpen(false); navigate('/notificaciones?filter=recordatorios'); }} style={{ fontSize: '0.8125rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer' }}>Ver más →</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(NotificationBell);
