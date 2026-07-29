import { memo, useEffect, useRef, useState } from 'react';
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
  width: '100%',
};

const filterLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.25rem',
  display: 'block',
};

function activeFilterCount(estado: string, taller: number | '', dia: number | '', hora: number | '', sortOrder: string) {
  let count = 0;
  if (estado && estado !== 'todas') count += 1;
  if (taller) count += 1;
  if (dia !== '') count += 1;
  if (hora !== '') count += 1;
  if (sortOrder !== 'recent') count += 1;
  return count;
}

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
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = activeFilterCount(estado, taller, dia, hora, sortOrder);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por alumno o taller"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.25rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }}
        />
      </div>

      <div style={{ position: 'relative' }} ref={panelRef}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          type="button"
          style={{ padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtros {active > 0 && (
            <span style={{ background: '#d4af37', color: '#0f172a', borderRadius: '9999px', padding: '0.05rem 0.4rem', fontSize: '0.75rem', fontWeight: 700, minWidth: '1.2rem', textAlign: 'center' }}>
              {active}
            </span>
          )}
        </button>

        {open && (
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', width: 280, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>
              <label style={filterLabel}>Taller</label>
              <select value={taller} onChange={(e) => onTallerChange(e.target.value ? Number(e.target.value) : '')} style={filterSelect}>
                <option value="">Todos los talleres</option>
                {talleres.map((t) => (<option key={t.id} value={t.id}>{t.nombre}</option>))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={filterLabel}>Día</label>
                <select value={dia} onChange={(e) => onDiaChange(e.target.value !== '' ? Number(e.target.value) : '')} style={filterSelect}>
                  <option value="">Todos</option>
                  {DIAS_GRID.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={filterLabel}>Hora</label>
                <select value={hora} onChange={(e) => onHoraChange(e.target.value !== '' ? Number(e.target.value) : '')} style={filterSelect}>
                  <option value="">Todas</option>
                  {HORAS_GRID.map((h) => (<option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>))}
                </select>
              </div>
            </div>
            <div>
              <label style={filterLabel}>Estado</label>
              <select value={estado} onChange={(e) => onEstadoChange(e.target.value)} style={filterSelect}>
                <option value="todas">Todas</option>
                <option value="activa">Activas</option>
                <option value="por_concluir">Por concluir (≤3 clases)</option>
                <option value="no_procesado">No Procesado</option>
                <option value="inactiva">Inactivas</option>
                <option value="concluida">Concluidas</option>
              </select>
            </div>
            <div>
              <label style={filterLabel}>Ordenar por</label>
              <select value={sortOrder} onChange={(e) => onSortChange(e.target.value as 'recent' | 'oldest' | 'alpha')} style={filterSelect}>
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="alpha">Orden alfabético</option>
              </select>
            </div>
            <button
              onClick={() => { onClear(); setOpen(false); }}
              type="button"
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 12l6-6m-6 6l6 6"/></svg>
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MatriculasFilterBar);
