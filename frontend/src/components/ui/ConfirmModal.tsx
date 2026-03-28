import { useEffect, memo } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function ConfirmModal({
  isOpen,
  title,
  message,
  itemName,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', margin: 0 }}>
              {title}
            </h2>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <p style={{ color: '#374151', fontSize: '0.9375rem', marginBottom: '1rem' }}>
            {message}
          </p>
          
          {itemName && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
            }}>
              <span style={{ color: '#991b1b', fontWeight: '600' }}>
                {itemName}
              </span>
            </div>
          )}

          <div style={{
            background: '#fefce8',
            border: '1px solid #fef08a',
            borderRadius: '8px',
            padding: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ color: '#a16207', fontSize: '0.8125rem' }}>
              Esta acción no se puede deshacer
            </span>
          </div>
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          background: '#f9fafb',
          borderRadius: '0 0 16px 16px',
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              color: '#374151',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '0.625rem 1.25rem',
              background: '#40E0D0',
              border: 'none',
              borderRadius: '8px',
              color: '#000000',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {isLoading && (
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 70" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default memo(ConfirmModal);
