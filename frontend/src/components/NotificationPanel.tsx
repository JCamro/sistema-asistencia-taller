import { memo } from 'react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationPanelProps {
  notifications: ReturnType<typeof useNotifications>['notifications'];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead, onRemove, onClear }: NotificationPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 0.5rem)',
      right: 0,
      width: 320,
      maxHeight: 400,
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
          {notifications.some((n) => !n.read) && (
            <button onClick={onMarkAllRead} style={{ fontSize: '0.75rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer' }}>Leer todas</button>
          )}
          <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No hay notificaciones</div>
        ) : (
          notifications.map((n) => (
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
          ))
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
