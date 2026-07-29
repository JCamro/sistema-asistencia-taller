import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MatriculaRow from './MatriculaRow';
import { AVATAR, MATRICULA_ESTADOS } from '../../theme/colors';
import type { MatriculaAgrupada, MatriculaAgrupadaItem } from '../../api/endpoints';
import './matricula-grid.css';

interface MatriculaStudentCardProps {
  grupo: MatriculaAgrupada;
  onEdit?: (id: number) => void;
  onDelete?: (id: number, name: string) => void;
  onTraspaso?: (id: number, alumnoNombre: string, taller: string) => void;
  onRecrear?: (id: number) => void;
}

function MatriculaStudentCard({ grupo, onEdit, onDelete, onTraspaso, onRecrear }: MatriculaStudentCardProps) {
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
    <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'visible', marginBottom: '0.5rem', position: 'relative' }}>
      <div
        onClick={() => setExpandido((prev) => !prev)}
        className="matricula-card-header"
        style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: '#f9fafb' }}
      >
        <div className="matricula-card-header-info">
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: AVATAR.bg, color: AVATAR.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
            {grupo.alumno_nombre.split(',')[0]?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grupo.alumno_nombre}</div>
            <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>DNI: {grupo.alumno_dni || '—'} · {totalMatriculas} matrícula{totalMatriculas !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/alumnos/${grupo.alumno_id}`); }}
            style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Ver alumno
          </button>
          <span style={{ color: '#6b7280', fontSize: '1.1rem', fontWeight: 700, transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', lineHeight: 1, marginLeft: '0.25rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>
      </div>

      {expandido && (
        <div style={{ padding: '0 1rem 0.75rem' }}>
          {/* Column headers — se oculta en mobile, ver matricula-grid.css */}
          <div className="matricula-header">
            <div className="col-taller">Taller</div>
            <div className="col-fecha">Fecha</div>
            <div className="col-avance">Avance</div>
            <div className="col-estado">Estado</div>
            <div className="col-pago">Pago</div>
            <div className="col-precio">Precio</div>
            <div className="col-acciones" />
          </div>

          {activas.map((m) => (
            <MatriculaRow
              key={m.id}
              matricula={m}
              estadoInfo={MATRICULA_ESTADOS[m.estado] || MATRICULA_ESTADOS.inactiva}
              onEdit={onEdit}
              onDelete={onDelete}
              onTraspaso={(id, taller) => onTraspaso?.(id, grupo.alumno_nombre, taller)}
              onRecrear={onRecrear}
            />
          ))}
          {concluidas.length > 0 && (
            <>
              <div
                onClick={(e) => { e.stopPropagation(); setConcluidasExpandido(prev => !prev); }}
                style={{
                  margin: '0.5rem 0 0.25rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500, userSelect: 'none' as const }}>
                  Ver concluidas ({concluidas.length}) ›
                </span>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
              </div>
              {concluidasExpandido && concluidas.map((m) => (
                <MatriculaRow
                  key={m.id}
                  matricula={m}
                  estadoInfo={MATRICULA_ESTADOS[m.estado] || MATRICULA_ESTADOS.inactiva}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onTraspaso={(id, taller) => onTraspaso?.(id, grupo.alumno_nombre, taller)}
                  onRecrear={onRecrear}
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