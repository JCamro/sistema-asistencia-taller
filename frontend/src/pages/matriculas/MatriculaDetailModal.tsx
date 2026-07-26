import { useState, useEffect, useCallback, memo } from 'react';
import api from '../../api/axios';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { ASISTENCIA_ESTADOS } from '../../theme/colors';
import type { Matricula } from '../../api/endpoints';

interface AsistenciaDetalle {
  id: number;
  profesor_nombre: string;
  fecha: string;
  hora: string;
  estado: string;
  observacion: string;
  es_recuperacion: boolean;
  horario_hora_inicio: string;
  horario_hora_fin: string;
}

interface HorarioDetalle {
  id: number;
  horario_detalle: {
    taller: string;
    profesor: string;
    dia: string;
    hora_inicio: string;
    hora_fin: string;
  };
}

interface MatriculaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  matriculaId: number | null;
  cicloId?: number | null;
  modo?: 'asistencias' | 'horarios';
}

const th: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: '#1f2937' };

/**
 * MatriculaDetailModal — Vista de detalle de una matrícula
 *
 * Tiene dos modos (vía prop `modo`):
 * - "asistencias": muestra tabla de asistencias del alumno con contadores
 *   (asistió, falta, falta grave) y permite eliminar registros individuales
 *   con doble confirmación.
 * - "horarios": muestra los horarios semanales asociados a la matrícula.
 */
