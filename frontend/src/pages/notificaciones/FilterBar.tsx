import { memo, useEffect, type CSSProperties } from 'react';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { SearchIcon } from './icons';

interface FilterBarProps {
  type: 'notas' | 'recordatorios';
  readStatus: 'todas' | 'no_leidas';
  onTypeChange: (v: 'notas' | 'recordatorios') => void;
  onReadStatusChange: (v: 'todas' | 'no_leidas') => void;
  onSearchChange: (v: string) => void;
}

const FilterBar = memo(function FilterBar({ type, readStatus, onTypeChange, onReadStatusChange, onSearchChange }: FilterBarProps) {
  const { searchText, setSearchText, debouncedValue } = useDebouncedSearch();

  useEffect(() => {
    onSearchChange(debouncedValue);
  }, [debouncedValue, onSearchChange]);

  const pill = (active: boolean, accent?: boolean): CSSProperties => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '9999px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    border: 'none',
    background: active ? (accent ? '#d4af37' : '#111827') : '#f3f4f6',
    color: active ? 'white' : '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Search */}
      <div style={{ flex: '1 1 200px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Buscar por título o contenido..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{
            width: '100%',
            padding: '0.55rem 0.75rem 0.55rem 2.25rem',
            border: '1.5px solid #e5e7eb',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            background: 'white',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#d4af37')}
          onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
        />
      </div>

      {/* Type: Notas / Recordatorios */}
      <div style={{ display: 'flex', gap: '0.3rem', background: '#f9fafb', borderRadius: '9999px', padding: '3px' }}>
        {(['notas', 'recordatorios'] as const).map(v => (
          <button key={v} onClick={() => onTypeChange(v)} style={pill(type === v, v === 'recordatorios' && type === 'recordatorios')}>
            {v === 'notas' ? 'Notas' : 'Recordatorios'}
          </button>
        ))}
      </div>

      {/* Read status — ONLY for recordatorios */}
      {type === 'recordatorios' && (
        <div style={{ display: 'flex', gap: '0.3rem', background: '#f9fafb', borderRadius: '9999px', padding: '3px' }}>
          {(['todas', 'no_leidas'] as const).map(v => (
            <button key={v} onClick={() => onReadStatusChange(v)} style={pill(readStatus === v)}>
              {v === 'todas' ? 'Todas' : 'No leídas'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export { FilterBar };
export type { FilterBarProps };
