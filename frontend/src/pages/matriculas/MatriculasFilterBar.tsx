import { memo } from 'react';
import type { Taller } from '../../api/endpoints';

const HORAS_GRID = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const DIAS_GRID = [
  { value: 0, label: 'Lunes', abbr: 'Lun' },
  { value: 1, label: 'Martes', abbr: 'Mar' },
  { value: 2, label: 'Miércoles', abbr: 'Mié' },
  { value: 3, label: 'Jueves', abbr: 'Jue' },
  { value: 4, label: 'Viernes', abbr: 'Vie' },
  { value: 5, label: 'Sábado', abbr: 'Sáb' },
  { value: 6, label: 'Domingo', abbr: 'Dom' },
];

interface MatriculasFilterBarProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  taller: number | '';
  onTallerChange: (value: number | '') => void;
  dia: number | '';
  onDiaChange: (value: number | '') => void;
  hora: number | '';
  onHoraChange: (value: number | '') => void;
  estado: string;
  onEstadoChange: (value: string) => void;
  sortOrder: 'recent' | 'oldest' | 'alpha';
  onSortChange: (value: 'recent' | 'oldest' | 'alpha') => void;
  talleres: Taller[];
  onClear: () => void;
}

const filterSelect: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '0.875rem',
  background: 'white',
  minWidth: '130px',
};

/**
 * MatriculasFilterBar — Barra de filtros para la tabla de matrículas
 *
 * Filtros disponibles:
 * - Búsqueda por texto (alumno, taller)
 * - Dropdown de taller (todos los talleres activos)
 * - Día de la semana (0-6, lun-dom)
 * - Hora del día (8-21)
 * - Estado (todas, activas, por concluir, no procesado, inactivas, concluidas)
 * - Orden (más recientes, más antiguos, alfabético)
 */
function MatriculasFilterBar({
  searchText,
  onSearchChange,
  taller,
  onTallerChange,
  dia,
  onDiaChange,
  hora,
  onHoraChange,
  estado,
  onEstadoChange,
  sortOrder,
  onSortChange,
  talleres,
  onClear,
}: MatriculasFilterBarProps) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por alumno, taller..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }}
        />
      </div>
      <select value={taller} onChange={(e) => onTallerChange(e.target.value ? Number(e.target.value) : '')} style={filterSelect}>
        <option value="">Todos los talleres</option>
        {talleres.map((t) => (<option key={t.id} value={t.id}>{t.nombre}</option>))}
      </select>
      <select value={dia} onChange={(e) => onDiaChange(e.target.value !== '' ? Number(e.target.value) : '')} style={filterSelect}>
        <option value="">Todos los días</option>
        {DIAS_GRID.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
      </select>
      <select value={hora} onChange={(e) => onHoraChange(e.target.value !== '' ? Number(e.target.value) : '')} style={filterSelect}>
        <option value="">Todas las horas</option>
        {HORAS_GRID.map((h) => (<option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>))}
      </select>
      <select value={estado} onChange={(e) => onEstadoChange(e.target.value)} style={filterSelect}>
        <option value="todas">Todas</option>
        <option value="activa">Activas</option>
        <option value="por_concluir">Por concluir (≤3 clases)</option>
        <option value="no_procesado">No Procesado</option>
        <option value="inactiva">Inactivas</option>
        <option value="concluida">Concluidas</option>
      </select>
      <select value={sortOrder} onChange={(e) => onSortChange(e.target.value as 'recent' | 'oldest' | 'alpha')} style={filterSelect}>
        <option value="recent">Más recientes</option>
        <option value="oldest">Más antiguos</option>
        <option value="alpha">Orden alfabético</option>
      </select>
      <button
        onClick={onClear}
        style={{ ...filterSelect, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6b7280' }}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 12l6-6m-6 6l6 6"/></svg>
        Limpiar filtros
      </button>
    </div>
  );
}

export default memo(MatriculasFilterBar);