function MatriculaDetailModal({ isOpen, onClose, matriculaId, cicloId, modo = 'asistencias' }: MatriculaDetailModalProps) {
  const { showToast, showApiError } = useToast();
  const [matricula, setMatricula] = useState<Matricula | null>(null);
  const [asistencias, setAsistencias] = useState<AsistenciaDetalle[]>([]);
  const [horarios, setHorarios] = useState<HorarioDetalle[]>([]);
  const [loading, setLoading] = useState(false);
  const [eliminandoAsistenciaId, setEliminandoAsistenciaId] = useState<number | null>(null);
  const [eliminandoAsistenciaInfo, setEliminandoAsistenciaInfo] = useState<string>('');
  const [segundaConfirmacion, setSegundaConfirmacion] = useState(false);

  const fetchAsistencias = useCallback(async (id: number) => {
    setLoading(true);
    setAsistencias([]);
    try {
      const response = await api.get(`/asistencias/?matricula=${id}`);
      const jsonData = response.data.results || response.data;
      const lista = Array.isArray(jsonData) ? (jsonData as AsistenciaDetalle[]) : [];
      setAsistencias(lista.sort((a, b) => {
        if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
        return b.hora.localeCompare(a.hora);
      }));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHorarios = useCallback(async (id: number) => {
    setLoading(true);
    setHorarios([]);
    try {
      const response = await api.get(`/matriculas/${id}/horarios/`);
      const jsonData = response.data.results || response.data;
      setHorarios(Array.isArray(jsonData) ? (jsonData as HorarioDetalle[]) : []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !matriculaId || !cicloId) {
      setMatricula(null);
      setAsistencias([]);
      setHorarios([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await api.get(`/matriculas/${matriculaId}/`);
        if (!cancelled) setMatricula(response.data);
      } catch (err) {
        console.error('Error loading matricula:', err);
      }
    };
    load();
    if (modo === 'asistencias') fetchAsistencias(matriculaId);
    else fetchHorarios(matriculaId);
    return () => { cancelled = true; };
  }, [isOpen, matriculaId, cicloId, modo, fetchAsistencias, fetchHorarios]);

  const confirmarEliminarAsistencia = (a: AsistenciaDetalle) => {
    setEliminandoAsistenciaId(a.id);
    setEliminandoAsistenciaInfo(`${a.fecha} ${a.horario_hora_inicio?.substring(0, 5)} a ${a.horario_hora_fin?.substring(0, 5)}`);
    setSegundaConfirmacion(false);
  };

  const handleEliminarAsistencia = async () => {
    if (!eliminandoAsistenciaId || !segundaConfirmacion) return;
    try {
      await api.delete(`/asistencias/${eliminandoAsistenciaId}/`);
      setAsistencias((prev) => prev.filter((a) => a.id !== eliminandoAsistenciaId));
      showToast('Asistencia eliminada', 'success');
    } catch (err) {
      showApiError(err);
    } finally {
      setEliminandoAsistenciaId(null);
      setSegundaConfirmacion(false);
    }
  };

  const cancelEliminarAsistencia = () => {
    setEliminandoAsistenciaId(null);
    setSegundaConfirmacion(false);
  };

  if (!isOpen || !matriculaId) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '650px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {modo === 'asistencias' ? 'Asistencias' : 'Horario'} del Alumno
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.125rem 0 0' }}>
              {matricula ? `${matricula.alumno_nombre} · ${matricula.taller_nombre}` : '...'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>
          ) : modo === 'asistencias' ? (
            asistencias.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#cbd5e1' }}>No hay asistencias registradas</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Asistió', count: asistencias.filter((a) => a.estado === 'asistio').length, bg: '#ecfdf5', color: '#059669' },
                    { label: 'Falta', count: asistencias.filter((a) => a.estado === 'falta').length, bg: '#fef3c7', color: '#d97706' },
                    { label: 'Falta Grave', count: asistencias.filter((a) => a.estado === 'falta_grave').length, bg: '#fef2f2', color: '#dc2626' },
                  ].map((s) => (
                    <span key={s.label} style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, background: s.bg, color: s.color }}>
                      {s.count} {s.label}
                    </span>
                  ))}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Horario</th>
                      <th style={th}>Estado</th>
                      <th style={th}>Profesor</th>
                      <th style={{ ...th, width: 50, textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencias.map((a) => {
                      const ei = ASISTENCIA_ESTADOS[a.estado] || ASISTENCIA_ESTADOS.sin_registrar;
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={td}>{a.fecha}</td>
                          <td style={{ ...td, color: '#64748b' }}>{a.horario_hora_inicio?.substring(0, 5)} – {a.horario_hora_fin?.substring(0, 5)}</td>
                          <td style={td}>
                            <span title={ei.description} style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: ei.bg, color: ei.color }}>
                              {ei.label}{a.es_recuperacion && <span style={{ marginLeft: 4, fontSize: '0.65rem', color: '#8b6914' }}>Recup.</span>}
                            </span>
                          </td>
                          <td style={td}>{a.profesor_nombre}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <button onClick={() => confirmarEliminarAsistencia(a)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, padding: '0.25rem 0.5rem' }}>×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )
          ) : horarios.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#cbd5e1', fontSize: '0.875rem' }}>No hay horarios registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {horarios.map((h) => (
                <div key={h.id} style={{ padding: '0.875rem 1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4af37', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{h.horario_detalle.taller}</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.125rem' }}>
                    {h.horario_detalle.dia} · {h.horario_detalle.hora_inicio?.substring(0, 5)} – {h.horario_detalle.hora_fin?.substring(0, 5)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Prof. {h.horario_detalle.profesor}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #f3f4f6' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}>Cerrar</button>
        </div>
      </div>

      {!segundaConfirmacion ? (
        <ConfirmModal
          isOpen={eliminandoAsistenciaId !== null}
          title="Eliminar Asistencia"
          message="¿Estás seguro de que deseas eliminar esta asistencia?"
          itemName={eliminandoAsistenciaInfo}
          confirmLabel="Confirmar"
          cancelLabel="Cancelar"
          onConfirm={() => setSegundaConfirmacion(true)}
          onCancel={cancelEliminarAsistencia}
          isLoading={false}
        />
      ) : (
        <ConfirmModal
          isOpen={eliminandoAsistenciaId !== null}
          title="⚠️ Confirmar Eliminación"
          message="Esta acción es IRREVERSIBLE. ¿Realmente deseas eliminar esta asistencia?"
          itemName={`${eliminandoAsistenciaInfo} (ID: ${eliminandoAsistenciaId})`}
          confirmLabel="ELIMINAR DEFINITIVAMENTE"
          cancelLabel="Cancelar"
          onConfirm={handleEliminarAsistencia}
          onCancel={cancelEliminarAsistencia}
          isLoading={false}
        />
      )}
    </div>
  );
}

export default memo(MatriculaDetailModal);
