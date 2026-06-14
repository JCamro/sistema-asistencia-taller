import { memo, useEffect, useState, useRef, useCallback } from 'react';
import type { HorarioCalendario } from '../types';

interface DetalleHorarioProps {
  horario: HorarioCalendario | null;
  onClose: () => void;
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function isDesktop(): boolean {
  return window.innerWidth >= 769;
}

function formatHour(timeStr: string): string {
  // "HH:MM:SS" → "HH:MM"
  return timeStr.slice(0, 5);
}

const DetalleHorario = memo(function DetalleHorario({
  horario,
  onClose,
}: DetalleHorarioProps) {
  const [desktop, setDesktop] = useState(isDesktop);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track resize for desktop vs mobile layout
  useEffect(() => {
    const handleResize = () => setDesktop(isDesktop());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!horario) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [horario, onClose]);

  // Close on click outside (for both panel and modal)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!horario) return null;

  const alumnos = [...horario.alumnos].sort((a, b) =>
    a.apellido.localeCompare(b.apellido)
  );
  const diaNombre = DAY_NAMES[horario.dia_semana] ?? '?';

  /* ---- Desktop: side panel ---- */
  if (desktop) {
    return (
      <>
        {/* Overlay */}
        <div
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
            zIndex: 999,
          }}
        />

        {/* Panel */}
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '400px',
            height: '100vh',
            background: '#ffffff',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          <PanelHeader horario={horario} diaNombre={diaNombre} onClose={onClose} />
          <StudentList alumnos={alumnos} />
        </div>
      </>
    );
  }

  /* ---- Mobile: centered modal ---- */
  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}
      >
        <PanelHeader horario={horario} diaNombre={diaNombre} onClose={onClose} />
        <StudentList alumnos={alumnos} />
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Sub-components (internal)                                          */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  horario: HorarioCalendario;
  diaNombre: string;
  onClose: () => void;
}

const PanelHeader = memo(function PanelHeader({
  horario,
  diaNombre,
  onClose,
}: HeaderProps) {
  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: '#1e293b',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {horario.taller_nombre}
        </h3>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#64748b',
            margin: '4px 0 0',
          }}
        >
          Prof. {horario.profesor_nombre}
        </p>
        <p
          style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            margin: '2px 0 0',
          }}
        >
          {diaNombre} {formatHour(horario.hora_inicio)} – {formatHour(horario.hora_fin)}
        </p>
        <p
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            margin: '2px 0 0',
          }}
        >
          {horario.alumnos_count} alumno{horario.alumnos_count !== 1 ? 's' : ''}
        </p>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.25rem',
          cursor: 'pointer',
          color: '#64748b',
          padding: '4px 8px',
          lineHeight: 1,
          minHeight: '44px',
          minWidth: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
});

interface StudentListProps {
  alumnos: { id: number; nombre: string; apellido: string; edad: number | null }[];
}

const StudentList = memo(function StudentList({ alumnos }: StudentListProps) {
  if (alumnos.length === 0) {
    return (
      <div
        style={{
          padding: '2rem 1.25rem',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.85rem',
        }}
      >
        No hay alumnos inscritos en este horario.
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
      <h4
        style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#1e293b',
          margin: '0 0 0.75rem',
        }}
      >
        Alumnos ({alumnos.length})
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {alumnos.map((alumno) => (
          <li
            key={alumno.id}
            style={{
              padding: '6px 0',
              borderBottom: '1px solid #f1f5f9',
              fontSize: '0.85rem',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>
              {alumno.apellido}, {alumno.nombre} ({alumno.edad ?? '?'})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default DetalleHorario;
