import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MatriculaRow from './MatriculaRow';
import { AVATAR, MATRICULA_ESTADOS } from '../../theme/colors';
import type { MatriculaAgrupada, MatriculaAgrupadaItem } from '../../api/endpoints';

interface MatriculaStudentCardProps {
  grupo: MatriculaAgrupada;
  onEdit?: (id: number) => void;
  onDelete?: (id: number, name: string) => void;
  onTraspaso?: (id: number, alumnoNombre: string, taller: string) => void;
}

const BADGE_BASE: React.CSSProperties = { padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '4.5rem', textAlign: 'center' as const };

function MatriculaStudentCard({ grupo, onEdit, onDelete, onTraspaso }: MatriculaStudentCardProps) {
  const navigate = useNavigate();
  const [expandido, setExpandido] = useState(true);
  const [concluidasExpandido, setConcluidasExpandido] = useState(false);
  const totalMatriculas = grupo.matriculas.length;

  const { activas, concluidas } = useMemo(() => {
    const a: MatriculaAgrupadaItem[] = [];
    const c: MatriculaAgrupadaItem[] = [];
    for (const m of grupo.matriculas) {
      if (m.estado === 'concluida') c.push(m);
      else a.push(m);
    }
    return { activas: a, concluidas: c };
  }, [grupo.matriculas]);

  return (
    <div style={{ background: 'white', borderRadius: '10px', border: expandido ? '1px solid #fdf3d0' : '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '0.5rem', boxShadow: expandido ? '0 1px 4px rgba(212,175,55,0.08)' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
      <div
        onClick={() => setExpandido((prev) => !prev)}
        style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: expandido ? '#fef9e7' : '#f9fafb', transition: 'background 0.15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: AVATAR.bg, color: AVATAR.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
            {grupo.alumno_nombre.split(',')[0]?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{grupo.alumno_nombre}</div>
            <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>DNI: {grupo.alumno_dni || '—'} · {totalMatriculas} matrícula{totalMatriculas !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {grupo.activas > 0 && (
            <span title={MATRICULA_ESTADOS.activa.description} style={{ ...BADGE_BASE, background: MATRICULA_ESTADOS.activa.bg, color: MATRICULA_ESTADOS.activa.color }}>
              {grupo.activas} activa{grupo.activas !== 1 ? 's' : ''}
            </span>
          )}
          {grupo.concluidas > 0 && (
            <span title={MATRICULA_ESTADOS.concluida.description} style={{ ...BADGE_BASE, background: MATRICULA_ESTADOS.concluida.bg, color: MATRICULA_ESTADOS.concluida.color }}>
              {grupo.concluidas} concluida{grupo.concluidas !== 1 ? 's' : ''}
            </span>
          )}
          {grupo.sin_procesar > 0 && (
            <span title={MATRICULA_ESTADOS.no_procesado.description} style={{ ...BADGE_BASE, background: MATRICULA_ESTADOS.no_procesado.bg, color: MATRICULA_ESTADOS.no_procesado.color }}>
              {grupo.sin_procesar} sin proc.
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/alumnos/${grupo.alumno_id}`); }}
            style={{ padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Ir a Alumno
          </button>
          <span style={{ color: '#d4af37', fontSize: '1rem', fontWeight: 700, transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', lineHeight: 1 }}>▾</span>
        </div>
      </div>

      {expandido && (
        <div style={{ padding: '0.5rem 1rem' }}>
          {activas.map((m) => (
            <MatriculaRow
              key={m.id}
              matricula={m}
              estadoInfo={MATRICULA_ESTADOS[m.estado] || MATRICULA_ESTADOS.inactiva}
              onEdit={onEdit}
              onDelete={onDelete}
              onTraspaso={(id, taller) => onTraspaso?.(id, grupo.alumno_nombre, taller)}
            />
          ))}
          {concluidas.length > 0 && (
            <>
              <div
                onClick={(e) => { e.stopPropagation(); setConcluidasExpandido(prev => !prev); }}
                style={{
                  margin: '0.4rem 0',
                  paddingTop: '0.4rem',
                  borderTop: '1px dashed #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: '0.6875rem',
                  color: '#6b7280',
                  fontWeight: 500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  userSelect: 'none' as const,
                }}>
                  Concluidas ({concluidas.length}) {concluidasExpandido ? '▾' : '▸'}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#f3f4f6' }} />
              </div>
              {concluidasExpandido && concluidas.map((m) => (
                <MatriculaRow
                  key={m.id}
                  matricula={m}
                  estadoInfo={MATRICULA_ESTADOS[m.estado] || MATRICULA_ESTADOS.inactiva}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onTraspaso={(id, taller) => onTraspaso?.(id, grupo.alumno_nombre, taller)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(MatriculaStudentCard);
