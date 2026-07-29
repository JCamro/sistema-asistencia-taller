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
  es_recuperacion?: boolean;
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
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #ede8d8', background: '#f9f7ef' }}>
        <div style={{ height: '14px', width: '40%', background: '#e5e7eb', borderRadius: '4px', animation: 'pulse-skeleton 1.5s ease-in-out infinite' }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: i < 3 ? '1px solid #e2e8f0' : 'none' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f9f7ef', borderBottom: '1px solid #ede8d8' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>
                {tallerNombre}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {formatFecha(fecha)}
              </span>
            </div>
            <div style={{ padding: '0.5rem' }}>
              {horarios.map((horario, idx) => {
                const alumnos = alumnosPorHorario.get(horario.id) || [];
                const error = erroresPorHorario?.get(horario.id);
                const total = alumnos.length;
                const asistio = alumnos.filter((a) => a.estado === 'asistio').length;
                const recuperacion = alumnos.filter((a) => a.estado === 'asistio' && a.es_recuperacion).length;
                const falta = alumnos.filter((a) => a.estado === 'falta' || a.estado === 'falta_grave').length;
                const pendiente = total - asistio - falta;
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
                      padding: '0.625rem 0.75rem',
                      borderRadius: '8px',
                      cursor: isDisabled ? 'default' : 'pointer',
                      background: 'white',
                      borderBottom: idx < horarios.length - 1 ? '1px solid #e2e8f0' : 'none',
                      transition: 'background 200ms ease',
                    }}
                    onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; }}
                    onMouseLeave={(e) => { if (!isDisabled) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#374151', minWidth: '52px', whiteSpace: 'nowrap' }}>
                      {horario.hora_inicio.substring(0, 5)}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280', minWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {horario.profesor_nombre}
                    </span>
                    {noStudents ? (
                      error ? (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', marginLeft: 'auto' }}>Error al cargar</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>Sin alumnos</span>
                      )
                    ) : (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {asistio > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title={recuperacion > 0 ? `${recuperacion} por recuperación` : undefined}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>{asistio}</span>
                          </div>
                        )}
                        {falta > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>{falta}</span>
                          </div>
                        )}
                        {pendiente > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9ca3af' }} />
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>{pendiente}</span>
                          </div>
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
