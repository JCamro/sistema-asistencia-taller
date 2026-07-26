interface EstadoColor { bg: string; color: string; label: string; description?: string; }

export const MATRICULA_ESTADOS: Record<string, EstadoColor> = {
  activa:       { bg: '#fef9e7', color: '#8b6914', label: 'Activa',       description: 'Matrícula activa' },
  concluida:    { bg: '#fdf3d0', color: '#92400e', label: 'Concluida',    description: 'Todas las sesiones completadas' },
  no_procesado: { bg: '#fffbeb', color: '#b45309', label: 'Sin procesar', description: 'Activa sin recibo generado' },
  inactiva:     { bg: '#f3f4f6', color: '#6b7280', label: 'Inactiva',     description: 'Desactivada' },
};

export const RECIBO_ESTADOS: Record<string, EstadoColor> = {
  pagado:     { bg: '#d1fae5', color: '#059669', label: 'Pagado',     description: 'Recibo pagado' },
  pendiente:  { bg: '#fef3c7', color: '#d97706', label: 'Pendiente',  description: 'Pendiente de pago' },
  anulado:    { bg: '#fee2e2', color: '#dc2626', label: 'Anulado',    description: 'Recibo anulado' },
  sin_recibo: { bg: '#f3f4f6', color: '#9ca3af', label: 'Sin recibo', description: 'No se ha generado recibo' },
};

export const ASISTENCIA_ESTADOS: Record<string, EstadoColor> = {
  asistio: { bg: '#d1fae5', color: '#059669', label: 'Asistió', description: 'Asistencia registrada' },
  falta: { bg: '#fef3c7', color: '#d97706', label: 'Falta', description: 'Falta leve' },
  falta_grave: { bg: '#fee2e2', color: '#dc2626', label: 'Falta grave', description: 'Falta grave' },
  sin_registrar: { bg: '#f3f4f6', color: '#9ca3af', label: 'Sin registrar', description: 'No se ha registrado asistencia' },
};

export const AVATAR = { bg: '#fef9e7', color: '#8b6914' };

export const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #d4af37, #c59b2e)',
  color: '#0f172a',
  border: 'none',
  fontWeight: 600,
};
