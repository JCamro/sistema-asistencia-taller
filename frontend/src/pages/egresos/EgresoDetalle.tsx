import { memo } from 'react';
import Badge from '../../components/ui/Badge';
import { EGRESO_ESTADOS } from '../../theme/colors';
import { formatMonto } from '../../utils/formatters';
import type { Egreso } from '../../api/endpoints';

interface EgresoDetalleProps {
  egreso: Egreso | null;
  onClose: () => void;
}

const sectionTitle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' };
const accentBar: React.CSSProperties = { width: 4, height: 14, borderRadius: 2, background: '#d4af37' };
const sectionLabel: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const fieldRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid #f8fafc' };
const fieldLabel: React.CSSProperties = { fontSize: '0.75rem', color: '#94a3b8' };
const fieldValue: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: '#1f2937', textAlign: 'right', maxWidth: '65%', wordBreak: 'break-word' };

function EgresoDetalle({ egreso, onClose }: EgresoDetalleProps) {
  if (!egreso) return null;

  const esPersonal = egreso.tipo === 'gasto_personal' || egreso.tipo === 'pago_profesor';
  const estadoInfo = EGRESO_ESTADOS[egreso.estado] || EGRESO_ESTADOS.pendiente;
  const metodoLabel = egreso.metodo_pago === 'efectivo' ? 'Efectivo'
    : egreso.metodo_pago === 'transferencia' ? 'Transferencia'
    : egreso.metodo_pago === 'yape' ? 'Yape'
    : egreso.metodo_pago === 'plin' ? 'Plin' : egreso.metodo_pago;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Detalle del Egreso</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#e5e7eb', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <Badge bg={esPersonal ? '#fef2f2' : '#fffbeb'} color={esPersonal ? '#dc2626' : '#d97706'} label={egreso.tipo_display} size="sm" />
            <Badge bg={estadoInfo.bg} color={estadoInfo.color} label={estadoInfo.label} description={estadoInfo.description} size="sm" />
          </div>

          <div style={{ background: '#fafbfc', borderRadius: '12px', padding: '1rem', border: '1.5px solid #c8ccd4', marginBottom: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Monto</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{formatMonto(egreso.monto)}</div>
          </div>

          <div style={sectionTitle}><div style={accentBar} /><span style={sectionLabel}>Información</span></div>
          <div style={{ background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4', padding: '0 0.75rem', marginBottom: '1rem' }}>
            {egreso.descripcion && (
              <div style={fieldRow}>
                <span style={fieldLabel}>Descripción</span>
                <span style={{ ...fieldValue, fontSize: '0.8125rem' }}>{egreso.descripcion}</span>
              </div>
            )}
            <div style={fieldRow}>
              <span style={fieldLabel}>Fecha</span>
              <span style={fieldValue}>{new Date(egreso.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div style={{ ...fieldRow, borderBottom: 'none' }}>
              <span style={fieldLabel}>Método de pago</span>
              <span style={fieldValue}>{metodoLabel}</span>
            </div>
          </div>

          {egreso.tipo === 'gasto_taller' && egreso.categoria && (
            <>
              <div style={sectionTitle}><div style={accentBar} /><span style={sectionLabel}>Detalle</span></div>
              <div style={{ background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4', padding: '0 0.75rem', marginBottom: '1rem' }}>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Categoría</span>
                  <span style={fieldValue}>{egreso.categoria}</span>
                </div>
                {egreso.beneficiario && (
                  <div style={{ ...fieldRow, borderBottom: 'none' }}>
                    <span style={fieldLabel}>Beneficiario</span>
                    <span style={fieldValue}>{egreso.beneficiario}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {esPersonal && (
            <>
              <div style={sectionTitle}><div style={accentBar} /><span style={sectionLabel}>Detalle</span></div>
              <div style={{ background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4', padding: '0 0.75rem', marginBottom: '1rem' }}>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Profesor</span>
                  <span style={fieldValue}>{egreso.profesor_nombre || <span style={{ color: '#cbd5e1', fontWeight: 400 }}>Sin profesor asociado</span>}</span>
                </div>
                {egreso.beneficiario && (
                  <div style={{ ...fieldRow, borderBottom: 'none' }}>
                    <span style={fieldLabel}>Beneficiario</span>
                    <span style={fieldValue}>{egreso.beneficiario}</span>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default memo(EgresoDetalle);
