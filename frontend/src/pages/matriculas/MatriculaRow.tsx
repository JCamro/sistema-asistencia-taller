import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RECIBO_ESTADOS } from '../../theme/colors';
import type { MatriculaAgrupadaItem } from '../../api/endpoints';

interface MatriculaRowProps {
  matricula: MatriculaAgrupadaItem;
  estadoInfo: { bg: string; color: string; label: string; description?: string };
  onEdit?: (id: number) => void;
  onDelete?: (id: number, name: string) => void;
  onTraspaso?: (id: number, taller: string) => void;
}

function MatriculaRow({ matricula, estadoInfo, onEdit, onDelete, onTraspaso }: MatriculaRowProps) {
  const navigate = useNavigate();
  const recibo = RECIBO_ESTADOS[matricula.recibo_estado] || RECIBO_ESTADOS.sin_recibo;
  const progress = Math.min(100, (matricula.sesiones_consumidas / matricula.sesiones_contratadas) * 100);

  return (
    <div style={{ padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', flex: '0 0 auto' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: estadoInfo.color, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.8125rem' }}>{matricula.taller}</div>
          <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{matricula.taller_tipo === 'instrumento' ? 'Instrumento' : 'Taller'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '120px', flexShrink: 0 }}>
        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: progress >= 100 ? '#dc2626' : progress >= 70 ? '#ef4444' : progress >= 30 ? '#f59e0b' : '#10b981',
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{matricula.sesiones_consumidas}/{matricula.sesiones_contratadas}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
        <span title={estadoInfo.description} style={{ padding: '0.15rem 0.45rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600, background: estadoInfo.bg, color: estadoInfo.color }}>
          {estadoInfo.label}
        </span>
        <span title={recibo.description} style={{ padding: '0.15rem 0.45rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600, background: recibo.bg, color: recibo.color }}>
          {recibo.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, marginLeft: 'auto' }}>
        <button
          onClick={() => navigate(`/matriculas/${matricula.id}`)}
          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
        >
          Ver
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(matricula.id)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: '#d4af37', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Editar
          </button>
        )}
        {onTraspaso && (
          <button
            onClick={() => onTraspaso(matricula.id, matricula.taller)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: '#8b6914', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Traspasar
          </button>
        )}
        {onDelete && (
          <>
            <div style={{ width: 1, alignSelf: 'stretch', background: '#e5e7eb', margin: '0 0.15rem' }} />
            <button
              onClick={() => onDelete(matricula.id, matricula.taller)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid transparent', background: 'transparent', color: '#ef4444', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(MatriculaRow);
