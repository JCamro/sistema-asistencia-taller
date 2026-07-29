import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RECIBO_ESTADOS } from '../../theme/colors';
import { formatLimaDate } from '../../utils/timezone';
import type { MatriculaAgrupadaItem } from '../../api/endpoints';
import './matricula-grid.css';

interface MatriculaRowProps {
  matricula: MatriculaAgrupadaItem;
  estadoInfo: { bg: string; color: string; border: string; label: string; description?: string };
  onEdit?: (id: number) => void;
  onDelete?: (id: number, name: string) => void;
  onTraspaso?: (id: number, taller: string) => void;
  onRecrear?: (id: number) => void;
}

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '0.2rem 0.55rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  background: bg,
  color,
  border: `1.5px solid ${color}40`,
});

function MatriculaRow({ matricula, estadoInfo, onEdit, onDelete, onTraspaso, onRecrear }: MatriculaRowProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const recibo = RECIBO_ESTADOS[matricula.recibo_estado] || RECIBO_ESTADOS.sin_recibo;
  const progress = Math.min(100, (matricula.sesiones_consumidas / matricula.sesiones_contratadas) * 100);
  const progressColor = progress >= 100 ? '#dc2626' : progress >= 70 ? '#f59e0b' : '#10b981';

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleVer = () => {
    setMenuOpen(false);
    navigate(`/matriculas/${matricula.id}`);
  };
  const handleEditar = () => {
    setMenuOpen(false);
    onEdit?.(matricula.id);
  };
  const handleTraspasar = () => {
    setMenuOpen(false);
    onTraspaso?.(matricula.id, matricula.taller);
  };
  const handleEliminar = () => {
    setMenuOpen(false);
    onDelete?.(matricula.id, matricula.taller);
  };
  const handleRecrear = () => {
    setMenuOpen(false);
    onRecrear?.(matricula.id);
  };

  return (
    <div className="matricula-row">
      {/* Taller */}
      <div className="col-taller" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: estadoInfo.bg, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              color: '#111827',
              fontSize: '0.875rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {matricula.taller}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {matricula.taller_tipo === 'instrumento' ? 'Instrumento' : 'Taller'}
          </div>
        </div>
      </div>

      {/* Fecha */}
      <div className="col-fecha" style={{ fontSize: '0.8125rem', color: '#64748b' }}>
        {matricula.fecha_matricula ? formatLimaDate(matricula.fecha_matricula) : '—'}
      </div>

      {/* Avance */}
      <div className="col-avance" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: progressColor,
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span style={{ fontSize: '0.75rem', color: '#374151', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {matricula.sesiones_consumidas} de {matricula.sesiones_contratadas} clases
        </span>
      </div>

      {/* Estado */}
      <div className="col-estado">
        <span title={estadoInfo.description} style={badgeStyle(estadoInfo.bg, estadoInfo.color)}>
          {estadoInfo.label}
        </span>
      </div>

      {/* Pago */}
      <div className="col-pago">
        <span title={recibo.description} style={badgeStyle(recibo.bg, recibo.color)}>
          {recibo.label}
        </span>
      </div>

      {/* Precio */}
      <div className="col-precio" style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 500 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          S/ {parseFloat(matricula.precio_total).toFixed(0)}
        </span>
      </div>

      {/* Acciones */}
      <div className="col-acciones" style={{ position: 'relative' }} ref={menuRef}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Acciones"
          style={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            background: 'white',
            color: '#6b7280',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 4px)',
              zIndex: 10,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              minWidth: 120,
              padding: '0.35rem 0',
            }}
          >
            <button onClick={handleVer} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>
              Ver
            </button>
            {onEdit && (
              <button onClick={handleEditar} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>
                Editar
              </button>
            )}
            {onTraspaso && (
              <button onClick={handleTraspasar} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>
                Traspasar
              </button>
            )}
            {matricula.estado === 'concluida' && onRecrear && (
              <button onClick={handleRecrear} className="touch-target" style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb' }}>
                Rematricular
              </button>
            )}
            {onDelete && (
              <button onClick={handleEliminar} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MatriculaRow);