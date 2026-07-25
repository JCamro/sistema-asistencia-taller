import { memo } from 'react';

interface Asistencia {
  id: number;
  alumno_nombre: string;
  estado: string;
  observacion: string;
  hora: string;
  es_recuperacion: boolean;
  profesor: number | null;
  profesor_nombre: string;
}

interface HorarioOption {
  id: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

const ESTADOS = [
  { value: 'asistio', label: 'Asistió', color: '#059669', bg: '#d1fae5' },
  { value: 'falta', label: 'Falta', color: '#d97706', bg: '#fef3c7' },
  { value: 'falta_grave', label: 'Falta Grave', color: '#dc2626', bg: '#fee2e2' },
];

function getEstadoInfo(estado: string | null) {
  if (!estado) return { label: 'Sin registrar', color: '#6b7280', bg: '#f3f4f6' };
  return ESTADOS.find((e) => e.value === estado) || { label: estado, color: '#6b7280', bg: '#f3f4f6' };
}

interface AsistenciaHistorialDiaProps {
  asistencias: Asistencia[];
  horarioSeleccionado: number | null;
  horariosFiltrados: HorarioOption[];
  onEditAsistencia: (asistencia: Asistencia) => void;
}

function AsistenciaHistorialDia({
  asistencias,
  horarioSeleccionado,
  horariosFiltrados,
  onEditAsistencia,
}: AsistenciaHistorialDiaProps) {
  const horarioActual = horariosFiltrados.find((h) => h.id === horarioSeleccionado);

  return (
    <div>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Historial del Día</h3>
          {horarioSeleccionado && horariosFiltrados.length > 0 && (
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {horarioActual?.dia_nombre} {horarioActual?.hora_inicio?.substring(0, 5)} - {horarioActual?.hora_fin?.substring(0, 5)}
            </p>
          )}
        </div>
        {asistencias.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>Sin registros</div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {asistencias.map((a) => {
              const estadoInfo = getEstadoInfo(a.estado);
              return (
                <div
                  key={a.id}
                  onClick={() => onEditAsistencia(a)}
                  style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: '#111827', fontSize: '0.875rem' }}>{a.alumno_nombre}</span>
                    <span style={{ padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.625rem', fontWeight: '600', background: estadoInfo.bg, color: estadoInfo.color }}>
                      {estadoInfo.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {a.hora?.substring(0, 5)} {a.es_recuperacion && '(Recuperación)'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Prof. {a.profesor_nombre}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AsistenciaHistorialDia);
