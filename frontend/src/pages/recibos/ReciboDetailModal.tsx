import { memo } from 'react';

interface Recibo {
  id: number;
  numero: string;
  alumno: number | null;
  alumno_nombre: string;
  alumnos_nombres?: string[];
  fecha_emision: string;
  monto_bruto: number;
  monto_total: number;
  monto_pagado: number;
  descuento: number;
  paquete_aplicado: string;
  paquete_display: string;
  precio_editado: boolean;
  saldo_pendiente: number;
  estado: string;
  metodo_pago?: string;
  updated_at?: string;
  matriculas_detalle?: Array<{
    alumno_nombre: string;
    taller_nombre: string;
    sesiones_contratadas: number;
    monto: number;
  }>;
}

interface ReciboDetailModalProps {
  recibo: Recibo | null;
  loading: boolean;
  onClose: () => void;
}

const th: React.CSSProperties = { padding: '0.4rem 0.65rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '0.4rem 0.65rem', fontSize: '0.8125rem', color: '#334155' };

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'pagado': return { bg: '#d1fae5', color: '#059669' };
    case 'pendiente': return { bg: '#fef3c7', color: '#b45309' };
    case 'anulado': return { bg: '#f3f4f6', color: '#6b7280' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
}

function getPaqueteLabel(paquete: string) {
  const labels: Record<string, string> = {
    'individual': 'Individual',
    'combo_musical_12': 'Combo Musical 12+12',
    'combo_musical_8': 'Combo Musical 8+8',
    'combo_musical_12_8': 'Combo Musical 12+8',
    'mixto_12': 'Mixto 12+12',
    'mixto_8': 'Mixto 8+8',
    'mixto_12_8': 'Mixto 12+8',
    'intensivo_instrumento': 'Intensivo Instrumento',
    'intensivo_taller': 'Intensivo Taller',
  };
  return labels[paquete] || paquete;
}

function formatReciboDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * ReciboDetailModal — Vista de detalle de un recibo
 *
 * Muestra: número, estado, fecha de emisión, método de pago, alumnos,
 * tabla de matrículas asociadas (alumno, taller, sesiones, monto),
 * desglose financiero (bruto, descuento, total, pagado, saldo pendiente),
 * y tipo de paquete aplicado.
 */
function ReciboDetailModal({ recibo, loading, onClose }: ReciboDetailModalProps) {
  if (!recibo) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn 0.2s ease-out' }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'scaleIn 0.2s ease-out' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #f1f5f9', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : (
          <>
            <div style={{ padding: '1.5rem 1.5rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Recibo {recibo.numero}</h2>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600, background: getEstadoColor(recibo.estado).bg, color: getEstadoColor(recibo.estado).color }}>
                    {recibo.estado.charAt(0).toUpperCase() + recibo.estado.slice(1)}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{formatReciboDate(recibo.fecha_emision)}</p>
                {recibo.updated_at && recibo.estado !== 'pendiente' && (
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '2px 0 0' }}>
                    {recibo.estado === 'pagado' ? 'Completado' : 'Anulado'} el {new Date(recibo.updated_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {recibo.metodo_pago && (
                  <span style={{ display: 'inline-block', marginTop: '0.375rem', padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 500, background: '#f1f5f9', color: '#64748b' }}>
                    {recibo.metodo_pago === 'efectivo' ? 'Efectivo' : recibo.metodo_pago === 'transferencia' ? 'Transferencia' : recibo.metodo_pago === 'tarjeta' ? 'Tarjeta' : recibo.metodo_pago === 'yape' ? 'Yape' : recibo.metodo_pago === 'plin' ? 'Plin' : recibo.metodo_pago}
                  </span>
                )}
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                  <div style={{ width: 4, height: 14, borderRadius: 2, background: '#d4af37' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alumno(s)</span>
                </div>
                {recibo.alumnos_nombres && recibo.alumnos_nombres.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {recibo.alumnos_nombres.map((nombre, idx) => (
                      <span key={idx} style={{ padding: '0.35rem 0.65rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 500, color: '#334155', border: '1px solid #f1f5f9' }}>{nombre}</span>
                    ))}
                  </div>
                ) : recibo.alumno_nombre ? (
                  <span style={{ padding: '0.35rem 0.65rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 500, color: '#334155', border: '1px solid #f1f5f9' }}>{recibo.alumno_nombre}</span>
                ) : (
                  <p style={{ color: '#cbd5e1', fontSize: '0.8125rem' }}>Sin alumno específico</p>
                )}
              </div>
              {recibo.matriculas_detalle && recibo.matriculas_detalle.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                    <div style={{ width: 4, height: 14, borderRadius: 2, background: '#d4af37' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matrículas</span>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <th style={th}>Alumno</th>
                          <th style={th}>Taller</th>
                          <th style={{ ...th, width: 60, textAlign: 'center' }}>Ses.</th>
                          <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recibo.matriculas_detalle.map((m, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ ...td, fontWeight: 500 }}>{m.alumno_nombre}</td>
                            <td style={td}>{m.taller_nombre}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{m.sesiones_contratadas}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>S/. {Number(m.monto).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.125rem 1.125rem 1.125rem 1.375rem', border: '1px solid #f1f5f9', borderLeft: '3px solid #d4af37' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#64748b' }}>Monto Bruto</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#334155' }}>S/. {Number(recibo.monto_bruto || 0).toFixed(2)}</span>
                </div>
                {Number(recibo.descuento) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem', padding: '0.3rem 0.6rem', background: '#fef2f2', borderRadius: '6px' }}>
                    <span style={{ color: '#dc2626', fontWeight: 500 }}>Descuento</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#dc2626' }}>-S/. {Number(recibo.descuento).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.625rem', marginTop: '0.25rem', marginBottom: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>Total</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '1.0625rem' }}>S/. {Number(recibo.monto_total).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.8125rem', borderRadius: '6px', background: Number(recibo.monto_pagado || 0) > 0 ? '#ecfdf5' : 'transparent' }}>
                  <span style={{ color: '#64748b' }}>Pagado</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>S/. {Number(recibo.monto_pagado || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', padding: '0.5rem 0.6rem', borderTop: '1px solid #e5e7eb', borderRadius: '6px', background: Number(recibo.saldo_pendiente) > 0 ? '#fef2f2' : 'transparent' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>Saldo Pendiente</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(recibo.saldo_pendiente) > 0 ? '#dc2626' : '#059669', fontSize: '1rem' }}>
                    S/. {Number(recibo.saldo_pendiente || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: recibo.precio_editado ? '#fef9e7' : '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.7rem', color: recibo.precio_editado ? '#8b6914' : '#94a3b8' }}>
                  Paquete: <strong style={{ color: recibo.precio_editado ? '#5c4508' : '#64748b' }}>{getPaqueteLabel(recibo.paquete_aplicado || 'individual')}</strong>
                  {recibo.precio_editado && ' · Precio editado'}
                </span>
              </div>
            </div>
            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={onClose} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(ReciboDetailModal);
