import { useEffect, memo } from 'react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; bar: string }> = {
  error: { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', bar: '#DC2626' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A', bar: '#16A34A' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', bar: '#D97706' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', bar: '#2563EB' },
};

const ICONS: Record<ToastType, string> = {
  error: 'M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const DURATION = 4000;

function Toast({ toast, onDismiss }: ToastProps) {
  const colors = COLORS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.25rem',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -5px rgba(0,0,0,0.04)',
        minWidth: '320px',
        maxWidth: '420px',
        animation: 'toastSlideIn 0.3s ease-out',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.icon} strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
        <path d={ICONS[toast.type]} />
      </svg>
      <span style={{ color: '#1F2937', fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5, flex: 1 }}>
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          color: '#9CA3AF',
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Cerrar notificación"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          background: colors.bar,
          borderRadius: '0 0 0 12px',
          animation: `toastProgress ${DURATION}ms linear forwards`,
        }}
      />
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '0.75rem',
        }}
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @media (prefers-reduced-motion: reduce) {
          div[role="alert"] { animation: none !important; }
          div[role="alert"] > div:last-child { animation: none !important; width: 100% !important; }
        }
      `}</style>
    </>
  );
}

export default memo(ToastContainer);
