import { useState, useEffect, memo, useCallback } from 'react';
import { getApiBaseUrl } from '../../utils/api';

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string;
}

interface TraspasoModalProps {
  isOpen: boolean;
  matriculaId: number | null;
  alumnoOrigen: string;
  tallerNombre: string;
  cicloId: number | null;
  onConfirm: (alumnoDestinoId: number) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function TraspasoModal({
  isOpen,
  alumnoOrigen,
  tallerNombre,
  cicloId,
  onConfirm,
  onCancel,
  isLoading = false,
}: TraspasoModalProps) {
  const apiBase = getApiBaseUrl();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<Alumno | null>(null);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);

  useEffect(() => {
    if (!isOpen || !cicloId) return;
    const token = localStorage.getItem('access_token');
    setLoadingAlumnos(true);
    fetch(`${apiBase}/api/ciclos/${cicloId}/alumnos/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAlumnos(data.results || data))
      .catch(() => setAlumnos([]))
      .finally(() => setLoadingAlumnos(false));
  }, [isOpen, cicloId]);

  useEffect(() => {
    if (isOpen) {
      setPaso(1);
      setSearch('');
      setShowDropdown(false);
      setAlumnoSeleccionado(null);
    }
  }, [isOpen]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) onCancel();
    },
    [isOpen, isLoading, onCancel]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  if (!isOpen) return null;

  const filteredAlumnos = alumnos.filter(
    (a) =>
      a.nombre.toLowerCase().includes(search.toLowerCase()) ||
      a.apellido.toLowerCase().includes(search.toLowerCase()) ||
      (a.dni && a.dni.includes(search))
  );

  const handleSeleccionar = (alumno: Alumno) => {
    setAlumnoSeleccionado(alumno);
    setSearch(`${alumno.apellido}, ${alumno.nombre}`);
    setShowDropdown(false);
  };

  const handleContinuar = () => {
    if (alumnoSeleccionado) setPaso(2);
  };

  const handleConfirmar = () => {
    if (alumnoSeleccionado) onConfirm(alumnoSeleccionado.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
              >
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                Traspasar Matrícula
              </h2>
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Paso {paso} de 2
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {paso === 1 && (
            <>
              {/* Alumno origen */}
              <div
                style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Alumno actual (origen)
                </span>
                <div style={{ color: '#166534', fontWeight: '600', marginTop: '0.25rem' }}>
                  {alumnoOrigen}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: '0.125rem' }}>
                  {tallerNombre}
                </div>
              </div>

              {/* Selector alumno destino */}
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                Seleccionar alumno destino
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={loadingAlumnos ? 'Cargando alumnos...' : 'Escribe el nombre del alumno...'}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                    setAlumnoSeleccionado(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  disabled={loadingAlumnos}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: `1px solid ${alumnoSeleccionado ? '#2563EB' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: loadingAlumnos ? '#f9fafb' : 'white',
                  }}
                />
                {showDropdown && search && filteredAlumnos.length > 0 && !alumnoSeleccionado && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      marginTop: '4px',
                      maxHeight: '200px',
                      overflow: 'auto',
                      zIndex: 10,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    }}
                  >
                    {filteredAlumnos.map((alumno) => (
                      <div
                        key={alumno.id}
                        onClick={() => handleSeleccionar(alumno)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                      >
                        <div style={{ fontWeight: '500', color: '#111827' }}>
                          {alumno.apellido}, {alumno.nombre}
                        </div>
                        {alumno.dni && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            DNI: {alumno.dni}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {alumnoSeleccionado && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span style={{ color: '#1E40AF', fontWeight: '500', fontSize: '0.875rem' }}>
                    {alumnoSeleccionado.apellido}, {alumnoSeleccionado.nombre}
                  </span>
                </div>
              )}
            </>
          )}

          {paso === 2 && alumnoSeleccionado && (
            <>
              {/* Resumen del traspaso */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Origen
                  </span>
                  <div style={{ color: '#991B1B', fontWeight: '600', marginTop: '0.25rem' }}>
                    {alumnoOrigen}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Destino
                  </span>
                  <div style={{ color: '#166534', fontWeight: '600', marginTop: '0.25rem' }}>
                    {alumnoSeleccionado.apellido}, {alumnoSeleccionado.nombre}
                  </div>
                </div>
              </div>

              {/* Info del taller */}
              <div
                style={{
                  marginTop: '1rem',
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: '#374151' }}>
                  <strong>Taller:</strong> {tallerNombre}
                </span>
              </div>

              {/* Advertencia */}
              <div
                style={{
                  marginTop: '0.75rem',
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="2"
                  style={{ flexShrink: 0, marginTop: '2px' }}
                >
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div style={{ fontSize: '0.8125rem', color: '#92400E' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Esta acción realizará lo siguiente:</div>
                  <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.6 }}>
                    <li>Se desactivará la matrícula de {alumnoOrigen.split(',')[0]}</li>
                    <li>Se creará una nueva matrícula para {alumnoSeleccionado.apellido}</li>
                    <li>Se transferirán todas las asistencias registradas</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
            background: '#f9fafb',
            borderRadius: '0 0 16px 16px',
          }}
        >
          {paso === 1 ? (
            <>
              <button
                onClick={onCancel}
                disabled={isLoading}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleContinuar}
                disabled={!alumnoSeleccionado}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: alumnoSeleccionado ? '#2563EB' : '#93C5FD',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: alumnoSeleccionado ? 'pointer' : 'not-allowed',
                }}
              >
                Continuar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPaso(1)}
                disabled={isLoading}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                Atrás
              </button>
              <button
                onClick={handleConfirmar}
                disabled={isLoading}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#2563EB',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {isLoading && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 70" />
                  </svg>
                )}
                Confirmar Traspaso
              </button>
            </>
          )}
        </div>

        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.95) translateY(-10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

export default memo(TraspasoModal);
