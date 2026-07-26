import { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import { getAlumnoDetalle } from '../../api/endpoints';
import { MATRICULA_ESTADOS, ASISTENCIA_ESTADOS, AVATAR } from '../../theme/colors';
import type { AlumnoDetalleResponse } from '../../api/endpoints';

function AlumnoDetallePage() {
  const { alumnoId } = useParams<{ alumnoId: string }>();
  const navigate = useNavigate();
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [data, setData] = useState<AlumnoDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!cicloActual || !alumnoId) return;
    setLoading(true);
    try {
      const response = await getAlumnoDetalle(cicloActual.id, Number(alumnoId));
      setData(response.data);
    } catch (err) {
      console.error('Error fetching alumno detalle:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, alumnoId, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', textAlign: 'center', color: '#6b7280' }}>
        No se encontró el alumno.
      </div>
    );
  }

  const { alumno, matriculas } = data;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader title="Detalle del Alumno" cicloNombre={cicloActual?.nombre} />

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: AVATAR.bg, color: AVATAR.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
            {alumno.apellido.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{alumno.nombre_completo}</h2>
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>DNI: {alumno.dni || '—'} · {alumno.edad ? `${alumno.edad} años` : 'Edad no registrada'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Teléfono</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{alumno.telefono || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{alumno.email || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Estado</div>
            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: alumno.activo ? '#d1fae5' : '#f3f4f6', color: alumno.activo ? '#059669' : '#6b7280' }}>
              {alumno.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Matrículas</h3>
        {matriculas.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>No hay matrículas registradas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {matriculas.map((m) => {
              const estado = MATRICULA_ESTADOS[m.estado] || MATRICULA_ESTADOS.inactiva;
              const progress = Math.min(100, (m.sesiones_consumidas / m.sesiones_contratadas) * 100);
              return (
                <div key={m.id} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{m.taller}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>S/. {m.precio_total}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span title={estado.description} style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: estado.bg, color: estado.color }}>{estado.label}</span>
                      <button
                        onClick={() => navigate(`/matriculas/${m.id}`)}
                        style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer' }}
                      >
                        Ver matrícula
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#ef4444' : '#d4af37', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>{m.sesiones_consumidas}/{m.sesiones_contratadas}</span>
                  </div>
                  {m.asistencias.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {m.asistencias.slice(0, 5).map((a) => {
                        const asistencia = ASISTENCIA_ESTADOS[a.estado] || ASISTENCIA_ESTADOS.sin_registrar;
                        return (
                          <span key={a.id} title={asistencia.description} style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', background: asistencia.bg, color: asistencia.color }}>
                            {a.fecha}
                          </span>
                        );
                      })}
                      {m.asistencias.length > 5 && <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>+{m.asistencias.length - 5} más</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/matriculas')}
        style={{ padding: '0.625rem 1.25rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}
      >
        ← Volver a Matrículas
      </button>
    </div>
  );
}

export default memo(AlumnoDetallePage);
