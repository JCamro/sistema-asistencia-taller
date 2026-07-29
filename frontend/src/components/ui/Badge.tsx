import { memo } from 'react';

interface BadgeProps {
  bg: string;
  color: string;
  label: string;
  description?: string;
  size?: 'sm' | 'md';
}

const Badge = ({ bg, color, label, description, size = 'md' }: BadgeProps) => (
  <span
    title={description}
    style={{
      padding: size === 'sm' ? '0.15rem 0.55rem' : '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
      fontWeight: 600,
      background: bg,
      color: color,
      border: `1.5px solid ${color}40`,
      whiteSpace: 'nowrap' as const,
    }}
  >
    {label}
  </span>
);

export default memo(Badge);
