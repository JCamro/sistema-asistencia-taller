import { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import { getApiBaseUrl } from '../utils/api';

interface Taller {
  id: number;
  nombre: string;
  tipo: string;
}

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  edad: number | null;
}

interface Horario {
  id: number;
  taller: number;
  taller_nombre: string;
  profesor: number;
  profesor_nombre: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
  activo: boolean;
  alumnos: Alumno[];
  ocupacion: number;
}

const DIAS = [
  { value: 0, label: 'Lunes', abrev: 'LUN' },
  { value: 1, label: 'Martes', abrev: 'MAR' },
  { value: 2, label: 'Miércoles', abrev: 'MIÉ' },
  { value: 3, label: 'Jueves', abrev: 'JUE' },
  { value: 4, label: 'Viernes', abrev: 'VIE' },
  { value: 5, label: 'Sábado', abrev: 'SÁB' },
  { value: 6, label: 'Domingo', abrev: 'DOM' },
];

const HORAS = Array.from({ length: 14 }, (_, i) => i + 8);

function formatHora(hora: number): string {
  return `${hora.toString().padStart(2, '0')}:00`;
}

function normalizarHora(hora: string): string {
  if (!hora) return '00:00';
  return hora.substring(0, 5);
}

function horaAIndice(hora: string): number {
  const h = parseInt(hora.split(':')[0], 10);
  return HORAS.indexOf(h);
}

