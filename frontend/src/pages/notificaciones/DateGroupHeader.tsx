function DateGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 0 0.35rem' }}>
      <span style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        color: '#9ca3af',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
      <span style={{
        fontSize: '0.625rem',
        fontWeight: 700,
        color: '#d1d5db',
        background: '#f9fafb',
        padding: '0.1rem 0.45rem',
        borderRadius: '9999px',
      }}>
        {count}
      </span>
    </div>
  );
}

export { DateGroupHeader };
