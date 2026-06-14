import { memo, useCallback, useState } from 'react';
import { DIAS_SEMANA_LARGO } from '../../utils/constants';
import type { HorarioCalendario } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FilterState {
  diaSemana: number;
  tallerId: number | null;
  horaInicio: string | null;
}

interface FilterBarProps {
  filter: FilterState;
  horarios: HorarioCalendario[];
  onFilterChange: (filter: FilterState) => void;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    marginBottom: '1rem',
  },
  row: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  fieldGroup: {
    flex: '1 1 180px',
    minWidth: '140px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  select: {
    width: '100%',
    padding: '0.5rem 0.625rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.875rem',
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    minHeight: '44px',
    cursor: 'pointer',
  },
  drawerToggle: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    color: '#64748b',
    fontSize: '0.875rem',
    fontWeight: 500,
    width: '100%',
    marginBottom: '0.5rem',
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getUniqueTalleres(horarios: HorarioCalendario[]): { id: number; nombre: string }[] {
  const map = new Map<number, string>();
  for (const h of horarios) {
    if (!map.has(h.taller_id ?? h.id)) {
      map.set(h.taller_id ?? h.id, h.taller_nombre);
    }
  }
  return Array.from(map.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function getUniqueHoras(horarios: HorarioCalendario[]): string[] {
  const set = new Set<string>();
  for (const h of horarios) {
    const hora = h.hora_inicio.slice(0, 5);
    set.add(hora);
  }
  return Array.from(set).sort();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const FilterBar = memo(function FilterBar({
  filter,
  horarios,
  onFilterChange,
}: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const talleres = getUniqueTalleres(horarios);
  const horas = getUniqueHoras(horarios);

  const handleDiaChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const dia = Number(e.target.value);
      onFilterChange({ diaSemana: dia, tallerId: null, horaInicio: null });
    },
    [onFilterChange]
  );

  const handleTallerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      onFilterChange({
        ...filter,
        tallerId: val ? Number(val) : null,
        horaInicio: null,
      });
    },
    [filter, onFilterChange]
  );

  const handleHoraChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      onFilterChange({ ...filter, horaInicio: val || null });
    },
    [filter, onFilterChange]
  );

  const selects = (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>DÍA</label>
      <select
        style={styles.select}
        value={filter.diaSemana}
        onChange={handleDiaChange}
        className="touch-target"
      >
        {Array.from({ length: 7 }, (_, i) => (
          <option key={i} value={i}>
            {DIAS_SEMANA_LARGO[i]}
          </option>
        ))}
      </select>
    </div>
  );

  const selectsTaller = (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>TALLER</label>
      <select
        style={styles.select}
        value={filter.tallerId ?? ''}
        onChange={handleTallerChange}
        className="touch-target"
      >
        <option value="">Todos</option>
        {talleres.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </div>
  );

  const selectsHora = (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>HORA</label>
      <select
        style={styles.select}
        value={filter.horaInicio ?? ''}
        onChange={handleHoraChange}
        className="touch-target"
      >
        <option value="">Todas</option>
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Desktop: horizontal row (hidden on mobile, shown ≥769px) */}
      <div className="hide-mobile" style={styles.row}>
        {selects}
        {selectsTaller}
        {selectsHora}
      </div>

      {/* Mobile: drawer toggle + collapsible (hidden on desktop) */}
      <div className="hide-desktop">
        <button
          style={styles.drawerToggle}
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="touch-target"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          Filtros
          <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>
            {DIAS_SEMANA_LARGO[filter.diaSemana]}
            {filter.tallerId != null ? ` · ${talleres.find((t) => t.id === filter.tallerId)?.nombre ?? ''}` : ''}
          </span>
        </button>
        {drawerOpen && (
          <div style={styles.drawerContent}>
            {selects}
            {selectsTaller}
            {selectsHora}
          </div>
        )}
      </div>
    </div>
  );
});

export default FilterBar;
