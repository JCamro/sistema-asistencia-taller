/** Day-of-week number → Spanish short name (0=Lunes, …, 6=Domingo). */
export const DIAS_SEMANA: Record<number, string> = {
  0: 'Lun',
  1: 'Mar',
  2: 'Mié',
  3: 'Jue',
  4: 'Vie',
  5: 'Sáb',
  6: 'Dom',
};

/** Day-of-week number → Spanish long name. */
export const DIAS_SEMANA_LARGO: Record<number, string> = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo',
};

/** Estado de asistencia → Spanish display text. */
export const ESTADOS_ASISTENCIA: Record<string, string> = {
  asistio: 'Asistió',
  ausente: 'Faltó',
  falta_grave: 'Falta Grave',
  tardanza: 'Tardanza',
  justificado: 'Justificado',
};

/** Estado de asistencia → color (CSS). */
export const COLOR_ESTADOS: Record<string, string> = {
  asistio: '#22c55e',
  ausente: '#ef4444',
  falta_grave: '#f97316',
  tardanza: '#eab308',
  justificado: '#3b82f6',
};
