import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  children, 
  variant = 'primary', 
  isLoading, 
  size = 'md',
  className = '', 
  disabled,
  style,
  ...props 
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: 600,
    borderRadius: '10px',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '0.01em',
    opacity: disabled || isLoading ? 0.6 : 1,
  };

  const sizes = {
    sm: { padding: '0.5rem 1rem', fontSize: '0.8125rem' },
    md: { padding: '0.625rem 1.25rem', fontSize: '0.875rem' },
    lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
  };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)',
      color: '#0a0a0a',
      boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.08)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.15)',
    },
    danger: {
      background: 'rgba(196, 30, 58, 0.15)',
      color: '#e63950',
      border: '1px solid rgba(196, 30, 58, 0.3)',
    },
    ghost: {
      background: 'transparent',
      color: '#a1a1a1',
      border: 'none',
    },
  };

  return (
    <button
      style={{ ...baseStyles, ...sizes[size], ...variants[variant], ...style }}
      disabled={disabled || isLoading}
      className={className}
      {...props}
    >
      {isLoading ? (
        <>
          <span style={{ 
            width: '16px', 
            height: '16px', 
            border: '2px solid currentColor', 
            borderTopColor: 'transparent', 
            borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block' 
          }} />
          Cargando...
        </>
      ) : children}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
