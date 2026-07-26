import { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import { getProfesorDetalle } from '../../api/endpoints';
import { AVATAR, BTN_PRIMARY } from '../../theme/colors';
import { formatMonto } from '../../utils/formatters';
import type { ProfesorDetalleResponse } from '../../api/endpoints';

function ProfesorDetallePage() {
  const { profesorId } = useParams<{ profesorId: string }>();
  const navigate = useNavigate();
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [data, setData] = useState<ProfesorDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!cicloActual || !profesorId) return;
    setLoading(true);
    try {
      const response = await getProfesorDetalle(cicloActual.id, Number(profesorId));
      setData(response.data);
    } catch (err) {
      console.error('Error fetching profesor detalle:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, profesorId, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', background: 'white', borderRadius: 12, border: '1px solid #f1f5f9', textAlign: 'center', color: '#6b7280' }}>
        No se encontró el profesor.
      </div>
    );
  }

  const { profesor } = data;
  const totalHorarios = profesor.horarios.length;
  const totalPagado = profesor.pagos.reduce((sum, p) => sum + parseFloat(p.monto_final), 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader title="Detalle del Profesor" cicloNombre={cicloActual?.nombre} />

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f1f5f9', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: AVATAR.bg, color: AVATAR.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
            {profesor.apellido.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{profesor.nombre_completo}</h2>
              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: profesor.activo ? '#d1fae5' : '#f3f4f6', color: profesor.activo ? '#059669' : '#6b7280' }}>
                {profesor.activo ? 'Activo' : 'Inactivo'}
              </span>
              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: profesor.es_gerente ? '#fef9e7' : AVATAR.bg, color: profesor.es_gerente ? '#8b6914' : AVATAR.color }}>
                {profesor.es_gerente ? 'Gerente' : 'Profesor'}
              </span>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>DNI: {profesor.dni || '—'} · {profesor.edad ? `${profesor.edad} años` : 'Edad no registrada'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Teléfono</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{profesor.telefono || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</div>
            <div style={{ fontWeight: 600, color: '#111827', wordBreak: 'break-all' }}>{profesor.email || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Horarios</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#d4af37' }}>{totalHorarios}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Pagos (12m)</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#059669' }}>{formatMonto(totalPagado)}</div>
          </div>
        </div>

        {profesor.observaciones && (
          <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: 10, marginBottom: '1.5rem', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.75rem', color: '#8b6914', marginBottom: '0.25rem' }}>Observaciones</div>
            <div style={{ color: '#78350f', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{profesor.observaciones}</div>
          </div>
        )}

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Horarios</h3>
        {profesor.horarios.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>No tiene horarios asignados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {profesor.horarios.map(h => (
              <div key={h.id} style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{h.taller}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{h.dia} · {h.hora_inicio.slice(0, 5)} – {h.hora_fin.slice(0, 5)}</div>
                </div>
                <button
                  onClick={() => navigate(`/talleres/${h.taller_id}`)}
                  style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer' }}
                >
                  Ver taller
                </button>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Pagos (últimos 12 meses)</h3>
        {profesor.pagos.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>No hay pagos registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {profesor.pagos.map(p => (
              <div key={p.id} style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                    {p.fecha_inicio ? new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE') : 'Sin fecha'} — {p.fecha_fin ? new Date(p.fecha_fin + 'T00:00:00').toLocaleDateString('es-PE') : '—'}
                  </span>
                  <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.875rem' }}>{formatMonto(parseFloat(p.monto_final))}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span>{p.horas_calculadas} h</span>
                  <span>{p.total_alumnos_asistencias} asistencias</span>
                  <span style={{ textTransform: 'capitalize', padding: '0.1rem 0.45rem', borderRadius: 4, background: p.estado === 'pagado' ? '#d1fae5' : p.estado === 'anulado' ? '#fee2e2' : '#fef3c7', color: p.estado === 'pagado' ? '#059669' : p.estado === 'anulado' ? '#dc2626' : '#d97706', fontSize: '0.65rem', fontWeight: 600 }}>{p.estado}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => navigate('/profesores')}
          style={{ padding: '0.625rem 1.25rem', border: '1px solid #e5e7eb', borderRadius: 10, background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Volver a Profesores
        </button>
        <button
          onClick={() => navigate('/pagos-profesores')}
          style={{ padding: '0.625rem 1.25rem', border: 'none', borderRadius: 10, background: BTN_PRIMARY.background, color: BTN_PRIMARY.color, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Pagos Profesores
        </button>
      </div>
    </div>
  );
}

export default memo(ProfesorDetallePage);
