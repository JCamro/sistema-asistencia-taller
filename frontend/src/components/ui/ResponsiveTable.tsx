import { type ReactNode } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import DataCard from './DataCard';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  mobileLabel?: string;
  align?: 'left' | 'center' | 'right';
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  emptyMessage?: string;
  actions?: (row: T) => ReactNode;
}

function ResponsiveTable<T>({ columns, data, keyField, emptyMessage = 'Sin datos', actions }: ResponsiveTableProps<T>) {
  const width = useWindowWidth();
  const isMobile = width <= 768;

  if (data.length === 0) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>{emptyMessage}</div>;
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.map((row) => {
          const key = String(row[keyField]);
          return (
            <DataCard key={key} actions={actions ? <div style={{ display: 'flex', gap: '0.5rem' }}>{actions(row)}</div> : undefined}>
              {columns.map(col => (
                <div key={col.key} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '0.125rem' }}>
                    {col.mobileLabel || col.label}
                  </span>
                  <div style={{ fontSize: '0.9375rem', color: '#111827' }}>
                    {col.render ? col.render(row) : String((row as any)[col.key] ?? '-')}
                  </div>
                </div>
              ))}
            </DataCard>
          );
        })}
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          {columns.map(col => (
            <th key={col.key} style={{ padding: '0.75rem 1rem', textAlign: col.align || 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              {col.label}
            </th>
          ))}
          {actions && <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Acciones</th>}
        </tr>
      </thead>
      <tbody>
        {data.map(row => {
          const key = String(row[keyField]);
          return (
            <tr key={key} style={{ borderTop: '1px solid #e5e7eb' }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '1rem', textAlign: col.align || 'left', fontSize: '0.875rem', color: '#374151' }}>
                  {col.render ? col.render(row) : String((row as any)[col.key] ?? '-')}
                </td>
              ))}
              {actions && (
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>{actions(row)}</div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export { ResponsiveTable };
