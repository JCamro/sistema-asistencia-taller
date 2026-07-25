import { memo, type ReactNode } from 'react';

/**
 * Props for the shared PageHeader component.
 */
interface PageHeaderProps {
  /** Main heading text displayed at the top of the page */
  title: string;
  /** Active cycle name shown as a badge next to the title */
  cicloNombre?: string;
  /** Label for the optional action button (e.g. "Nuevo alumno") */
  actionLabel?: string;
  /** Callback fired when the action button is clicked */
  onAction?: () => void;
  /** Disables the action button (e.g. while a form is submitting) */
  actionDisabled?: boolean;
  /** Extra content rendered inline next to the title (e.g. filters, toggles) */
  extra?: ReactNode;
}

/**
 * Componente compartido de encabezado de página con título, badge del ciclo activo
 * y un botón de acción opcional (normalmente "Nuevo X").
 */
function PageHeader({ title, cicloNombre, actionLabel, onAction, actionDisabled, extra }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
          {cicloNombre && (
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#b59410', background: '#fef9e7', padding: '0.2rem 0.65rem', borderRadius: '9999px' }}>
              {cicloNombre}
            </span>
          )}
          {extra}
        </div>
        <div style={{ height: 3, width: 48, background: 'linear-gradient(90deg, #d4af37, #f0d878)', borderRadius: 2, marginTop: '0.5rem' }} />
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          disabled={actionDisabled}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            cursor: actionDisabled ? 'not-allowed' : 'pointer',
            background: actionDisabled ? '#e5e7eb' : 'linear-gradient(135deg, #d4af37, #c59b2e)',
            color: actionDisabled ? '#9ca3af' : '#0a0a0a',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            boxShadow: actionDisabled ? 'none' : '0 2px 8px rgba(212,175,55,0.25)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default memo(PageHeader);
