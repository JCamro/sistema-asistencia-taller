import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { getApiBaseUrl } from '../utils/api';
import { useWindowWidth } from '../hooks/useWindowWidth';

interface ResultadoPago {
  profesor_id: number;
  profesor: string;
  pago_id: number;
  clases_dictadas: number;
  total_alumnos_asistencias: number;
  monto_profesor: number;
  ganancia_taller: number;
  fecha_inicio?: string;
  fecha_fin?: string;
}

interface DetalleClase {
  id: number;
  horario: number;
  horario_info: string;
  fecha: string;
  profesor_id?: number;
  profesor_nombre?: string;
  num_alumnos: number;
  valor_generado: number | string;
  monto_base: number | string;
  monto_adicional: number | string;
  monto_profesor: number | string;
  ganancia_taller: number | string;
}

interface AlumnoDetalle {
  alumno_id: number;
  alumno_nombre: string;
  precio_sesion: number;
  es_adicional: boolean;
  aporte_profesor: number;
  aporte_generado: number;
}

interface DetalleCompleto {
  horario_info: string;
  fecha: string;
  alumnos: AlumnoDetalle[];
  resumen: {
    num_alumnos: number;
    valor_total_generado: number;
    monto_base: number;
    monto_adicional: number;
    monto_profesor: number;
    ganancia_taller: number;
  };
}

interface PagoProfesorAPI {
  id: number;
  profesor: number;
  profesor_nombre: string;
  horas_calculadas: number;
  total_alumnos_asistencias: number;
  monto_final: number;
  ganancia_taller: number;
}

