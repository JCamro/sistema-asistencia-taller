import { type Nota } from '../../api/endpoints';
import { BellIcon } from './icons';

function StatsBar({ notas }: { notas: Nota[] }) {
  const total = notas.length;
  const unreadRecordatorios = notas.filter(n => n.es_recordatorio && !n.leida).length;
  const recordatorios = notas.filter(n => n.es_recordatorio).length;

  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>
      <span><strong style={{ color: '#374151', fontWeight: 600 }}>{total}</strong> {total === 1 ? 'resultado' : 'resultados'}</span>
      {unreadRecordatorios > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4af37' }} />
          <strong style={{ color: '#92400e', fontWeight: 600 }}>{unreadRecordatorios}</strong> recordatorio{unreadRecordatorios !== 1 ? 's' : ''} sin leer
        </span>
      )}
      {recordatorios > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <BellIcon size={11} />
          <strong style={{ color: '#374151', fontWeight: 600 }}>{recordatorios}</strong> recordatorio{recordatorios !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

export { StatsBar };
