import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import { getMatriculaDetalle } from '../../api/endpoints';
import { MATRICULA_ESTADOS, RECIBO_ESTADOS, ASISTENCIA_ESTADOS, BTN_PRIMARY } from '../../theme/colors';
import ReciboDetailModal from '../recibos/ReciboDetailModal';
import type { MatriculaDetalleResponse } from '../../api/endpoints';

function MatriculaDetallePage() {
  const { matriculaId } = useParams<{ matriculaId: string }>();
  const navigate = useNavigate();
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [data, setData] = useState<MatriculaDetalleResponse['matricula'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [reciboDetail, setReciboDetail] = useState<any>(null);
  const [loadingReciboDetail, setLoadingReciboDetail] = useState(false);

  const fetchData = useCallback(async () => {
    if (!cicloActual || !matriculaId) return;
    setLoading(true);
    try {
      const response = await getMatriculaDetalle(cicloActual.id, Number(matriculaId));
      setData(response.data.matricula);
    } catch (err) {
      console.error('Error fetching matricula detalle:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, matriculaId, showApiError]);

  const handleDeleteAsistencia = useCallback(async (asistenciaId: number) => {
    if (!cicloActual) return;
    if (deleteConfirmId !== asistenciaId) {
      setDeleteConfirmId(asistenciaId);
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/asistencias/${asistenciaId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al eliminar');
      showToast('Asistencia eliminada', 'success');
      fetchData();
    } catch (err) {
      showApiError(err);
    } finally {
      setDeleteConfirmId(null);
    }
  }, [cicloActual, deleteConfirmId, fetchData, showToast, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const estado = data ? (MATRICULA_ESTADOS[data.estado] || MATRICULA_ESTADOS.inactiva) : MATRICULA_ESTADOS.inactiva;
  const recibo = data?.recibo ? (RECIBO_ESTADOS[data.recibo.estado] || RECIBO_ESTADOS.sin_recibo) : RECIBO_ESTADOS.sin_recibo;
  const progress = data ? Math.min(100, (data.sesiones_consumidas / data.sesiones_contratadas) * 100) : 0;

  const asistenciasAgrupadas = useMemo(() => {
    if (!data) return [];
    const grupos: Record<string, typeof data.asistencias> = {};
    for (const a of data.asistencias) {
      const fecha = new Date(a.fecha + 'T00:00:00');
      const key = fecha.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(a);
    }
    return Object.entries(grupos).sort(([, itemsA], [, itemsB]) => {
      return new Date(itemsB[0].fecha).getTime() - new Date(itemsA[0].fecha).getTime();
    });
  }, [data?.asistencias]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', textAlign: 'center', color: '#4b5563' }}>
        No se encontró la matrícula.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <PageHeader title="Detalle de Matrícula" cicloNombre={cicloActual?.nombre} />

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden', marginBottom: '1rem' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#fef9e7', borderBottom: '1px solid #fdf3d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{data.alumno_nombre}</h2>
              <p style={{ margin: '0.25rem 0 0', color: '#4b5563', fontSize: '0.875rem' }}>{data.taller}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span title={estado.description} style={{ padding: '0.35rem 1rem', borderRadius: '9999px', fontSize: '0.8125rem', fontWeight: 600, background: estado.bg, color: estado.color, border: `1px solid ${estado.color}22` }}>{estado.label}</span>
              <span title={recibo.description} style={{ padding: '0.35rem 1rem', borderRadius: '9999px', fontSize: '0.8125rem', fontWeight: 600, background: recibo.bg, color: recibo.color, border: `1px solid ${recibo.color}22` }}>{recibo.label}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>Sesiones</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{data.sesiones_consumidas} / {data.sesiones_contratadas}</div>
              <div style={{ marginTop: '0.5rem', height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: progress >= 100 ? '#dc2626' : progress >= 70 ? '#ef4444' : progress >= 30 ? '#f59e0b' : '#10b981',
                  borderRadius: 3,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>Precio total</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>S/. {data.precio_total}</div>
            </div>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>Fecha matrícula</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.fecha_matricula ? data.fecha_matricula.split('T')[0] : '—'}</div>
            </div>
          </div>

          {/* Recibo */}
          {data.recibo && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>Recibo</h3>
                <button
                  onClick={async () => {
                    if (!data.recibo?.id) return;
                    setLoadingReciboDetail(true);
                    try {
                      const token = localStorage.getItem('access_token');
                      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/recibos/${data.recibo.id}/`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) throw new Error('Error al cargar recibo');
                      const json = await res.json();
                      setReciboDetail(json);
                    } catch (err) {
                      showApiError(err);
                    } finally {
                      setLoadingReciboDetail(false);
                    }
                  }}
                  style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: 'none', background: BTN_PRIMARY.background, color: BTN_PRIMARY.color, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Ver Recibo
                </button>
              </div>
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div><div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Número</div><div style={{ fontWeight: 600, color: '#111827' }}>{data.recibo.numero}</div></div>
                <div><div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Monto total</div><div style={{ fontWeight: 600, color: '#111827' }}>S/. {data.recibo.monto_total}</div></div>
                <div><div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Pagado</div><div style={{ fontWeight: 600, color: '#111827' }}>S/. {data.recibo.monto_pagado}</div></div>
                <div><div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Estado</div><div style={{ fontWeight: 600, color: recibo.color }}>{recibo.label}</div></div>
              </div>
            </div>
          )}

          {/* Horarios */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#111827' }}>Horarios</h3>
            {data.horarios.length === 0 ? (
              <div style={{ color: '#4b5563', fontSize: '0.875rem' }}>Sin horarios registrados</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                {data.horarios.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: '#fef9e7', border: '1px solid #fdf3d0', borderRadius: '10px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#d4af37', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                      {h.dia?.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{h.dia}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8b6914' }}>{h.hora_inicio?.substring(0, 5)} – {h.hora_fin?.substring(0, 5)}</div>
                      <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Prof. {h.profesor_nombre}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asistencias */}
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#111827' }}>Historial de asistencias</h3>
            {data.asistencias.length === 0 ? (
              <div style={{ color: '#4b5563', fontSize: '0.875rem' }}>Sin asistencias registradas</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {asistenciasAgrupadas.map(([monthKey, asistenciasMes]) => (
                  <div key={monthKey}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '0.25rem' }}>
                      {monthKey}
                    </div>
                    <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      {asistenciasMes.map((a, idx) => {
                        const asistencia = ASISTENCIA_ESTADOS[a.estado] || ASISTENCIA_ESTADOS.sin_registrar;
                        const fecha = new Date(a.fecha + 'T00:00:00');
                        return (
                          <div key={a.id} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderBottom: idx < asistenciasMes.length - 1 ? '1px solid #f1f5f9' : 'none',
                          }}>
                            <div style={{ minWidth: '90px' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#374151' }}>
                                {fecha.toLocaleDateString('es-PE', { weekday: 'short' })}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                                {a.fecha.split('-').slice(1).reverse().join('/')}
                              </span>
                            </div>

                            <span style={{ fontSize: '0.75rem', color: '#6b7280', minWidth: '50px' }}>{a.horario}</span>

                            {a.es_recuperacion && (
                              <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, background: '#fef9e7', color: '#8b6914' }}>
                                Recup.
                              </span>
                            )}

                            <span style={{
                              padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600,
                              background: asistencia.bg, color: asistencia.color
                            }}>
                              {asistencia.label}
                            </span>

                            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
                              {a.profesor_nombre || '—'}
                            </span>

                            <button
                              onClick={() => navigate(`/asistencias?fecha=${a.fecha}`)}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
                            >
                              Ver
                            </button>

                            <button
                              onClick={() => handleDeleteAsistencia(a.id)}
                              style={{
                                padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                                border: deleteConfirmId === a.id ? '1px solid #dc2626' : '1px solid transparent',
                                background: deleteConfirmId === a.id ? '#fee2e2' : 'transparent',
                                color: deleteConfirmId === a.id ? '#dc2626' : '#ef4444',
                                marginLeft: '0.25rem',
                              }}
                            >
                              {deleteConfirmId === a.id ? 'Confirmar' : 'Eliminar'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/matriculas')}
        style={{ padding: '0.625rem 1.25rem', border: '1px solid #fdf3d0', borderRadius: '10px', background: '#fef9e7', color: '#5c4508', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}
      >
        ← Volver a Matrículas
      </button>

      <ReciboDetailModal
        recibo={reciboDetail}
        loading={loadingReciboDetail}
        onClose={() => setReciboDetail(null)}
      />
    </div>
  );
}

export default memo(MatriculaDetallePage);
