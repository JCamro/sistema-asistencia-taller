import { memo, useState, useEffect, useCallback } from 'react';
import type { HorarioCalendario, NotaClase } from '../../types';
import { DIAS_SEMANA_LARGO } from '../../utils/constants';
import {
  getNotasClase,
  createNotaClase,
  updateNotaClase,
} from '../../api/portalDocente';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Level2TallerSessionsProps {
  cicloId: number;
  diaSemana: number;
  horarios: HorarioCalendario[];
  cicloInicio: string;
  cicloFin: string;
  onSessionClick: (horarioId: number, fecha: string) => void;
  onBack: () => void;
}

interface Session {
  index: number;
  fecha: string;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
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
  /** Timeline item */
  timelineItem: {
    display: 'flex',
    gap: '1rem',
    position: 'relative' as const,
    padding: '0 0 1rem 0',
  },
  timelineDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    border: '2px solid #bfdbfe',
    flexShrink: 0,
    marginTop: '6px',
  },
  timelineLine: {
    position: 'absolute' as const,
    left: '5px',
    top: '18px',
    width: '2px',
    bottom: '0',
    backgroundColor: '#e2e8f0',
  },
  sessionCard: {
    flex: 1,
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s ease',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  sessionNum: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#1e293b',
  },
  sessionDate: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  notaPreview: {
    fontSize: '0.8rem',
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  notaSection: {
    marginTop: '0.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid #f1f5f9',
  },
  textarea: {
    width: '100%',
    minHeight: '60px',
    padding: '0.4rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    backgroundColor: '#f8fafc',
  },
  actionRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.4rem',
  },
  btnSave: {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
  btnCancel: {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '0.8rem',
    cursor: 'pointer',
    minHeight: '44px',
  },
  btnAddNota: {
    background: 'none',
    border: '1px dashed #cbd5e1',
    borderRadius: '6px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    color: '#64748b',
    cursor: 'pointer',
    minHeight: '44px',
    width: '100%',
    marginTop: '0.25rem',
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getSessionDates(
  diaSemana: number,
  inicio: string,
  fin: string
): Session[] {
  const start = new Date(inicio);
  const end = new Date(fin);
  const sessions: Session[] = [];
  let idx = 0;

  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() === ((diaSemana + 1) % 7)) {
      // JS: 0=Sun..6=Sat → our: 0=Mon..6=Sun
      idx++;
      sessions.push({
        index: idx,
        fecha: current.toISOString().slice(0, 10),
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return sessions;
}

/** Format YYYY-MM-DD to "DD de Mes" */
function formatFecha(fechaStr: string): string {
  const d = new Date(fechaStr + 'T12:00:00');
  const meses = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Level2TallerSessions = memo(function Level2TallerSessions({
  cicloId,
  diaSemana,
  horarios,
  cicloInicio,
  cicloFin,
  onSessionClick,
  onBack,
}: Level2TallerSessionsProps) {
  const [notasByFecha, setNotasByFecha] = useState<Record<string, NotaClase[]>>({});
  const [editingFecha, setEditingFecha] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Use the first horario for timeline (they're grouped by taller from L1)
  const selectedHorario = horarios[0];
  const sessions = selectedHorario
    ? getSessionDates(diaSemana, cicloInicio, cicloFin)
    : [];

  // Fetch notas for each horario
  useEffect(() => {
    if (!selectedHorario) return;
    const fetchNotas = async () => {
      try {
        const allNotas = await getNotasClase(cicloId, selectedHorario.id);
        const grouped: Record<string, NotaClase[]> = {};
        for (const n of allNotas) {
          if (!grouped[n.fecha]) grouped[n.fecha] = [];
          grouped[n.fecha].push(n);
        }
        setNotasByFecha(grouped);
      } catch {
        // Silently fail
      }
    };
    fetchNotas();
  }, [cicloId, selectedHorario]);

  const handleStartEdit = useCallback((fecha: string, contenido: string) => {
    setEditingFecha(fecha);
    setEditContent(contenido);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingFecha(null);
    setEditContent('');
  }, []);

  const handleSaveNota = useCallback(
    async (fecha: string) => {
      if (!selectedHorario) return;
      setSaving(true);
      try {
        const existing = notasByFecha[fecha]?.[0];
        if (existing) {
          const updated = await updateNotaClase(cicloId, existing.id, editContent);
          setNotasByFecha((prev) => ({
            ...prev,
            [fecha]: [updated],
          }));
        } else {
          const created = await createNotaClase(cicloId, selectedHorario.id, fecha, editContent);
          setNotasByFecha((prev) => ({
            ...prev,
            [fecha]: [created],
          }));
        }
        setEditingFecha(null);
      } catch {
        // Silently fail
      } finally {
        setSaving(false);
      }
    },
    [cicloId, selectedHorario, editContent, notasByFecha]
  );

  const handleSessionClick = useCallback(
    (fecha: string) => {
      if (selectedHorario) {
        onSessionClick(selectedHorario.id, fecha);
      }
    },
    [selectedHorario, onSessionClick]
  );

  if (!selectedHorario) {
    return (
      <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>
        Selecciona un taller para ver sus sesiones.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack} className="touch-target">
          ← Volver
        </button>
        <div>
          <div style={styles.title}>{selectedHorario.taller_nombre}</div>
          <div style={styles.subtitle}>
            {DIAS_SEMANA_LARGO[diaSemana]} {selectedHorario.hora_inicio.slice(0, 5)} —{' '}
            {selectedHorario.hora_fin.slice(0, 5)} · {selectedHorario.profesor_nombre}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' }}>
        {sessions.length} sesiones
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative', paddingLeft: '1rem' }}>
        {sessions.map((session, i) => {
          const nota = notasByFecha[session.fecha]?.[0];
          const isEditing = editingFecha === session.fecha;
          const isLast = i === sessions.length - 1;

          return (
            <div key={session.fecha} style={styles.timelineItem}>
              {/* Dot + line */}
              <div style={{ position: 'relative', width: '12px' }}>
                <div style={styles.timelineDot} />
                {!isLast && <div style={styles.timelineLine} />}
              </div>

              {/* Session content */}
              <div
                style={styles.sessionCard}
                onClick={() => handleSessionClick(session.fecha)}
              >
                <div style={styles.sessionHeader}>
                  <span style={styles.sessionNum}>Clase {session.index}</span>
                  <span style={styles.sessionDate}>{formatFecha(session.fecha)}</span>
                </div>

                {nota?.contenido && !isEditing && (
                  <div style={styles.notaPreview}>{nota.contenido}</div>
                )}

                {/* Inline nota editor */}
                <div
                  style={styles.notaSection}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditing ? (
                    <>
                      <textarea
                        style={styles.textarea}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Escribe una nota..."
                        className="touch-target"
                      />
                      <div style={styles.actionRow}>
                        <button
                          style={styles.btnSave}
                          onClick={() => handleSaveNota(session.fecha)}
                          disabled={saving}
                          className="touch-target"
                        >
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          style={styles.btnCancel}
                          onClick={handleCancelEdit}
                          className="touch-target"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      style={styles.btnAddNota}
                      onClick={() =>
                        handleStartEdit(session.fecha, nota?.contenido ?? '')
                      }
                      className="touch-target"
                    >
                      {nota ? 'Editar nota' : '+ Agregar nota'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default Level2TallerSessions;
