import { memo, useState, useEffect, useCallback } from 'react';
import type { HorarioCalendario, AsistenciaAlumno, NotaClase } from '../../types';
import { ESTADOS_ASISTENCIA, COLOR_ESTADOS, DIAS_SEMANA_LARGO } from '../../utils/constants';
import {
  getHorarioDetalle,
  getAsistencias,
  getNotasClase,
} from '../../api/portalDocente';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Level3StudentAttendanceProps {
  cicloId: number;
  horarioId: number;
  fecha: string;
  diaSemana: number;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.25rem',
    flexWrap: 'wrap',
  },
  backBtn: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    color: '#64748b',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#1e293b',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginBottom: '0.75rem',
  },
  summary: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  statBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  /** Desktop table row */
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 120px 100px',
    padding: '0.75rem 1rem',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    minHeight: '44px',
  },
  tableHeader: {
    fontWeight: 600,
    color: '#64748b',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  /** Mobile card */
  mobileCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '0.75rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '44px',
  },
  studentName: {
    fontWeight: 500,
    color: '#1e293b',
    fontSize: '0.9rem',
  },
  notaSection: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
  },
  notaHeader: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: '0.5rem',
  },
  notaContent: {
    fontSize: '0.9rem',
    color: '#1e293b',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
  },
  emptyNota: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFecha(fechaStr: string): string {
  const d = new Date(fechaStr + 'T12:00:00');
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
}

function getEstadoColor(estado: string): string {
  return COLOR_ESTADOS[estado] ?? '#64748b';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Level3StudentAttendance = memo(function Level3StudentAttendance({
  cicloId,
  horarioId,
  fecha,
  diaSemana,
  onBack,
}: Level3StudentAttendanceProps) {
  const [horario, setHorario] = useState<HorarioCalendario | null>(null);
  const [asistencias, setAsistencias] = useState<AsistenciaAlumno[]>([]);
  const [notasClase, setNotasClase] = useState<NotaClase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [horarioData, asistenciasData, notasData] = await Promise.all([
        getHorarioDetalle(cicloId, horarioId),
        getAsistencias(cicloId, horarioId, fecha),
        getNotasClase(cicloId, horarioId, fecha),
      ]);
      setHorario(horarioData);
      setAsistencias(asistenciasData);
      setNotasClase(notasData);
    } catch {
      setError('Error al cargar datos de asistencia');
    } finally {
      setLoading(false);
    }
  }, [cicloId, horarioId, fecha]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute summary
  const counts = asistencias.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] || 0) + 1;
    return acc;
  }, {});
  const total = asistencias.length;
  const asistieron = counts['asistio'] ?? 0;
  const faltaron = (counts['ausente'] ?? 0) + (counts['falta_grave'] ?? 0) + (counts['tardanza'] ?? 0);
  const faltasGraves = counts['falta_grave'] ?? 0;

  const nota = notasClase[0];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
        Cargando...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
        {error}
        <button
          onClick={fetchData}
          style={{
            display: 'block',
            margin: '1rem auto',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            cursor: 'pointer',
          }}
          className="touch-target"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack} className="touch-target">
          ← Volver
        </button>
        <div>
          <div style={styles.title}>
            {horario?.taller_nombre ?? 'Taller'}
          </div>
          <div style={styles.subtitle}>
            {DIAS_SEMANA_LARGO[diaSemana]} · {horario?.hora_inicio?.slice(0, 5) ?? ''} —{' '}
            {horario?.hora_fin?.slice(0, 5) ?? ''} · {formatFecha(fecha)}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <div style={{ ...styles.statBox, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
          <span style={{ fontWeight: 700 }}>{asistieron}</span> asistieron
        </div>
        <div style={{ ...styles.statBox, backgroundColor: '#fef2f2', color: '#dc2626' }}>
          <span style={{ fontWeight: 700 }}>{faltaron}</span> faltaron
        </div>
        {faltasGraves > 0 && (
          <div style={{ ...styles.statBox, backgroundColor: '#fff7ed', color: '#ea580c' }}>
            <span style={{ fontWeight: 700 }}>{faltasGraves}</span> faltas graves
          </div>
        )}
        <div style={{ ...styles.statBox, backgroundColor: '#f8fafc', color: '#64748b' }}>
          <span style={{ fontWeight: 700 }}>{total}</span> total
        </div>
      </div>

      {/* Student list — desktop table */}
      <div className="hide-mobile" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ ...styles.tableRow, backgroundColor: '#f8fafc' }}>
          <div style={styles.tableHeader}>Alumno</div>
          <div style={styles.tableHeader}>Estado</div>
          <div style={styles.tableHeader}>Hora</div>
        </div>
        {asistencias.map((a) => (
          <div key={a.alumno_id} style={styles.tableRow}>
            <div style={styles.studentName}>{a.alumno_nombre}</div>
            <div>
              <span style={{ ...styles.badge, backgroundColor: `${getEstadoColor(a.estado)}20`, color: getEstadoColor(a.estado) }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: getEstadoColor(a.estado), display: 'inline-block',
                }} />
                {ESTADOS_ASISTENCIA[a.estado] ?? a.estado}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {a.hora.slice(0, 5)}
            </div>
          </div>
        ))}
        {asistencias.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No hay registros de asistencia para esta sesión.
          </div>
        )}
      </div>

      {/* Student list — mobile cards */}
      <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {asistencias.map((a) => (
          <div key={a.alumno_id} style={styles.mobileCard}>
            <div>
              <div style={styles.studentName}>{a.alumno_nombre}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {a.hora.slice(0, 5)}
              </div>
            </div>
            <span style={{ ...styles.badge, backgroundColor: `${getEstadoColor(a.estado)}20`, color: getEstadoColor(a.estado) }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: getEstadoColor(a.estado), display: 'inline-block',
              }} />
              {ESTADOS_ASISTENCIA[a.estado] ?? a.estado}
            </span>
          </div>
        ))}
        {asistencias.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No hay registros de asistencia para esta sesión.
          </div>
        )}
      </div>

      {/* NotaClase display (read-only) */}
      <div style={styles.notaSection}>
        <div style={styles.notaHeader}>NOTA DE CLASE</div>
        {nota?.contenido ? (
          <div style={styles.notaContent}>{nota.contenido}</div>
        ) : (
          <div style={styles.emptyNota}>Sin nota para esta clase.</div>
        )}
      </div>
    </div>
  );
});

export default Level3StudentAttendance;
