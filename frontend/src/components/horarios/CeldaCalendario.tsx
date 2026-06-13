import { memo, useState, useCallback } from 'react';

export interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  edad: number | null;
}

export interface Horario {
  id: number;
  taller: number;
  taller_nombre: string;
  profesor: number;
  profesor_nombre: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
  activo: boolean;
  alumnos: Alumno[];
  ocupacion: number;
}

interface CeldaCalendarioProps {
  horario: Horario;
  estaLleno: boolean;
  isSelected: boolean;
  onClick: () => void;
}

const VISIBLE_COUNT = 4;
const MAX_NAME_LENGTH = 18;

function truncarNombre(nombre: string, apellido: string, max: number): string {
  const full = `${nombre} ${apellido}`;
  if (full.length <= max) return full;
  return full.slice(0, max) + '…';
}

const CeldaCalendario = memo(function CeldaCalendario({
  horario,
  estaLleno,
  isSelected,
  onClick,
}: CeldaCalendarioProps) {
  const [expanded, setExpanded] = useState(false);

  const alumnosOrdenados = [...horario.alumnos].sort(
    (a, b) => a.apellido.localeCompare(b.apellido, 'es')
  );
  const visibleAlumnos = expanded
    ? alumnosOrdenados
    : alumnosOrdenados.slice(0, VISIBLE_COUNT);
  const restantes = alumnosOrdenados.length - VISIBLE_COUNT;
  const mostrarExpandir = !expanded && restantes > 0;

  const handleExpandir = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  const bg = estaLleno
    ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
    : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
  const border = estaLleno ? '#fecaca' : '#bbf7d0';
  const textColor = estaLleno ? '#991b1b' : '#166534';
  const subColor = estaLleno ? '#b91c1c' : '#15803d';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      style={{
        height: '100%',
        borderRadius: '8px',
        padding: '0.4rem 0.5rem',
        background: bg,
        border: `1.5px solid ${isSelected ? '#6366f1' : border}`,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header: taller + profesor */}
      <div style={{
        fontSize: '0.7rem', fontWeight: '600',
        color: textColor,
        whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis',
      }} title={`${horario.taller_nombre} — ${horario.profesor_nombre}`}>
        {horario.taller_nombre} — {horario.profesor_nombre}
      </div>

      {/* Body: lista de alumnos */}
      <div style={{
        flex: 1,
        marginTop: '4px',
        fontSize: '0.6rem',
        color: subColor,
        overflow: expanded ? 'auto' : 'hidden',
      }}>
        {visibleAlumnos.map((a) => (
          <div
            key={a.id}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '1.3',
            }}
            title={`${a.apellido}, ${a.nombre}${a.edad !== null ? ` (${a.edad} años)` : ''}`}
          >
            {truncarNombre(a.nombre, a.apellido, MAX_NAME_LENGTH)}
            <span style={{ fontWeight: '600' }}>
              {' '}({a.edad !== null ? a.edad : '?'})
            </span>
          </div>
        ))}
      </div>

      {/* Footer: ocupación + expandir */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 'auto', paddingTop: '4px',
        borderTop: `1px solid ${border}`,
        minHeight: '18px',
      }}>
        <span style={{
          fontSize: '0.6rem', fontWeight: '700',
          display: 'flex', alignItems: 'center', gap: '3px',
          color: estaLleno ? '#dc2626' : '#059669',
        }}>
          {horario.ocupacion ?? 0}/{horario.cupo_maximo}
          {estaLleno && (
            <span style={{
              fontSize: '0.5rem', fontWeight: '700',
              background: '#dc2626', color: 'white',
              padding: '1px 4px', borderRadius: '3px',
              letterSpacing: '0.03em', marginLeft: '4px',
            }}>
              LLENO
            </span>
          )}
        </span>
        {mostrarExpandir && (
          <button
            onClick={handleExpandir}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.55rem', fontWeight: '600',
              color: '#6366f1', padding: '1px 4px',
              borderRadius: '3px', lineHeight: 1,
            }}
          >
            +{restantes} más
          </button>
        )}
        {expanded && (
          <button
            onClick={handleExpandir}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.55rem', fontWeight: '600',
              color: '#6366f1', padding: '1px 4px',
              borderRadius: '3px', lineHeight: 1,
            }}
          >
            Mostrar menos
          </button>
        )}
      </div>
    </div>
  );
});

export default CeldaCalendario;
