import { memo, useState, useCallback } from 'react';
import type { HorarioCalendario } from '../types';

interface CeldaCalendarioProps {
  horario: HorarioCalendario;
  onClick: () => void;
}

const CeldaCalendario = memo(function CeldaCalendario({
  horario,
  onClick,
}: CeldaCalendarioProps) {
  const [expanded, setExpanded] = useState(false);

  // Sort alumnos by apellido alphabetically
  const sorted = [...horario.alumnos].sort((a, b) =>
    a.apellido.localeCompare(b.apellido)
  );

  const visible = expanded ? sorted : sorted.slice(0, 4);
  const remaining = sorted.length - 4;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    []
  );

  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '6px 8px',
        cursor: 'pointer',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
      title={`${horario.taller_nombre} — Prof. ${horario.profesor_nombre}`}
    >
      {/* Header: taller + profesor */}
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#1e293b',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {horario.taller_nombre}
      </div>
      <div
        style={{
          fontSize: '0.65rem',
          color: '#64748b',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '4px',
        }}
      >
        Prof. {horario.profesor_nombre}
      </div>

      {/* Alumnos list */}
      <div
        style={{
          flex: 1,
          fontSize: '0.7rem',
          color: '#334155',
          lineHeight: 1.5,
        }}
      >
        {visible.map((alumno) => (
          <div
            key={alumno.id}
            title={`${alumno.nombre} ${alumno.apellido}`}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {alumno.nombre} ({alumno.edad ?? '?'})
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'auto',
          paddingTop: '2px',
          fontSize: '0.65rem',
          color: '#94a3b8',
          borderTop: '1px solid #f1f5f9',
          minHeight: '20px',
        }}
      >
        <span>{horario.alumnos_count} alumnos</span>
        {remaining > 0 && (
          <button
            onClick={handleToggle}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '0.65rem',
              padding: '4px 4px',
              minHeight: '44px',
              lineHeight: 1,
              fontWeight: 500,
            }}
          >
            {expanded ? 'Ver menos' : `+${remaining} más`}
          </button>
        )}
      </div>
    </div>
  );
});

export default CeldaCalendario;
