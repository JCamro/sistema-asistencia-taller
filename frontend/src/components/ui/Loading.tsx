export function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F9FAFB'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid #e5e7eb',
        borderTop: '4px solid #22C55E',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
