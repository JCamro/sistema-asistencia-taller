import { memo, useState, useEffect, useCallback } from 'react';
import type { HorarioCalendario, NotaDia } from '../../types';
import { DIAS_SEMANA_LARGO } from '../../utils/constants';
import {
  getNotasDia,
  createNotaDia,
  updateNotaDia,
} from '../../api/portalDocente';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Level1DayOverviewProps {
  cicloId: number;
  diaSemana: number;
  horarios: HorarioCalendario[];
  onHorarioClick: (horarioId: number, tallerId: number, horaInicio: string) => void;
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
  sectionHeader: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s ease',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  horarioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f1f5f9',
    minHeight: '44px',
  },
  horarioInfo: {
    fontSize: '0.85rem',
    color: '#64748b',
  },
  horarioBadge: {
    background: '#eff6ff',
    color: '#3b82f6',
    borderRadius: '6px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.8rem',
    fontWeight: 600,
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
  notaText: {
    fontSize: '0.9rem',
    color: '#1e293b',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    padding: '0.5rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    backgroundColor: '#f8fafc',
  },
  actionRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  btnSave: {
    padding: '0.4rem 1rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
  btnCancel: {
    padding: '0.4rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '44px',
  },
  btnAddNota: {
    background: 'none',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    color: '#64748b',
    cursor: 'pointer',
    minHeight: '44px',
    width: '100%',
    marginTop: '0.5rem',
  },
  groupTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#3b82f6',
    marginBottom: '0.25rem',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Level1DayOverview = memo(function Level1DayOverview({
  cicloId,
  diaSemana,
  horarios,
  onHorarioClick,
}: Level1DayOverviewProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [notaDia, setNotaDia] = useState<NotaDia | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotaDia = useCallback(async () => {
    try {
      const notas = await getNotasDia(cicloId, todayStr);
      setNotaDia(notas[0] ?? null);
      setError(null);
    } catch {
      setError('Error al cargar nota del día');
    }
  }, [cicloId, todayStr]);

  useEffect(() => {
    fetchNotaDia();
  }, [fetchNotaDia]);

  const handleStartEdit = useCallback(() => {
    setEditContent(notaDia?.contenido ?? '');
    setEditing(true);
  }, [notaDia]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditContent('');
  }, []);

  const handleSaveNota = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (notaDia) {
        const updated = await updateNotaDia(cicloId, notaDia.id, editContent);
        setNotaDia(updated);
      } else {
        const created = await createNotaDia(cicloId, todayStr, editContent);
        setNotaDia(created);
      }
      setEditing(false);
    } catch {
      setError('Error al guardar nota');
    } finally {
      setSaving(false);
    }
  }, [cicloId, todayStr, notaDia, editContent]);

  const handleHorarioClick = useCallback(
    (h: HorarioCalendario) => {
      onHorarioClick(h.id, h.taller_id, h.hora_inicio.slice(0, 5));
    },
    [onHorarioClick]
  );

  // Group horarios by taller
  const grouped = horarios.reduce<Record<number, { nombre: string; horarios: HorarioCalendario[] }>>(
    (acc, h) => {
      if (!acc[h.taller_id]) {
        acc[h.taller_id] = { nombre: h.taller_nombre, horarios: [] };
      }
      acc[h.taller_id].horarios.push(h);
      return acc;
    },
    {}
  );

  return (
    <div style={styles.container}>
      {/* Title */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
        {DIAS_SEMANA_LARGO[diaSemana]} — {horarios.length} horarios
      </h3>

      {/* Grid of talleres */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {Object.entries(grouped).map(([tallerId, group]) => (
          <div key={tallerId} style={styles.card}>
            <div style={styles.groupTitle}>{group.nombre}</div>
            {group.horarios.map((h) => (
              <div
                key={h.id}
                style={styles.horarioRow}
                onClick={() => handleHorarioClick(h)}
                className="touch-target"
              >
                <div>
                  <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.9rem' }}>
                    {h.hora_inicio.slice(0, 5)} — {h.hora_fin.slice(0, 5)}
                  </div>
                  <div style={styles.horarioInfo}>{h.profesor_nombre}</div>
                </div>
                <div style={styles.horarioBadge}>{h.alumnos_count} alumnos</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Nota del día */}
      <div style={styles.notaSection}>
        <div style={styles.notaHeader}>NOTA DEL DÍA</div>
        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {error}
          </div>
        )}
        {editing ? (
          <>
            <textarea
              style={styles.textarea}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Escribe una nota sobre el día..."
              className="touch-target"
            />
            <div style={styles.actionRow}>
              <button
                style={styles.btnSave}
                onClick={handleSaveNota}
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
        ) : notaDia?.contenido ? (
          <div style={styles.notaText}>{notaDia.contenido}</div>
        ) : (
          <button style={styles.btnAddNota} onClick={handleStartEdit} className="touch-target">
            + Agregar nota
          </button>
        )}
        {notaDia && !editing && (
          <button
            style={{ ...styles.btnAddNota, border: '1px solid #e2e8f0', marginTop: '0.75rem' }}
            onClick={handleStartEdit}
            className="touch-target"
          >
            Editar nota
          </button>
        )}
      </div>
    </div>
  );
});

export default Level1DayOverview;
