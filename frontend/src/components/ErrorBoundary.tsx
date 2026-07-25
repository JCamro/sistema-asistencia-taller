import { Component, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Fallback UI displayed when the ErrorBoundary catches an error.
 * Shows an error message with two recovery options: retry (re-mount children)
 * and go home (retry + navigate to root).
 */
function Fallback({ onRetry }: { onRetry: () => void }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #141414 0%, #1c1c1c 100%)',
          padding: '2rem',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          border: '1px solid rgba(212, 175, 55, 0.15)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c41e3a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: '1rem' }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d4af37', margin: '0 0 0.5rem' }}>
          Algo salió mal
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>
          Ocurrió un error inesperado. Volvé a intentar o regresá al inicio.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
          <button
            onClick={onRetry}
            style={{
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9375rem',
            }}
          >
            Reintentar
          </button>
          <button
            onClick={() => {
              onRetry();
              navigate('/');
            }}
            style={{
              padding: '0.875rem',
              background: 'transparent',
              color: '#d4af37',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9375rem',
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * React Error Boundary que captura errores de renderizado en el árbol de componentes
 * y muestra una UI de fallback en lugar de crashear toda la aplicación.
 * 
 * Wraps the entire app to catch unhandled render errors and provide a recovery path.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Called during the render phase when a descendant component throws an error.
   * Updates state to trigger the fallback UI without causing an unmount/remount cycle.
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Called after an error has been thrown by a descendant.
   * Used for side effects like logging — does NOT update state (use getDerivedStateFromError for that).
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  /**
   * Resets the error state, effectively remounting the children to attempt recovery.
   * Called by the Fallback UI's retry buttons.
   */
  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <Fallback onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
