import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, style }: CardProps) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', ...style }}>
      {children}
    </div>
  );
}

export function CardHeader({ children, style }: CardProps) {
  return (
    <div style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem', marginBottom: '1rem', ...style }}>
      {children}
    </div>
  );
}

export function CardTitle({ children, style }: CardProps) {
  return (
    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', ...style }}>
      {children}
    </h2>
  );
}
