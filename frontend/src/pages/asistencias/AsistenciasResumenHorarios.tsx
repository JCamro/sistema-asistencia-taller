import { memo } from 'react';

interface AlumnoHorario {
  matricula_id: number;
  alumno_nombre: string;
  estado: string | null;
}

interface HorarioResumen {
  id: number;
  hora_inicio: string;
  profesor_nombre: string;
}

interface AsistenciasResumenHorariosProps {
  horarios: HorarioResumen[];
  alumnosPorHorario: Map<number, AlumnoHorario[]>;
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  asistio: '#059669',
  falta: '#d97706',
  falta_grave: '#dc2626',
};

const PENDIENTE_COLOR = '#9ca3af';

function getEstadoColor(estado: string | null) {
  if (!estado) return PENDIENTE_COLOR;
  return STATUS_COLORS[estado] || PENDIENTE_COLOR;
}

function Dot({ color }: { color: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}

function StatusCount({ color, count }: { color: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <Dot color={color} />
      <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

/**
 * AsistenciasResumenHorarios — Vista resumen de todos los horarios de un día
 *
 * Se muestra cuando el usuario selecciona un taller pero NO un horario específico.
 * Para cada horario del taller en ese día, muestra un contador de asistencias
 * y la lista de alumnos con su estado, usando puntos de color en lugar de emojis.
 */
function AsistenciasResumenHorarios({ horarios, alumnosPorHorario, loading }: AsistenciasResumenHorariosProps) {
  if (horarios.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
      ) : (
        horarios
          .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
          .map((horario) => {
            const alumnosDelHorario = alumnosPorHorario.get(horario.id) || [];
            const countAsistio = alumnosDelHorario.filter((a) => a.estado === 'asistio').length;
            const countFalta = alumnosDelHorario.filter((a) => a.estado === 'falta' || a.estado === 'falta_grave').length;
            const countPendiente = alumnosDelHorario.length - countAsistio - countFalta;
            return (
              <div key={horario.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', background: '#f9f7ef', borderBottom: '1px solid #ede8d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {horario.hora_inicio?.substring(0, 5)}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{horario.profesor_nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    {countAsistio > 0 && <StatusCount color={STATUS_COLORS.asistio} count={countAsistio} />}
                    {countFalta > 0 && <StatusCount color={STATUS_COLORS.falta} count={countFalta} />}
                    {countPendiente > 0 && <StatusCount color={PENDIENTE_COLOR} count={countPendiente} />}
                  </div>
                </div>
                {alumnosDelHorario.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.8rem' }}>Sin alumnos</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem 1rem' }}>
                    {alumnosDelHorario.map((alumno) => {
                      const color = getEstadoColor(alumno.estado);
                      return (
                        <div
                          key={alumno.matricula_id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.75rem',
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <Dot color={color} />
                          <span style={{ color: '#334155', fontWeight: 500 }}>{alumno.alumno_nombre}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}

export default memo(AsistenciasResumenHorarios);
