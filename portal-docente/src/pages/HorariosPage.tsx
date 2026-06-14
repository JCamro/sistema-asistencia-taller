import { memo, useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getHorarios } from '../api/portalDocente';
import CeldaCalendario from '../components/CeldaCalendario';
import DetalleHorario from '../components/DetalleHorario';
import type { HorarioCalendario } from '../types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9); // 9..21

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseHour(timeStr: string): number {
  return parseInt(timeStr.split(':')[0], 10);
}

function groupByDay(horarios: HorarioCalendario[]): Map<number, HorarioCalendario[]> {
  const map = new Map<number, HorarioCalendario[]>();
  for (const h of horarios) {
    const existing = map.get(h.dia_semana) ?? [];
    existing.push(h);
    map.set(h.dia_semana, existing);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Grid styles (defined outside component for memo stability)        */
/* ------------------------------------------------------------------ */

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '60px repeat(7, 1fr)',
  gridTemplateRows: '40px repeat(13, minmax(100px, auto))',
  gap: '2px',
  minWidth: '700px',
};

const HEADER_CELL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#1e293b',
  background: '#f8fafc',
  borderBottom: '2px solid #e2e8f0',
  padding: '4px',
};

const HOUR_LABEL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.7rem',
  color: '#64748b',
  background: '#f8fafc',
  borderRight: '1px solid #e2e8f0',
  padding: '2px',
};

/* ------------------------------------------------------------------ */
/*  HorariosPage                                                      */
/* ------------------------------------------------------------------ */

const HorariosPage = memo(function HorariosPage() {
  const cicloActual = useAuthStore((s) => s.cicloActual);
  const [horarios, setHorarios] = useState<HorarioCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHorario, setSelectedHorario] = useState<HorarioCalendario | null>(null);

  useEffect(() => {
    if (!cicloActual) {
      setLoading(false);
      setError('No hay un ciclo seleccionado.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getHorarios(cicloActual.id)
      .then((data) => {
        if (!cancelled) {
          setHorarios(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail ?? err?.message ?? 'Error al cargar horarios');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cicloActual]);

  const handleCellClick = useCallback((horario: HorarioCalendario) => {
    setSelectedHorario(horario);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedHorario(null);
  }, []);

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
        <p>Cargando horarios…</p>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#ef4444' }}>
        <p>{error}</p>
      </div>
    );
  }

  /* ---- Empty state ---- */
  const filtered = horarios.filter(
    (h) => parseHour(h.hora_inicio) >= 9 && parseHour(h.hora_inicio) <= 21
  );
  const grouped = groupByDay(filtered);

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
          Horarios
        </h2>
        <p>No hay horarios registrados para este ciclo.</p>
      </div>
    );
  }

  /* ---- Grid cells ---- */
  const cells: React.ReactNode[] = [];
  const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6];

  for (const dayIdx of DAY_INDICES) {
    const horariosDelDia = grouped.get(dayIdx) ?? [];
    for (const horario of horariosDelDia) {
      const hour = parseHour(horario.hora_inicio);
      const endHour = parseHour(horario.hora_fin);
      const duration = Math.max(endHour - hour, 1);
      const rowStart = (hour - 9) + 2;

      cells.push(
        <div
          key={horario.id}
          style={{
            gridColumn: dayIdx + 2,
            gridRow: `${rowStart} / span ${duration}`,
          }}
        >
          <CeldaCalendario
            horario={horario}
            onClick={() => handleCellClick(horario)}
          />
        </div>
      );
    }
  }

  return (
    <div style={{ padding: '1rem', position: 'relative' }}>
      <h2
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '1rem',
        }}
      >
        Horarios
      </h2>

      <div
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={GRID_STYLE}>
          {/* Top-left corner (empty) */}
          <div style={HEADER_CELL} />

          {/* Day headers */}
          {DAYS.map((day) => (
            <div key={day} style={HEADER_CELL}>
              {day}
            </div>
          ))}

          {/* Hour labels (col 1, rows 2-14) with sticky positioning */}
          {HOURS.map((h) => (
            <div
              key={h}
              style={{
                ...HOUR_LABEL,
                gridColumn: 1,
                gridRow: (h - 9) + 2,
                position: 'sticky',
                left: 0,
                zIndex: 1,
              }}
            >
              {h}:00
            </div>
          ))}

          {/* Calendar cells */}
          {cells}
        </div>
      </div>

      {/* Detail panel/modal */}
      <DetalleHorario
        horario={selectedHorario}
        onClose={handleCloseDetail}
      />
    </div>
  );
});

export default HorariosPage;
