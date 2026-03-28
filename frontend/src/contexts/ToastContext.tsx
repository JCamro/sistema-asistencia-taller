import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import ToastContainer, { type ToastType, type ToastData } from '../components/ui/Toast';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showApiError: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

function parseApiError(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed === 'object' && parsed !== null) {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(parsed)) {
          if (key === 'detail') return String(value);
          if (key === 'non_field_errors') {
            parts.push(String(Array.isArray(value) ? value.join(', ') : value));
          } else if (Array.isArray(value)) {
            parts.push(`${key}: ${value.join(', ')}`);
          } else if (typeof value === 'string') {
            parts.push(`${key}: ${value}`);
          }
        }
        if (parts.length > 0) return parts.join('. ');
      }
    } catch {
      return error.message;
    }
    return error.message;
  }
  return 'Ha ocurrido un error inesperado';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
  }, []);

  const showApiError = useCallback((error: unknown) => {
    showToast(parseApiError(error), 'error');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showApiError }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
