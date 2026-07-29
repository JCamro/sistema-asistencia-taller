interface EstadoColor { bg: string; color: string; border: string; label: string; description?: string; }

// Outlined suave: fondo tenue + texto fuerte + borde sutil
export const MATRICULA_ESTADOS: Record<string, EstadoColor> = {
  activa:       { bg: '#ecfdf5', color: '#059669', border: '#05966933', label: 'Activa',       description: 'Matrícula activa' },
  concluida:    { bg: '#eff6ff', color: '#2563eb', border: '#2563eb33', label: 'Concluida',    description: 'Todas las sesiones completadas' },
  no_procesado: { bg: '#fffbeb', color: '#d97706', border: '#d9770633', label: 'Sin procesar', description: 'Activa sin recibo generado' },
  inactiva:     { bg: '#f3f4f6', color: '#9ca3af', border: '#9ca3af33', label: 'Inactiva',     description: 'Desactivada' },
};

export const RECIBO_ESTADOS: Record<string, EstadoColor> = {
  pagado:     { bg: '#ecfdf5', color: '#059669', border: '#05966933', label: 'Pagado',     description: 'Recibo pagado' },
  pendiente:  { bg: '#fffbeb', color: '#d97706', border: '#d9770633', label: 'Pendiente',  description: 'Pendiente de pago' },
  anulado:    { bg: '#f3f4f6', color: '#6b7280', border: '#6b728033', label: 'Anulado',    description: 'Recibo anulado' },
  sin_recibo: { bg: '#fef2f2', color: '#dc2626', border: '#dc262633', label: 'Sin recibo', description: 'No se ha generado recibo' },
};

export const ASISTENCIA_ESTADOS: Record<string, EstadoColor> = {
  asistio:      { bg: '#ecfdf5', color: '#059669', border: '#05966933', label: 'Asistió',      description: 'Asistencia registrada' },
  falta:        { bg: '#fffbeb', color: '#d97706', border: '#d9770633', label: 'Falta',        description: 'Falta leve' },
  falta_grave:  { bg: '#fef2f2', color: '#dc2626', border: '#dc262633', label: 'Falta grave',  description: 'Falta grave' },
  sin_registrar:{ bg: '#f9fafb', color: '#9ca3af', border: '#9ca3af33', label: 'Sin registrar', description: 'No se ha registrado asistencia' },
};

export const PAGO_PROFESOR_ESTADOS: Record<string, EstadoColor> = {
  pagado:    { bg: '#ecfdf5', color: '#059669', border: '#05966933', label: 'Pagado',    description: 'Pago realizado' },
  pendiente: { bg: '#fffbeb', color: '#d97706', border: '#d9770633', label: 'Pendiente', description: 'Pago pendiente' },
};

export const EGRESO_ESTADOS: Record<string, EstadoColor> = {
  confirmado: { bg: '#ecfdf5', color: '#059669', border: '#05966933', label: 'Confirmado', description: 'Egreso confirmado' },
  pendiente:  { bg: '#fffbeb', color: '#d97706', border: '#d9770633', label: 'Pendiente',  description: 'Egreso pendiente' },
  cancelado:  { bg: '#fef2f2', color: '#dc2626', border: '#dc262633', label: 'Cancelado',  description: 'Egreso cancelado' },
};

export const AVATAR = { bg: '#374151', color: '#ffffff' };

export const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #d4af37, #c59b2e)',
  color: '#0f172a',
  border: 'none',
  fontWeight: 600,
};