function PagosProfesoresPage() {
  const apiBase = getApiBaseUrl();
  const { cicloActual, isLoading: isCicloLoading } = useCiclo();
  const { showToast, showApiError } = useToast();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  
  const [resultados, setResultados] = useState<ResultadoPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [selectedPago, setSelectedPago] = useState<ResultadoPago | null>(null);
  const [detalles, setDetalles] = useState<DetalleClase[]>([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [detallesCompletos, setDetallesCompletos] = useState<Record<string, DetalleCompleto>>({});
  const [loadingAlumnos, setLoadingAlumnos] = useState<Set<string>>(new Set());
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [orden, setOrden] = useState<string>('az');

  const fmt = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null) return '0.00';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(n) ? '0.00' : n.toFixed(2);
  };

  const fetchPagos = useCallback(async () => {
    if (!cicloActual) return;
    setLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/pagos-profesores/?ciclo=${cicloActual.id}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&ordering=-id`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const results: PagoProfesorAPI[] = data.results || data;
      setResultados(results.map((p) => ({
        profesor_id: p.profesor,
        profesor: p.profesor_nombre,
        pago_id: p.id,
        clases_dictadas: Number(p.horas_calculadas),
        total_alumnos_asistencias: Number(p.total_alumnos_asistencias),
        monto_profesor: Number(p.monto_final),
        ganancia_taller: Number(p.ganancia_taller || 0),
      })));
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, showApiError]);

  useEffect(() => {
    if (cicloActual && !isCicloLoading) {
      fetchPagos();
    }
  }, [cicloActual, isCicloLoading, fetchPagos]);

  const handleCalcular = async () => {
    if (!cicloActual) return;
    if (!fechaInicio || !fechaFin) {
      showToast('Seleccione fecha de inicio y fin', 'warning');
      return;
    }
    setCalculando(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/pagos-profesores/calcular-periodo/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ciclo_id: cicloActual.id,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err));
      }
      const data = await res.json();
      setResultados(data.resultados || []);
      showToast('Cálculo completado exitosamente', 'success');
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setCalculando(false);
    }
  };

  const handleVerDetalle = async (pago: ResultadoPago) => {
    setSelectedPago(pago);
    setLoadingDetalles(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/pagos-profesores/${pago.pago_id}/detalles/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDetalles(data.detalles || data || []);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setLoadingDetalles(false);
    }
  };

  const toggleRowExpansion = async (detalle: DetalleClase) => {
    const key = `${detalle.horario}-${detalle.fecha}`;
    const newExpanded = new Set(expandedRows);
    
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
      setExpandedRows(newExpanded);
    } else {
      newExpanded.add(key);
      setExpandedRows(newExpanded);
      
      if (!detallesCompletos[key]) {
        setLoadingAlumnos(prev => new Set(prev).add(key));
        const token = localStorage.getItem('access_token');
        const profesorId = detalle.profesor_id ? `&profesor_id=${detalle.profesor_id}` : '';
        try {
          const res = await fetch(
            `${apiBase}/api/pagos-profesores/detalle-clase/?horario_id=${detalle.horario}&fecha=${detalle.fecha}${profesorId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          setDetallesCompletos(prev => ({ ...prev, [key]: data }));
        } catch (err) {
          console.error('Error:', err);
        } finally {
          setLoadingAlumnos(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }
      }
    }
  };

  const totalMonto = resultados.reduce((sum, r) => sum + r.monto_profesor, 0);
  const totalGanancia = resultados.reduce((sum, r) => sum + r.ganancia_taller, 0);
  const totalClases = resultados.reduce((sum, r) => sum + r.clases_dictadas, 0);

  if (isCicloLoading || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
          Pagos a Profesores
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Cálculo de pagos por clase dictada con modelo dinámico
        </p>
      </div>

      {/* Filtros */}
      <div style={{ 
        background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
        padding: '1.25rem', marginBottom: '1.5rem',
        display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fecha Inicio
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{ padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fecha Fin
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            style={{ padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
          />
        </div>
        <button
          onClick={handleCalcular}
          disabled={calculando || !cicloActual}
          style={{
            padding: '0.625rem 1.25rem',
            background: calculando ? '#93c5fc' : '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: calculando ? 'not-allowed' : 'pointer',
          }}
        >
          {calculando ? 'Calculando...' : 'Calcular Pagos'}
        </button>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ordenar por
          </label>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            style={{ padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white', minWidth: '160px' }}
          >
            <option value="az">Profesor (A-Z)</option>
            <option value="za">Profesor (Z-A)</option>
            <option value="mas_clases">Más clases dictadas</option>
            <option value="menos_clases">Menos clases dictadas</option>
          </select>
        </div>
      </div>

      {/* Resumen total */}
      {resultados.length > 0 && (
        <div style={{ 
          display: 'grid', gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem',
        }}>
          <div style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', borderRadius: '12px', border: '1px solid #c7d2fe', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#4338ca' }}>{totalClases}</div>
            <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: '600', marginTop: '0.25rem' }}>Clases Dictadas</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '12px', border: '1px solid #bbf7d0', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#16a34a' }}>S/. {fmt(totalMonto)}</div>
            <div style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: '600', marginTop: '0.25rem' }}>Total a Pagar</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', borderRadius: '12px', border: '1px solid #fde68a', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#d97706' }}>S/. {fmt(totalGanancia)}</div>
            <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '600', marginTop: '0.25rem' }}>Ganancia Taller</div>
          </div>
        </div>
      )}

      {/* Tabla de resultados */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <ResponsiveTable<ResultadoPago>
          columns={[
            { 
              key: 'profesor', 
              label: 'Profesor',
              render: (r) => <span style={{ fontWeight: '600', color: '#111827' }}>{r.profesor}</span>
            },
            { 
              key: 'clases_dictadas', 
              label: 'Clases',
              align: 'center',
              render: (r: ResultadoPago) => (
                <span style={{ background: '#eef2ff', color: '#4338ca', padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '600' }}>{r.clases_dictadas}</span>
              ),
            },
            { 
              key: 'monto_profesor', 
              label: 'Monto Profesor',
              align: 'right',
              render: (r: ResultadoPago) => (
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#16a34a', fontSize: '0.95rem' }}>S/. {fmt(r.monto_profesor)}</span>
              ),
            },
            { 
              key: 'ganancia_taller', 
              label: 'Ganancia Taller',
              align: 'right',
              render: (r: ResultadoPago) => (
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#d97706', fontSize: '0.95rem' }}>S/. {fmt(r.ganancia_taller)}</span>
              ),
            },
          ]}
          data={resultados}
          keyField="pago_id"
          actions={(r) => (
            <button
              onClick={() => handleVerDetalle(r)}
              className="touch-target"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', color: 'white', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
            >
              Ver Detalle
            </button>
          )}
          emptyMessage="No hay pagos calculados. Seleccione un rango de fechas y clic en Calcular Pagos"
        />
      </div>

      {/* Modal de detalle */}
      {selectedPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            {/* Header */}
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '20px 20px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>{selectedPago.profesor}</h2>
                  <p style={{ fontSize: '0.875rem', color: '#a5b4fc' }}>Detalle de clases del {fechaInicio} al {fechaFin}</p>
                </div>
                <button onClick={() => { setSelectedPago(null); setExpandedRows(new Set()); setDetallesCompletos({}); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', color: 'white', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
              </div>
            </div>
            
            {/* Resumen del profesor */}
            <div style={{ padding: isMobile ? '1rem' : '1.25rem 2rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)', borderBottom: '1px solid #c7d2fe', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#4338ca' }}>{selectedPago.clases_dictadas}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>Clases</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#a855f7' }}>{selectedPago.total_alumnos_asistencias}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>Asistencias</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#16a34a' }}>S/. {fmt(selectedPago.monto_profesor)}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>Total Profesor</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#d97706' }}>S/. {fmt(selectedPago.ganancia_taller)}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>Ganancia Taller</div>
              </div>
            </div>

            {/* Lista de clases */}
            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', maxHeight: 'calc(90vh - 220px)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#6b7280', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clases dictadas</h3>
              
              {loadingDetalles ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
              ) : detalles.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '12px' }}>Sin detalles</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {detalles.map((d) => {
                    const key = `${d.horario}-${d.fecha}`;
                    const isExpanded = expandedRows.has(key);
                    const detalleCompleto = detallesCompletos[key];
                    const isLoadingAlumnos = loadingAlumnos.has(key);
                    
                    return (
                      <div key={d.id} style={{ background: 'white', borderRadius: '12px', border: isExpanded ? '2px solid #6366f1' : '1px solid #e5e7eb', overflow: 'hidden', transition: 'all 0.2s' }}>
                        {/* Fila principal clickeable */}
                        <div 
                          onClick={() => toggleRowExpansion(d)}
                          style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'grid', gridTemplateColumns: '100px 1fr repeat(5, 80px) 40px', gap: '0.5rem', alignItems: 'center', background: isExpanded ? '#f5f3ff' : 'white' }}
                        >
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#111827' }}>{d.fecha}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{d.horario_info}</div>
                          <div style={{ textAlign: 'center' }}><span style={{ background: '#fdf4ff', color: '#a855f7', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>{d.num_alumnos}</span></div>
                          <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>S/. {fmt(d.valor_generado)}</div>
                          <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>S/. {fmt(d.monto_base)}</div>
                          <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>+S/. {fmt(d.monto_adicional)}</div>
                          <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '700', color: '#16a34a' }}>S/. {fmt(d.monto_profesor)}</div>
                          <div style={{ textAlign: 'center', color: '#6366f1' }}>{isExpanded ? '▲' : '▼'}</div>
                        </div>
                        
                        {/* Panel expandido con alumnos */}
                        {isExpanded && (
                          <div style={{ padding: '1rem 1.25rem', background: '#fafafa', borderTop: '1px solid #e5e7eb' }}>
                            {isLoadingAlumnos ? (
                              <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>Cargando detalles de alumnos...</div>
                            ) : detalleCompleto ? (
                              <div>
                                {/* Resumen mini */}
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}><strong>Total generado:</strong> <span style={{ color: '#111827' }}>S/. {fmt(detalleCompleto.resumen.valor_total_generado)}</span></div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}><strong>Base:</strong> <span style={{ color: '#111827' }}>S/. {fmt(detalleCompleto.resumen.monto_base)}</span></div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}><strong>Adicional:</strong> <span style={{ color: '#111827' }}>S/. {fmt(detalleCompleto.resumen.monto_adicional)}</span></div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}><strong>Ganancia taller:</strong> <span style={{ color: '#d97706', fontWeight: '600' }}>S/. {fmt(detalleCompleto.resumen.ganancia_taller)}</span></div>
                                </div>
                                
                                {/* Tarjetas de alumnos */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                  {detalleCompleto.alumnos.map((alumno, idx) => (
                                    <div key={alumno.alumno_id} style={{ 
                                      background: 'white', 
                                      borderRadius: '10px', 
                                      padding: '0.875rem', 
                                      border: '2px solid',
                                      borderColor: alumno.es_adicional ? '#fcd34d' : '#86efac',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700' }}>{idx + 1}</div>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>{alumno.alumno_nombre}</div>
                                          {alumno.es_adicional && <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '0.125rem 0.375rem', borderRadius: '4px', fontWeight: '600' }}>ADICIONAL (+50%)</span>}
                                        </div>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                                        <div><span style={{ color: '#6b7280' }}>Valor sesión:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#111827' }}>S/. {fmt(alumno.precio_sesion)}</span></div>
                                        <div><span style={{ color: '#6b7280' }}>Aporte taller:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#d97706' }}>S/. {fmt(alumno.aporte_generado - alumno.aporte_profesor)}</span></div>
                                        <div><span style={{ color: '#6b7280' }}>A profesor:</span> <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#16a34a' }}>S/. {fmt(alumno.aporte_profesor)}</span></div>
                                        <div><span style={{ color: '#6b7280' }}>Generado:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#111827' }}>S/. {fmt(alumno.aporte_generado)}</span></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>No hay datos de alumnos</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PagosProfesoresPage);
