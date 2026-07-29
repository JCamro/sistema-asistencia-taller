import { type Nota } from '../../api/endpoints';

function toLimaDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

function groupKey(fecha: string): string {
  const now = new Date();
  const lima = toLimaDate(fecha + 'T12:00:00');
  const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  today.setHours(0, 0, 0, 0);
  const target = new Date(lima);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff <= 6) return 'Esta semana';
  if (diff <= 30) return 'Este mes';
  return 'Anteriores';
}

const GROUP_ORDER = ['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Anteriores'] as const;

function groupNotas(notas: Nota[]): Map<string, Nota[]> {
  const map = new Map<string, Nota[]>();
  for (const n of notas) {
    const key = groupKey(n.fecha);
    const arr = map.get(key) ?? [];
    arr.push(n);
    map.set(key, arr);
  }
  return map;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

export { toLimaDate, groupKey, groupNotas, formatDateShort, GROUP_ORDER };
