import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Contenedor tipo tarjeta con fondo blanco, borde sutil y sombra ligera.
 * Componente base para secciones de contenido en el layout.
 */
export function Card({ children, style }: CardProps) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', ...style }}>
      {children}
    </div>
  );
}

/**
 * Header de tarjeta con borde inferior — típicamente contiene un CardTitle.
 */
export function CardHeader({ children, style }: CardProps) {
  return (
    <div style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem', marginBottom: '1rem', ...style }}>
      {children}
    </div>
  );
}

/**
 * Título de sección dentro de una tarjeta — usualmente usado dentro de CardHeader.
 */
export function CardTitle({ children, style }: CardProps) {
  return (
    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', ...style }}>
      {children}
    </h2>
  );
}
