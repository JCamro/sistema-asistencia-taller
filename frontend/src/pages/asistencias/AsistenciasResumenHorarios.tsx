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

function getEstadoInfo(estado: string | null) {
  if (!estado) return { label: 'Sin registrar', color: '#6b7280', bg: '#f3f4f6' };
  const found = [
    { value: 'asistio', label: 'Asistió', color: '#059669', bg: '#d1fae5' },
    { value: 'falta', label: 'Falta', color: '#d97706', bg: '#fef3c7' },
    { value: 'falta_grave', label: 'Falta Grave', color: '#dc2626', bg: '#fee2e2' },
  ].find((e) => e.value === estado);
  return found || { label: estado, color: '#6b7280', bg: '#f3f4f6' };
}

function AsistenciasResumenHorarios({ horarios, alumnosPorHorario, loading }: AsistenciasResumenHorariosProps) {
  if (horarios.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
              <div key={horario.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '0.625rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {horario.hora_inicio?.substring(0, 5)}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{horario.profesor_nombre}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ color: '#059669', fontWeight: '600' }}>{countAsistio}✔</span>
                    <span style={{ color: '#dc2626', fontWeight: '600' }}>{countFalta}✘</span>
                    {countPendiente > 0 && <span style={{ color: '#d97706', fontWeight: '600' }}>{countPendiente}○</span>}
                  </div>
                </div>
                {alumnosDelHorario.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.8rem' }}>Sin alumnos</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', padding: '0.625rem 1rem' }}>
                    {alumnosDelHorario.map((alumno) => {
                      const estadoInfo = getEstadoInfo(alumno.estado);
                      return (
                        <div key={alumno.matricula_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.75rem' }}>
                          <span style={{ color: '#334155' }}>{alumno.alumno_nombre}</span>
                          <span style={{ fontWeight: '600', color: estadoInfo.color }}>
                            {estadoInfo.label === 'Asistió' ? '✓' : estadoInfo.label === 'Falta' ? '✘' : estadoInfo.label === 'Falta Grave' ? '✘✘' : '○'}
                          </span>
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
