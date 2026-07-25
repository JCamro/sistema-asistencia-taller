import { memo } from 'react';

interface RecibosFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  estado: string;
  onEstadoChange: (value: string) => void;
  preset: string;
  onPresetChange: (value: string) => void;
}

function RecibosFilterBar({
  search,
  onSearchChange,
  estado,
  onEstadoChange,
  preset,
  onPresetChange,
}: RecibosFilterBarProps) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por número o alumno..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }}
        />
      </div>
      <select value={estado} onChange={(e) => onEstadoChange(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white', minWidth: '130px' }}>
        <option value="todos">Todos</option>
        <option value="pendiente">Pendientes</option>
        <option value="pagado">Pagados</option>
        <option value="anulado">Anulados</option>
      </select>
      <select value={preset} onChange={(e) => onPresetChange(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white', minWidth: '140px' }}>
        <option value="todos">Todas las fechas</option>
        <option value="hoy">Del día</option>
        <option value="semana">De la semana</option>
        <option value="mes">Del mes</option>
      </select>
    </div>
  );
}

export default memo(RecibosFilterBar);
