import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import ToastContainer, { type ToastType, type ToastData } from '../components/ui/Toast';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showApiError: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook para acceder al sistema de toasts. Lanza error si se usa fuera de ToastProvider.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

/**
 * Parsea un error de API (axios o genérico) a un mensaje de texto legible.
 * Soporta errores de validación de Django (campo → lista de mensajes),
 * errores con clave 'detail', y errores de red genéricos.
 */
function parseApiError(error: unknown): string {
  // Manejar errores de axios (que tienen response.data con el error del backend)
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: unknown } };
  if (axiosError.response?.data) {
    const errorData = axiosError.response.data;
    // Si es un objeto con errores de validación de Django
    if (typeof errorData === 'object' && errorData !== null) {
      const dataObj = errorData as Record<string, unknown>;
        const parts: string[] = [];
        for (const [key, value] of Object.entries(dataObj)) {
          if (key === 'detail') return String(value);
          if (key === 'non_field_errors') {
            parts.push(String(Array.isArray(value) ? value.join(', ') : value));
          } else if (Array.isArray(value)) {
            parts.push(`${key}: ${value.join(', ')}`);
          } else if (typeof value === 'string') {
            parts.push(value);
          }
        }
        if (parts.length > 0) return parts.join('. ');
      }
    }
  }
  
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed === 'object' && parsed !== null) {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
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

/**
 * Provider del sistema de notificaciones toast.
 * 
 * Mantiene un array de toasts activos (máximo 5 visibles).
 * showToast: agrega un toast con ID único y tipo visual.
 * showApiError: parsea un error de axios y lo muestra como toast de error.
 * Los toasts se auto-eliminan después de 4 segundos (manejado por el componente Toast).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  // Elimina un toast específico por ID
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Agrega un nuevo toast, manteniendo solo los últimos 4 + el nuevo (máx 5)
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
