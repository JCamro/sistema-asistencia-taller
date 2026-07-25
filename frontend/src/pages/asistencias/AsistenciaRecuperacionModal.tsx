import { memo } from 'react';

interface RecuperacionResultado {
  matricula_id: number;
  alumno_nombre: string;
  taller_nombre: string;
  sesiones_disponibles: number;
}

interface AsistenciaRecuperacionModalProps {
  isOpen: boolean;
  busqueda: string;
  onBusquedaChange: (value: string) => void;
  onSearch: () => void;
  resultados: RecuperacionResultado[];
  onSeleccionar: (alumno: RecuperacionResultado) => void;
  onClose: () => void;
}

/**
 * AsistenciaRecuperacionModal — Modal para agregar clases de recuperación
 *
 * Permite buscar alumnos por nombre/DNI que tengan matrículas activas en
 * otros horarios (vía endpoint recuperables) y registrarlos como asistencia
 * de recuperación en el horario actual.
 */
function AsistenciaRecuperacionModal({
  isOpen,
  busqueda,
  onBusquedaChange,
  onSearch,
  resultados,
  onSeleccionar,
  onClose,
}: AsistenciaRecuperacionModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Agregar Recuperación</h3>
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '1rem' }}
        />
        <button onClick={onSearch} style={{ width: '100%', padding: '0.75rem', minHeight: '44px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', marginBottom: '1rem', cursor: 'pointer' }}>Buscar</button>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {resultados.length === 0 && busqueda && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
              No hay alumnos disponibles para recuperación en este horario
            </div>
          )}
          {resultados.map((alumno) => (
            <div key={alumno.matricula_id} onClick={() => onSeleccionar(alumno)} style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
              <div style={{ fontWeight: '500' }}>{alumno.alumno_nombre}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Taller: {alumno.taller_nombre} · {alumno.sesiones_disponibles} sesiones disponibles</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', minHeight: '44px', background: '#f3f4f6', border: 'none', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

export default memo(AsistenciaRecuperacionModal);