/* ── Tooltip ── */
function Tooltip({
  horario, children,
}: {
  horario: Horario;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current || !horario.alumnos?.length) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setVisible(true);
  }, [horario.alumnos]);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ height: '100%' }}
      >
        {children}
      </div>
      {visible && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 8,
            transform: 'translate(-50%, -100%)',
            zIndex: 100,
            background: '#1e1b4b',
            color: 'white',
            borderRadius: '10px',
            padding: '0.625rem 0.75rem',
            fontSize: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            maxWidth: '260px',
            maxHeight: '280px',
            overflowY: 'auto',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            fontSize: '0.65rem', fontWeight: '700', color: '#a5b4fc',
            marginBottom: '0.375rem', textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Alumnos ({horario.alumnos.length})
          </div>
          {horario.alumnos.map((a) => (
            <div key={a.id} style={{
              padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {a.apellido}, {a.nombre} {a.edad !== null ? `(${a.edad} años)` : ''}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Panel lateral ── */
function PanelLateral({
  horario, estaLleno, onClose, onActualizar,
}: {
  horario: Horario;
  estaLleno: boolean;
  onClose: () => void;
  onActualizar: (nuevoCupo: number, nuevaOcupacion: number) => void;
}) {
  const apiBase = getApiBaseUrl();
  const diaLabel = DIAS.find((d) => d.value === horario.dia_semana)?.label ?? '';
  const { showToast } = useToast();
  const [editandoCupo, setEditandoCupo] = useState(false);
  const [cupoEditado, setCupoEditado] = useState<string>(horario.cupo_maximo.toString());
const [guardandoCupo, setGuardandoCupo] = useState(false);

  const handleGuardarCupo = async () => {
    const nuevoCupo = parseInt(cupoEditado);
    const ocupacionActual = horario.ocupacion ?? 0;
    
    if (nuevoCupo < ocupacionActual) {
      showToast(`No se puede reducir el cupo por debajo de ${ocupacionActual} alumno(s)`, 'warning');
      return;
    }
    
    setGuardandoCupo(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/horarios/${horario.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cupo_maximo: nuevoCupo }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      showToast('Cupo actualizado', 'success');
      setEditandoCupo(false);
      onActualizar(nuevoCupo, ocupacionActual);
    } catch (err) {
      console.error('Error:', err);
      showToast('Error al actualizar el cupo', 'error');
    } finally {
      setGuardandoCupo(false);
    }
  };

  return (
    <div style={{
      background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb',
      padding: '1.25rem', position: 'sticky', top: '1rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
          Detalle de Clase
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.25rem', color: '#9ca3af', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{
          background: '#f9fafb', borderRadius: '8px', padding: '0.75rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Día y hora
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', marginTop: '0.125rem' }}>
            {diaLabel} — {normalizarHora(horario.hora_inicio)} – {normalizarHora(horario.hora_fin)}
          </div>
        </div>

        <div style={{
          background: '#f9fafb', borderRadius: '8px', padding: '0.75rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Profesor
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', marginTop: '0.125rem' }}>
            {horario.profesor_nombre}
          </div>
        </div>

        <div style={{
          background: estaLleno ? '#fef2f2' : '#f0fdf4',
          borderRadius: '8px', padding: '0.75rem',
          border: estaLleno ? '1px solid #fecaca' : '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: '0.7rem', color: estaLleno ? '#b91c1c' : '#15803d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            Cupo {!editandoCupo && <button onClick={() => setEditandoCupo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', color: '#6366f1', fontWeight: '500', marginLeft: '0.5rem' }}>Editar</button>}
          </div>
          {editandoCupo ? (
            <div>
              <input
                type="number"
                value={cupoEditado}
                onChange={(e) => setCupoEditado(e.target.value)}
                min={horario.ocupacion ?? 1}
                style={{ width: '100%', padding: '0.375rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '0.375rem' }}
              />
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.375rem' }}>
                Mínimo: {horario.ocupacion ?? 0} alumnos
              </div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button
                  onClick={() => setEditandoCupo(false)}
                  style={{ flex: 1, padding: '0.375rem', background: '#f3f4f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarCupo}
                  disabled={guardandoCupo || !cupoEditado || parseInt(cupoEditado) < (horario.ocupacion ?? 0)}
                  style={{ flex: 1, padding: '0.375rem', background: (guardandoCupo || !cupoEditado || parseInt(cupoEditado) < (horario.ocupacion ?? 0)) ? '#93c5fc' : '#6366f1', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', cursor: (guardandoCupo || !cupoEditado || parseInt(cupoEditado) < (horario.ocupacion ?? 0)) ? 'not-allowed' : 'pointer', color: 'white' }}
                >
                  {guardandoCupo ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.25rem',
            }}>
              <span style={{
                fontSize: '1.5rem', fontWeight: '800',
                color: estaLleno ? '#dc2626' : '#059669',
              }}>
                {horario.ocupacion ?? 0}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>/ {horario.cupo_maximo}</span>
              {estaLleno && (
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '700',
                  background: '#dc2626', color: 'white',
                  padding: '0.125rem 0.5rem', borderRadius: '4px',
                }}>
                  LLENO
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lista de alumnos */}
      <div>
        <div style={{
          fontSize: '0.8rem', fontWeight: '600', color: '#374151',
          marginBottom: '0.5rem',
        }}>
          Alumnos matriculados ({horario.alumnos.length})
        </div>
        {horario.alumnos.length > 0 ? (
          <div style={{
            maxHeight: '320px', overflowY: 'auto',
            border: '1px solid #f3f4f6', borderRadius: '8px',
          }}>
            {horario.alumnos.map((alumno, i) => (
              <div key={alumno.id} style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem', color: '#111827',
                borderBottom: i < horario.alumnos.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: '#eef2ff', color: '#4338ca',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: '700', flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontWeight: '500' }}>
                  {alumno.apellido}, {alumno.nombre}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '1.5rem', textAlign: 'center',
            background: '#f9fafb', borderRadius: '8px',
            color: '#9ca3af', fontSize: '0.85rem',
          }}>
            No hay alumnos matriculados en esta clase.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Celda compacta ── */
function CeldaCalendario({
  horario,
  estaLleno,
  isSelected,
  onClick,
}: {
  horario: Horario;
  estaLleno: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const bg = estaLleno
    ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
    : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
  const border = estaLleno ? '#fecaca' : '#bbf7d0';
  const textColor = estaLleno ? '#991b1b' : '#166534';
  const subColor = estaLleno ? '#b91c1c' : '#15803d';

  return (
    <Tooltip horario={horario}>
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
        style={{
          height: '100%',
          borderRadius: '8px',
          padding: '0.4rem 0.5rem',
          background: bg,
          border: `1.5px solid ${isSelected ? '#6366f1' : border}`,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
        }}
      >
        {/* Profesor */}
        <div style={{
          fontSize: '0.7rem', fontWeight: '600',
          color: textColor,
          whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {horario.profesor_nombre}
        </div>

        {/* Horario */}
        <div style={{
          fontSize: '0.6rem', color: subColor,
          marginTop: '2px',
        }}>
          {normalizarHora(horario.hora_inicio)} – {normalizarHora(horario.hora_fin)}
        </div>

        {/* Cupo compacto */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '6px',
          paddingTop: '4px',
          borderTop: `1px solid ${border}`,
        }}>
          <span style={{
            fontSize: '0.6rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '3px',
            color: estaLleno ? '#dc2626' : '#059669',
          }}>
            {horario.alumnos.length > 0 && (
              <span style={{ fontSize: '0.65rem' }}>👤</span>
            )}
            {horario.ocupacion ?? 0}/{horario.cupo_maximo}
          </span>
          {estaLleno && (
            <span style={{
              fontSize: '0.5rem', fontWeight: '700',
              background: '#dc2626', color: 'white',
              padding: '1px 4px', borderRadius: '3px',
              letterSpacing: '0.03em',
            }}>
              LLENO
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

/* ── Página principal ── */
function HorariosPage() {
  const { cicloActual, isLoading: isCicloLoading } = useCiclo();
  const { showApiError } = useToast();
  const apiBase = getApiBaseUrl();
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [tallerSeleccionado, setTallerSeleccionado] = useState<number | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loadingTalleres, setLoadingTalleres] = useState(true);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<Horario | null>(null);

  const actualizarCupoHorario = useCallback((horarioId: number, nuevoCupo: number, nuevaOcupacion: number) => {
    setHorarioSeleccionado(prev => {
      if (!prev || prev.id !== horarioId) return prev;
      return {
        ...prev,
        cupo_maximo: nuevoCupo,
        ocupacion: nuevaOcupacion,
      };
    });
    // También actualizar en la lista de horarios
    setHorarios(prev => prev.map(h => 
      h.id === horarioId 
        ? { ...h, cupo_maximo: nuevoCupo, ocupacion: nuevaOcupacion }
        : h
    ));
  }, []);

  const cargarTalleres = useCallback(async () => {
    if (isCicloLoading || !cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/ciclos/${cicloActual.id}/talleres/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTalleres(data.results || data);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setLoadingTalleres(false);
    }
  }, [cicloActual, isCicloLoading, showApiError]);

  const cargarHorarios = useCallback(async (tallerId: number) => {
    if (!cicloActual) return;
    setLoadingHorarios(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(
        `/api/horarios/?taller=${tallerId}&page_size=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setHorarios(data.results || data);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setLoadingHorarios(false);
    }
  }, [cicloActual, showApiError]);

  useEffect(() => {
    cargarTalleres();
  }, [cargarTalleres]);

  useEffect(() => {
    if (tallerSeleccionado) {
      cargarHorarios(tallerSeleccionado);
      setHorarioSeleccionado(null);
    } else {
      setHorarios([]);
      setHorarioSeleccionado(null);
    }
  }, [tallerSeleccionado, cargarHorarios]);

  const tallerActual = useMemo(
    () => talleres.find((t) => t.id === tallerSeleccionado) || null,
    [talleres, tallerSeleccionado]
  );

  const gridHorarios = useMemo(() => {
    const grid: Record<string, Horario> = {};
    horarios.forEach((h) => {
      const indice = horaAIndice(h.hora_inicio);
      if (indice === -1) return;
      const key = `${h.dia_semana}-${HORAS[indice]}`;
      grid[key] = h;
    });
    return grid;
  }, [horarios]);

  if (isCicloLoading || loadingTalleres) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid #e5e7eb', borderTop: '3px solid #6366f1',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
            Horarios
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Distribución semanal por taller
          </p>
        </div>

        <div style={{ minWidth: '320px' }}>
          <label style={{
            display: 'block', fontSize: '0.8rem', fontWeight: '600',
            color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Taller / Instrumento
          </label>
          <select
            value={tallerSeleccionado ?? ''}
            onChange={(e) => setTallerSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              width: '100%', padding: '0.625rem 0.75rem',
              border: tallerSeleccionado ? '1px solid #c7d2fe' : '2px solid #fbbf24',
              borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500',
              color: '#111827', background: 'white',
              outline: 'none',
            }}
          >
            <option value="">-- Seleccionar taller --</option>
            {talleres.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado sin selección */}
      {!tallerSeleccionado && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '5rem 2rem',
          background: 'white', borderRadius: '16px', border: '2px dashed #fbbf24',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎵</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#92400e', marginBottom: '0.5rem' }}>
            Selecciona un taller
          </h2>
          <p style={{ color: '#b45309', fontSize: '0.9rem', textAlign: 'center', maxWidth: '360px' }}>
            Elige un taller o instrumento del menú superior para ver su distribución semanal de clases.
          </p>
        </div>
      )}

      {/* Contenido principal */}
      {tallerSeleccionado && (
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
          {/* Calendario */}
          <div style={{
            flex: horarioSeleccionado ? 7 : 1, minWidth: 0,
            transition: 'flex 0.3s',
          }}>
            <div style={{
              background: 'white', borderRadius: '16px',
              border: '1px solid #e5e7eb', overflow: 'hidden',
            }}>
              {/* Header del taller */}
              <div style={{
                padding: '1rem 1.25rem', background: '#eef2ff',
                borderBottom: '1px solid #c7d2fe',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#312e81' }}>
                  {tallerActual?.nombre}
                </h2>
                <span style={{
                  padding: '0.25rem 0.75rem', borderRadius: '9999px',
                  fontSize: '0.75rem', fontWeight: '600',
                  background: '#ddd6fe', color: '#5b21b6',
                }}>
                  {horarios.length} clase{horarios.length !== 1 ? 's' : ''}
                </span>
              </div>

              {loadingHorarios ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <div style={{
                    width: '32px', height: '32px',
                    border: '3px solid #e5e7eb', borderTop: '3px solid #6366f1',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              ) : horarios.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
                  <p style={{ fontSize: '0.9rem' }}>Este taller no tiene clases programadas.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {/* Cabecera días */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '72px repeat(7, 1fr)',
                    background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                    minWidth: '700px',
                  }}>
                    <div style={{
                      padding: '0.75rem 0.5rem', fontSize: '0.7rem', fontWeight: '600',
                      color: '#9ca3af', textAlign: 'center', textTransform: 'uppercase',
                    }}>
                      Hora
                    </div>
                    {DIAS.map((dia) => (
                      <div key={dia.value} style={{
                        padding: '0.75rem 0.25rem', fontSize: '0.7rem', fontWeight: '700',
                        color: '#6b7280', textAlign: 'center', textTransform: 'uppercase',
                        letterSpacing: '0.05em', borderLeft: '1px solid #f3f4f6',
                      }}>
                        {dia.abrev}
                      </div>
                    ))}
                  </div>

                  {/* Filas de horas */}
                  {HORAS.map((hora) => (
                    <div key={hora} style={{
                      display: 'grid',
                      gridTemplateColumns: '72px repeat(7, 1fr)',
                      borderBottom: '1px solid #f3f4f6',
                      minWidth: '700px',
                    }}>
                      <div style={{
                        padding: '0.625rem 0.25rem', fontSize: '0.75rem',
                        color: '#9ca3af', textAlign: 'center',
                        borderRight: '1px solid #f3f4f6', fontWeight: '500',
                      }}>
                        {formatHora(hora)}
                      </div>
                      {DIAS.map((dia) => {
                        const key = `${dia.value}-${hora}`;
                        const horario = gridHorarios[key];
                        const estaLleno = horario
                          ? (horario.ocupacion ?? 0) >= horario.cupo_maximo
                          : false;

                        return (
                          <div
                            key={`${dia.value}-${hora}`}
                            style={{
                              minHeight: '72px',
                              borderLeft: '1px solid #f3f4f6',
                              padding: '3px',
                            }}
                          >
                            {horario && (
                              <CeldaCalendario
                                horario={horario}
                                estaLleno={estaLleno}
                                isSelected={horarioSeleccionado?.id === horario.id}
                                onClick={() => setHorarioSeleccionado(
                                  horarioSeleccionado?.id === horario.id ? null : horario
                                )}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel lateral */}
          {horarioSeleccionado && (
            <div style={{ flex: 3, minWidth: '280px', maxWidth: '360px' }}>
              <PanelLateral
                horario={horarioSeleccionado}
                estaLleno={
                  (horarioSeleccionado.ocupacion ?? 0) >= horarioSeleccionado.cupo_maximo
                }
                onClose={() => setHorarioSeleccionado(null)}
                onActualizar={(nuevoCupo, nuevaOcupacion) => actualizarCupoHorario(horarioSeleccionado.id, nuevoCupo, nuevaOcupacion)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(HorariosPage);
