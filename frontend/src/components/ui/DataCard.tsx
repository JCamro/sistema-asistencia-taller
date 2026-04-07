import { memo, type ReactNode, type CSSProperties } from 'react';

interface DataCardProps {
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outlined';
}

function DataCard({ title, children, actions, onClick, variant = 'default' }: DataCardProps) {
  const baseStyles: CSSProperties = {
    background: variant === 'default' ? '#ffffff' : 'transparent',
    borderRadius: '12px',
    border: variant === 'default' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
    boxShadow: variant === 'default' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
    padding: '1rem',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.15s, box-shadow 0.15s',
  };

  return (
    <div 
      style={baseStyles}
      onClick={onClick}
      className="hide-desktop"
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = variant === 'default' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none';
        }
      }}
    >
      {title && (
        <h3 style={{ 
          fontWeight: 600, 
          color: '#111827', 
          marginBottom: '0.5rem',
          fontSize: '0.9375rem'
        }}>
          {title}
        </h3>
      )}
      {children}
      {actions && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginTop: '1rem' 
        }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export default memo(DataCard);
