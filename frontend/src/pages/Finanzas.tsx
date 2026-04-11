import { useState, useEffect, memo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { getResumenFinanzas, getResumenMensual, getEgresos, getRecibos } from '../api/endpoints';

const FinanzasPage = memo(function FinanzasPage() {
  const { cicloActual } = useCiclo();
  const [activeTab, setActiveTab] = useState<'resumen' | 'ingresos' | 'egresos' | 'mensual'>('resumen');
  const [finanzas, setFinanzas] = useState<any>(null);
  const [resumenMensual, setResumenMensual] = useState<any[]>([]);
  const [egresos, setEgresos] = useState<any[]>([]);
  const [recibos, setRecibos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const [finanzasRes, egresosRes, recibosRes, mensualRes] = await Promise.all([
        getResumenFinanzas(cicloActual.id),
        getEgresos(cicloActual.id),
        getRecibos(cicloActual.id),
        getResumenMensual(cicloActual.id)
      ]);
      setFinanzas(finanzasRes.data);
      setResumenMensual(mensualRes.data);
      // Filter recibos pagados
      setRecibos(recibosRes.data.filter((r: any) => r.estado === 'pagado'));
      setEgresos(egresosRes.data.filter((e: any) => e.estado === 'cancelado'));
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (cicloActual) {
      loadData();
    }
  }, [cicloActual]);

  const formatMonto = (monto: number | string) => {
    const num = typeof monto === 'string' ? parseFloat(monto) : monto;
    if (isNaN(num)) return 'S/. 0.00';
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(num);
  };

  const formatPaquete = (paquete: string) => {
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
  };

  if (!cicloActual) return null;
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'mensual', label: 'Mensual' },
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'egresos', label: 'Egresos' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Finanzas</h1>
        <p style={{ color: '#6b7280' }}>Resumen financiero del ciclo {cicloActual.nombre}</p>
      </div>

      {/* Tabs - Responsive */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', overflowX: 'auto', flexWrap: 'nowrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab.id ? '#d4af37' : 'transparent',
              color: activeTab === tab.id ? '#0a0a0a' : '#6b7280',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Resumen Tab */}
      {activeTab === 'resumen' && finanzas && (
        <div>
          {/* Balance Cards - Responsive */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: '#ecfdf5', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <p style={{ fontSize: '0.75rem', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Ingresos</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#059669', wordBreak: 'break-word' }}>{formatMonto(finanzas.balance.total_ingresos)}</p>
            </div>
            <div style={{ background: '#fef2f2', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
              <p style={{ fontSize: '0.75rem', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Egresos</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626', wordBreak: 'break-word' }}>{formatMonto(finanzas.balance.total_egresos)}</p>
            </div>
            <div style={{ background: '#1f2937', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(31, 41, 55, 0.3)' }}>
              <p style={{ fontSize: '0.75rem', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Ganancia Neta</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#d4af37', wordBreak: 'break-word' }}>{formatMonto(finanzas.balance.ganancia_neta)}</p>
            </div>
          </div>

          {/* Métricas Adicionales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Recibos</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>{finanzas.ingresos.num_recibos || 0}</p>
            </div>
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Ticket Promedio</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>{formatMonto(finanzas.balance.ticket_promedio)}</p>
            </div>
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>% Egresos</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>{finanzas.balance.porcentaje_egresos.toFixed(1)}%</p>
            </div>
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>% Ganancia</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{finanzas.balance.porcentaje_ganancia.toFixed(1)}%</p>
            </div>
          </div>

          {/* Breakdown - Responsive */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Ingresos */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem' }}>Detalle de Ingresos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280' }}>Recibos Pagados</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>{formatMonto(finanzas.ingresos.recibos_pagados)}</span>
                </div>
              </div>
            </div>

            {/* Egresos */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem' }}>Detalle de Egresos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280' }}>Gasto Taller</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatMonto(finanzas.egresos.gasto_taller)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280' }}>Gasto Personal</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatMonto(finanzas.egresos.gasto_personal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280' }}>Pago Profesor (Manual)</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatMonto(finanzas.egresos.pago_profesor_manual)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', background: '#fef2f2', borderRadius: '6px', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#991b1b' }}>Total Egresos</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatMonto(finanzas.egresos.pago_profesor_manual + finanzas.egresos.gasto_taller + finanzas.egresos.gasto_personal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensual Tab */}
      {activeTab === 'mensual' && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Mes</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Recibos</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ingresos</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Egresos</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensual.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay datos mensuales</td></tr>
                ) : (
                  resumenMensual.map((item) => (
                    <tr key={item.mes} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>{item.nombre}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>{item.recibos}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{formatMonto(item.ingresos)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>{formatMonto(item.egresos)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: item.balance >= 0 ? '#059669' : '#dc2626' }}>{formatMonto(item.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {resumenMensual.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1f2937' }}>Total</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>{resumenMensual.reduce((sum, m) => sum + m.recibos, 0)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '1.125rem' }}>{formatMonto(resumenMensual.reduce((sum, m) => sum + m.ingresos, 0))}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: '1.125rem' }}>{formatMonto(resumenMensual.reduce((sum, m) => sum + m.egresos, 0))}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#1f2937', fontSize: '1.125rem' }}>{formatMonto(resumenMensual.reduce((sum, m) => sum + m.balance, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Ingresos Tab */}
      {activeTab === 'ingresos' && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>N°</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Alumno</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Monto</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Fecha</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Paquete</th>
              </tr>
            </thead>
            <tbody>
              {recibos.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay recibos pagados</td></tr>
              ) : (
                recibos.map(recibo => (
                  <tr key={recibo.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{recibo.numero}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{recibo.alumno_nombre || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{formatMonto(recibo.monto_pagado)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{new Date(recibo.fecha_emision).toLocaleDateString('es-PE')}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500, background: '#e0f2fe', color: '#0369a1' }}>
                        {formatPaquete(recibo.paquete_aplicado)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {recibos.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f0fdf4' }}>
                  <td colSpan={2} style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#166534' }}>Total</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '1.125rem' }}>{formatMonto(recibos.reduce((sum, r) => sum + (parseFloat(r.monto_pagado) || 0), 0))}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      )}

      {/* Egresos Tab */}
      {activeTab === 'egresos' && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Monto</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Descripción</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Beneficiario</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {egresos.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay egresos</td></tr>
              ) : (
                egresos.map(egreso => (
                  <tr key={egreso.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500, background: egreso.tipo === 'pago_profesor' ? '#fef2f2' : egreso.tipo === 'gasto_taller' ? '#fefbeb' : '#eff6ff', color: '#dc2626' }}>
                        {egreso.tipo === 'gasto_taller' ? 'Gasto Taller' : egreso.tipo === 'pago_profesor' ? 'Pago Profesor' : 'Gasto Personal'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>{formatMonto(egreso.monto)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{egreso.descripcion || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{egreso.beneficiario || egreso.profesor_nombre || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{new Date(egreso.fecha).toLocaleDateString('es-PE')}</td>
                  </tr>
                ))
              )}
            </tbody>
            {egresos.length > 0 && (
              <tfoot>
                <tr style={{ background: '#fef2f2' }}>
                  <td colSpan={1} style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#991b1b' }}>Total</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: '1.125rem' }}>{formatMonto(egresos.reduce((sum, e) => sum + (parseFloat(e.monto) || 0), 0))}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      )}
    </div>
  );
});

export default FinanzasPage;