import { memo } from 'react';

interface AlumnoHorario {
  matricula_id: number;
  alumno_id: number;
  alumno_nombre: string;
  sesiones_disponibles: number;
  asistencia_id: number | null;
  estado: string | null;
  observacion: string;
  profesor_id?: number | null;
  profesor_nombre?: string;
  es_recuperacion?: boolean;
  matricula_concluida: boolean;
}

interface HorarioOption {
  id: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

interface Estadisticas {
  total: number;
  asistio: number;
  falta: number;
  falta_grave: number;
}

const ESTADOS = [
  { value: 'asistio', label: 'Asistió', color: '#059669', bg: '#d1fae5' },
  { value: 'falta', label: 'Falta', color: '#d97706', bg: '#fef3c7' },
  { value: 'falta_grave', label: 'Falta Grave', color: '#dc2626', bg: '#fee2e2' },
];

interface AsistenciaTableProps {
  alumnosHorario: AlumnoHorario[];
  loadingAlumnos: boolean;
  saving: boolean;
  horarioSeleccionado: number | null;
  horariosFiltrados: HorarioOption[];
  isMobile: boolean;
  estadisticas: Estadisticas;
  onEstadoChange: (alumno: AlumnoHorario, estado: string) => void;
  onEditAsistencia: (alumno: AlumnoHorario) => void;
  onOpenRecuperacion: () => void;
}

function getEstadoInfo(estado: string | null) {
  if (!estado) return { label: 'Sin registrar', color: '#6b7280', bg: '#e5e7eb' };
  return ESTADOS.find((e) => e.value === estado) || { label: estado, color: '#6b7280', bg: '#e5e7eb' };
}

/**
 * AsistenciaTable — Tabla editable de alumnos para marcar asistencia
 *
 * Muestra la lista de alumnos de un horario específico con tres botones
 * de estado (Asistió / Falta / Falta Grave) y un badge del estado actual.
 * Una vez registrada la asistencia, los botones se bloquean y el badge
 * se vuelve clickeable para editar desde el panel derecho (historial).
 */
function AsistenciaTable({
  alumnosHorario,
  loadingAlumnos,
  saving,
  horarioSeleccionado,
  horariosFiltrados,
  isMobile,
  estadisticas,
  onEstadoChange,
  onEditAsistencia,
  onOpenRecuperacion,
}: AsistenciaTableProps) {
  const horarioActual = horariosFiltrados.find((h) => h.id === horarioSeleccionado);

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Lista de Alumnos</h3>
          {horarioActual && (
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {horarioActual.dia_nombre} {horarioActual.hora_inicio?.substring(0, 5)} - {horarioActual.hora_fin?.substring(0, 5)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ padding: '0.25rem 0.75rem', background: '#d1fae5', color: '#059669', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
            {estadisticas.asistio} Asistieron
          </span>
          <span style={{ padding: '0.25rem 0.75rem', background: '#fef3c7', color: '#d97706', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
            {estadisticas.falta} Faltas
          </span>
          <span style={{ padding: '0.25rem 0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
            {estadisticas.falta_grave} F. Grave
          </span>
        </div>
      </div>

      {loadingAlumnos ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
      ) : alumnosHorario.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay alumnos matriculados en este horario</div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {alumnosHorario.map((alumno) => {
            const estadoInfo = getEstadoInfo(alumno.estado);
            const tieneAsistencia = !!alumno.asistencia_id;
            const concluida = alumno.matricula_concluida;
            return (
              <div key={alumno.matricula_id} style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                borderLeft: concluida ? '3px dashed #d1d5db' : '3px solid transparent',
                background: concluida ? '#fafafa' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: concluida ? '#9ca3af' : '#111827' }}>
                      {alumno.alumno_nombre}
                      {concluida && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>(Concluida)</span>
                      )}
                      {alumno.es_recuperacion && (
                        <span style={{ marginLeft: '0.35rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, background: '#fef9e7', color: '#8b6914' }}>Recuperacion</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{alumno.sesiones_disponibles} sesiones disponibles</div>
                  </div>
                  <span
                    onClick={() => {
                      if (alumno.asistencia_id && !concluida) {
                        onEditAsistencia(alumno);
                      }
                    }}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: estadoInfo.bg,
                      color: estadoInfo.color,
                      cursor: tieneAsistencia && !concluida ? 'pointer' : 'default',
                      border: tieneAsistencia ? `1.5px solid ${estadoInfo.color}40` : 'none',
                      opacity: concluida ? 0.6 : 1,
                    }}
                  >
                    {estadoInfo.label}
                  </span>
                </div>
                {tieneAsistencia && !concluida && (
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.5rem' }}>
                    Editar desde el panel derecho
                  </div>
                )}
                {!concluida && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ESTADOS.map((estado) => (
                      <button
                        key={estado.value}
                        onClick={() => onEstadoChange(alumno, estado.value)}
                        disabled={saving || tieneAsistencia}
                        style={{
                          flex: 1,
                          padding: isMobile ? '0.75rem 0.5rem' : '0.5rem',
                          minHeight: '44px',
                          border: alumno.estado === estado.value ? `1.5px solid ${estado.color}40` : '1px solid transparent',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: saving || tieneAsistencia ? 'not-allowed' : 'pointer',
                          background: alumno.estado === estado.value ? estado.bg : '#f3f4f6',
                          color: alumno.estado === estado.value ? estado.color : '#9ca3af',
                        }}
                      >
                        {estado.label}
                      </button>
                    ))}
                  </div>
                )}
                {tieneAsistencia && !concluida && (
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.25rem' }}>
                    (Registrado - editar desde panel derecho)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={onOpenRecuperacion}
          style={{ width: '100%', padding: '0.75rem', minHeight: '48px', background: '#e5e7eb', border: '1px dashed #d1d5db', borderRadius: '8px', color: '#374151', fontWeight: '500', cursor: 'pointer' }}
        >
          + Agregar Recuperación
        </button>
      </div>
    </div>
  );
}

export default memo(AsistenciaTable);
