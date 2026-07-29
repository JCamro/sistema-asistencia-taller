import { memo } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import type { Nota } from '../api/endpoints';

interface NotificationPanelProps {
  notifications: ReturnType<typeof useNotifications>['notifications'];
  backendNotes: Nota[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onMarkBackendRead: (id: number) => void;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function NotificationPanel({ notifications, backendNotes, onClose, onMarkRead, onMarkAllRead, onRemove, onClear, onMarkBackendRead }: NotificationPanelProps) {
  const hasUnread = notifications.some((n) => !n.read) || backendNotes.length > 0;
  const totalItems = notifications.length + backendNotes.length;

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 0.5rem)',
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
        <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>Notificaciones</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasUnread && (
            <button onClick={onMarkAllRead} style={{ fontSize: '0.75rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer' }}>Leer todas</button>
          )}
          <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {totalItems === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No hay notificaciones</div>
        ) : (
          <>
            {backendNotes.map((n) => (
              <div
                key={`backend-${n.id}`}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #f8fafc',
                  background: '#fffbeb',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onMarkBackendRead(n.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.8125rem' }}>{n.titulo}</span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.125rem' }}>{n.contenido || '(sin contenido)'}</div>
                  <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginTop: '0.25rem' }}>{n.fecha_vencimiento ? `Vence ${formatDateShort(n.fecha_vencimiento)}` : formatDateShort(n.fecha)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onMarkBackendRead(n.id); }}
                  title="Marcar como leída"
                  style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#fef3c7', color: '#d97706', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  ✓
                </button>
              </div>
            ))}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #f8fafc',
                  cursor: 'pointer',
                  background: n.read ? 'white' : '#fffbeb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.8125rem' }}>{n.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.125rem' }}>{n.message}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginTop: '0.25rem' }}>{formatTime(n.createdAt)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
                    style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'transparent', color: '#9ca3af', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                </div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', marginTop: '0.375rem' }} />}
              </div>
            ))}
          </>
        )}
      </div>
      {notifications.length > 0 && (
        <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <button onClick={onClear} style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Limpiar notificaciones</button>
        </div>
      )}
    </div>
  );
}

export default memo(NotificationPanel);
