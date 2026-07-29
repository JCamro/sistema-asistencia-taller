import { memo, useState, useRef, useEffect, useCallback } from 'react';
import NotificationPanel from './NotificationPanel';
import { useNotifications } from '../hooks/useNotifications';

function NotificationBell() {
  const {
    notifications,
    backendNotes,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    markBackendRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
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

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
    backendNotes.forEach((n) => markBackendRead(n.id));
  }, [backendNotes, markAllAsRead, markBackendRead]);

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
        <NotificationPanel
          notifications={notifications}
          backendNotes={backendNotes}
          onClose={() => setOpen(false)}
          onMarkRead={markAsRead}
          onMarkAllRead={handleMarkAllRead}
          onRemove={removeNotification}
          onClear={clearNotifications}
          onMarkBackendRead={markBackendRead}
        />
      )}
    </div>
  );
}

export default memo(NotificationBell);
