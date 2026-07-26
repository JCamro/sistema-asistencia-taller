import { memo, useMemo } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth';

interface Horario {
  id: number;
  taller: number;
  taller_nombre: string;
  profesor_nombre: string;
  hora_inicio: string;
}

interface AlumnoHorario {
  matricula_id: number;
  alumno_nombre: string;
  estado: string | null;
}

interface AsistenciasDashboardProps {
  fecha: string;
  horariosDelDia: Horario[];
  alumnosPorHorario: Map<number, AlumnoHorario[]>;
  loading: boolean;
  esFeriado?: boolean;
  motivoFeriado?: string | null;
  erroresPorHorario?: Map<number, boolean>;
  onHorarioClick: (horarioId: number) => void;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatFecha(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const pulseKeyframes = `
@keyframes pulse-skeleton {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

function SkeletonCard() {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ height: '14px', width: '40%', background: '#e5e7eb', borderRadius: '4px', animation: 'pulse-skeleton 1.5s ease-in-out infinite' }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ height: '16px', width: '48px', background: '#e5e7eb', borderRadius: '4px', animation: 'pulse-skeleton 1.5s ease-in-out infinite' }} />
            <div style={{ height: '12px', width: '120px', background: '#e5e7eb', borderRadius: '4px', animation: 'pulse-skeleton 1.5s ease-in-out infinite' }} />
            <div style={{ height: '16px', width: '60px', background: '#e5e7eb', borderRadius: '4px', animation: 'pulse-skeleton 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AsistenciasDashboard({
  fecha,
  horariosDelDia,
  alumnosPorHorario,
  loading,
  esFeriado,
  motivoFeriado,
  erroresPorHorario,
  onHorarioClick,
}: AsistenciasDashboardProps) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;

  const grupos = useMemo(() => {
    const mapa = new Map<string, Horario[]>();
    for (const h of horariosDelDia) {
      const grupo = mapa.get(h.taller_nombre);
      if (grupo) grupo.push(h);
      else mapa.set(h.taller_nombre, [h]);
    }
    for (const [, horarios] of mapa) {
      horarios.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    }
    return mapa;
  }, [horariosDelDia]);

  if (loading) {
    return (
      <>
        <style>{pulseKeyframes}</style>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '0.75rem' : '1rem' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (horariosDelDia.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        No hay horarios programados para este día
      </div>
    );
  }

  return (
    <>
      <style>{pulseKeyframes}</style>
      {esFeriado && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><strong>Feriado:</strong> {motivoFeriado || 'No se registra asistencia'}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '0.75rem' : '1rem' }}>
        {Array.from(grupos.entries()).map(([tallerNombre, horarios]) => (
          <div key={tallerNombre} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', borderLeft: '3px solid #d4af37', paddingLeft: '0.75rem' }}>
                {tallerNombre}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f8fafc', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                {formatFecha(fecha)}
              </span>
            </div>
            <div style={{ padding: '0.5rem' }}>
              {horarios.map((horario, idx) => {
                const alumnos = alumnosPorHorario.get(horario.id) || [];
                const error = erroresPorHorario?.get(horario.id);
                const total = alumnos.length;
                const asistio = alumnos.filter((a) => a.estado === 'asistio').length;
                const falta = alumnos.filter((a) => a.estado === 'falta' || a.estado === 'falta_grave').length;
                const pendiente = total - asistio - falta;
                const hasPending = pendiente > 0;
                const allRegistered = pendiente === 0 && total > 0;
                const noStudents = total === 0;
                const isDisabled = esFeriado || noStudents;

                return (
                  <div
                    key={horario.id}
                    onClick={() => { if (!isDisabled) onHorarioClick(horario.id); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      cursor: isDisabled ? 'default' : 'pointer',
                      background: 'white',
                      borderBottom: idx < horarios.length - 1 ? '1px solid #f1f5f9' : 'none',
                      ...(hasPending && !noStudents && !esFeriado ? { borderLeft: '3px solid #d97706', paddingLeft: 'calc(0.75rem - 3px)' } : {}),
                    }}
                    onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget as HTMLDivElement).style.background = '#fef9e7'; }}
                    onMouseLeave={(e) => { if (!isDisabled) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                  >
                    <span style={{ background: '#fef9e7', color: '#8b6914', padding: '0.2rem 0.5rem', borderRadius: '6px', minWidth: '48px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                      {horario.hora_inicio.substring(0, 5)}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: allRegistered || esFeriado ? '#9ca3af' : '#374151', minWidth: '120px' }}>
                      {horario.profesor_nombre}
                    </span>
                    {noStudents ? (
                      error ? (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>Error al cargar</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Sin alumnos</span>
                      )
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {asistio > 0 && (
                          <span style={{ width: '28px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>
                            {asistio}
                          </span>
                        )}
                        {falta > 0 && (
                          <span style={{ width: '28px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>
                            {falta}
                          </span>
                        )}
                        {pendiente > 0 && (
                          <span style={{ width: '28px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: '#f3f4f6', color: '#6b7280' }}>
                            {pendiente}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default memo(AsistenciasDashboard);
