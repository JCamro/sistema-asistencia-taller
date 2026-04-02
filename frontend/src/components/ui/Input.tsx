import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', style, ...props }: InputProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#a1a1a1',
          letterSpacing: '0.01em'
        }}>
          {label}
        </label>
      )}
      <input
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          fontFamily: "'Inter', sans-serif",
          border: error 
            ? '1px solid rgba(196, 30, 58, 0.5)' 
            : '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          color: '#ffffff',
          transition: 'all 0.2s ease',
          outline: 'none',
          ...style
        }}
        {...props}
      />
      {error && (
        <p style={{ 
          marginTop: '0.375rem', 
          fontSize: '0.8125rem', 
          color: '#e63950',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem'
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
