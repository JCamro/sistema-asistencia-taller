import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import { getApiBaseUrl } from '../utils/api';

interface Taller {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

interface Profesor {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
}

interface Horario {
  id: number;
  taller: number;
  taller_nombre?: string;
  profesor: number;
  profesor_nombre: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
  ocupacion: number;
  activo: boolean;
  alumnos: { id: number; nombre: string; apellido: string; edad: number | null }[];
  tipo_pago?: 'dinamico' | 'fijo';
  monto_fijo?: number | null;
}

interface HorarioFormData {
  dia_semana: number;
  hora_inicio: string;
  profesor: number | '';
  cupo_maximo: number;
}

const HORAS = Array.from({ length: 14 }, (_, i) => i + 8);
const DIAS = [
  { value: 0, label: 'Lunes' },
  { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
];

function TallerDetalle() {
  const navigate = useNavigate();
  const { tallerId } = useParams<{ tallerId: string }>();
  const { cicloActual, isLoading: isCicloLoading } = useCiclo();
  const { showToast, showApiError } = useToast();
  const apiBase = getApiBaseUrl();
  
  const [taller, setTaller] = useState<Taller | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelEstado, setPanelEstado] = useState<'vacio' | 'detalle' | 'crear'>('vacio');
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<Horario | null>(null);
  const [, setCeldaSeleccionada] = useState<{ dia: number; hora: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editandoProfesor, setEditandoProfesor] = useState(false);
  const [nuevoProfesorId, setNuevoProfesorId] = useState<number | ''>('');
  const [guardandoProfesor, setGuardandoProfesor] = useState(false);
  const [editandoPago, setEditandoPago] = useState(false);
  const [tipoPagoSeleccionado, setTipoPagoSeleccionado] = useState<'dinamico' | 'fijo'>('dinamico');
  const [montoFijo, setMontoFijo] = useState<string>('');
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [editandoCupo, setEditandoCupo] = useState(false);
  const [cupoEditado, setCupoEditado] = useState<string>('');
  const [guardandoCupo, setGuardandoCupo] = useState(false);
  const [formData, setFormData] = useState<HorarioFormData>({
    dia_semana: 0,
    hora_inicio: '',
    profesor: '',
    cupo_maximo: 10,
  });

  const fetchData = useCallback(async () => {
    if (isCicloLoading) return;
    if (!cicloActual || !tallerId) {
      setLoading(false);
      return;
    }
    const token = localStorage.getItem('access_token');
    try {
      const [tallerRes, horariosRes, profesoresRes] = await Promise.all([
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/talleres/${tallerId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/horarios/?taller=${tallerId}&page_size=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(res => {
          console.log('🔍 DEBUG ENDPOINT - URL llamada:', `${apiBase}/api/horarios/?taller=${tallerId}&page_size=100`);
          console.log('🔍 DEBUG ENDPOINT - Status:', res.status);
          return res;
        }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/profesores/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      
      const parseJson = async (res: Response) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return { error: text, status: res.status };
        }
      };

      const [tallerData, horariosData, profesoresData] = await Promise.all([
        parseJson(tallerRes),
        parseJson(horariosRes),
        parseJson(profesoresRes),
      ]);
      
      console.log('API Responses:', { tallerData, horariosData, profesoresData });
      
      if (tallerData.error) {
        console.error('Taller API error:', tallerData);
      }
      if (profesoresData.error) {
        console.error('Profesores API error:', profesoresData);
      }
      
      if (!tallerData.error) setTaller(tallerData);
      if (!horariosData.error) {
        const todosHorarios = horariosData.results || horariosData;
        console.log('🔍 DEBUG - TODOS los horarios crudos del backend (sin filtro):', todosHorarios);
        console.log('🔍 DEBUG - Cantidad total de horarios:', todosHorarios.length);
        console.log('🔍 DEBUG - Lista de dias/talleres:', todosHorarios.map((h: any) => `dia=${h.dia_semana}(${h.dia_nombre}) taller=${h.taller} hora=${h.hora_inicio}`));
        
        const horariosFiltrados = todosHorarios.filter((h: Horario) => h.activo);
        console.log('🔍 DEBUG - Horarios ACTIVOS filtrados:', horariosFiltrados.length);
        
        // Ver específicamente los de viernes (dia_semana=4)
        const viernesHorarios = horariosFiltrados.filter((h: any) => h.dia_semana === 4);
        console.log('🔍 DEBUG - Horarios de VIERNES:', viernesHorarios.map((h: any) => `${h.hora_inicio} - taller:${h.taller}`));
        
        setHorarios(horariosFiltrados);
      }
      if (!profesoresData.error) setProfesores((profesoresData.results || profesoresData).filter((p: Profesor) => p.activo));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, tallerId, isCicloLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const normalizarHora = (hora: string) => {
    if (!hora) return '00:00';
    const partes = hora.split(':');
    const horaNum = parseInt(partes[0]) || 0;
    const min = partes.length > 1 ? (partes[1]?.substring(0, 2) || '00') : '00';
    return `${horaNum.toString().padStart(2, '0')}:${min}`;
  };

  const gridHorarios = useMemo(() => {
    const grid: { [key: string]: Horario } = {};
    console.log('🔍 DEBUG gridHorarios - horarios recibidos:', horarios);
    console.log('🔍 DEBUG gridHorarios - length:', horarios.length);
    horarios.forEach((h) => {
      const horaRaw = h.hora_inicio;
      const horaNormalizada = normalizarHora(horaRaw);
      const diaNum = Number(h.dia_semana);
      const key = `${diaNum}-${horaNormalizada}`;
      console.log(`🔍 DEBUG - Horario: ${h.taller_nombre}, dia_semana=${h.dia_semana} (${typeof h.dia_semana}), hora_inicio=${horaRaw} -> ${horaNormalizada}, key="${key}"`);
      grid[key] = h;
    });
    console.log('🔍 DEBUG gridHorarios - keys generadas:', Object.keys(grid));
    return grid;
  }, [horarios]);

  const handleCeldaClick = (dia: number, hora: string) => {
    const key = `${dia}-${hora}`;
    if (gridHorarios[key]) {
      setHorarioSeleccionado(gridHorarios[key]);
      setPanelEstado('detalle');
      setEditandoPago(false);
    } else {
      setCeldaSeleccionada({ dia, hora });
      setFormData({
        dia_semana: dia,
        hora_inicio: hora,
        profesor: '',
        cupo_maximo: 10,
      });
      setPanelEstado('crear');
    }
  };

  const handleCrearHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual || !tallerId || !formData.profesor) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    
    const horaParts = formData.hora_inicio.split(':');
    const horaFin = parseInt(horaParts[0]) + 1;
    const horaFinStr = `${horaFin.toString().padStart(2, '0')}:${horaParts[1]}`;

    try {
      const res = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/horarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taller: parseInt(tallerId),
          profesor: formData.profesor,
          dia_semana: formData.dia_semana,
          hora_inicio: formData.hora_inicio,
          hora_fin: horaFinStr,
          activo: true,
          cupo_maximo: formData.cupo_maximo,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      
      await fetchData();
      setPanelEstado('vacio');
      setCeldaSeleccionada(null);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarHorario = () => {
    if (!horarioSeleccionado) return;
    if ((horarioSeleccionado.ocupacion ?? 0) > 0) {
      showToast('No se puede eliminar. Hay estudiantes matriculados en este horario.', 'warning');
      return;
    }
    setShowDeleteModal(true);
  };

  const confirmDeleteHorario = async () => {
    if (!horarioSeleccionado) return;
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${apiBase}/api/horarios/${horarioSeleccionado.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
      setPanelEstado('vacio');
      setHorarioSeleccionado(null);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const cancelDeleteHorario = () => {
    setShowDeleteModal(false);
  };

  const handleCambiarProfesor = async () => {
    if (!horarioSeleccionado || !nuevoProfesorId) return;
    setGuardandoProfesor(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/horarios/${horarioSeleccionado.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profesor: nuevoProfesorId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      showToast('Profesor actualizado', 'success');
      setEditandoProfesor(false);
      await fetchData();
      // Actualizar horario seleccionado con el nuevo profesor
      const profesorNuevo = profesores.find(p => p.id === nuevoProfesorId);
      if (profesorNuevo && horarioSeleccionado) {
        setHorarioSeleccionado({
          ...horarioSeleccionado,
          profesor: nuevoProfesorId as number,
          profesor_nombre: `${profesorNuevo.nombre} ${profesorNuevo.apellido}`,
        });
      }
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setGuardandoProfesor(false);
    }
  };

  const handleCambiarTipoPago = async () => {
    if (!horarioSeleccionado) return;
    setGuardandoPago(true);
    const token = localStorage.getItem('access_token');
    try {
      const payload: Record<string, unknown> = { tipo_pago: tipoPagoSeleccionado };
      if (tipoPagoSeleccionado === 'fijo' && montoFijo) {
        payload.monto_fijo = parseFloat(montoFijo);
      }
      const res = await fetch(`${apiBase}/api/horarios/${horarioSeleccionado.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      showToast('Tipo de pago actualizado', 'success');
      setEditandoPago(false);
      await fetchData();
      // Actualizar horario seleccionado
      if (horarioSeleccionado) {
        setHorarioSeleccionado({
          ...horarioSeleccionado,
          tipo_pago: tipoPagoSeleccionado,
          monto_fijo: tipoPagoSeleccionado === 'fijo' ? parseFloat(montoFijo) : null,
        });
      }
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleGuardarCupo = async () => {
    if (!horarioSeleccionado || !cupoEditado) return;
    const nuevoCupo = parseInt(cupoEditado);
    const ocupacionActual = horarioSeleccionado.ocupacion ?? 0;
    
    // Validar: no permitir disminuir a un valor menor a la ocupación actual
    if (nuevoCupo < ocupacionActual) {
      showToast(`No se puede reducir el cupo por debajo de ${ocupacionActual} alumno(s) matriculado(s)`, 'warning');
      return;
    }
    
    setGuardandoCupo(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/horarios/${horarioSeleccionado.id}/`, {
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
      await fetchData();
      // Actualizar horario seleccionado
      if (horarioSeleccionado) {
        setHorarioSeleccionado({
          ...horarioSeleccionado,
          cupo_maximo: nuevoCupo,
          cupo_disponible: nuevoCupo - ocupacionActual,
        });
      }
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setGuardandoCupo(false);
    }
  };

  const getHoraLabel = (hora: number) => {
    return `${hora.toString().padStart(2, '0')}:00`;
  };

  if (isCicloLoading || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!cicloActual) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '2rem' }}>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No hay un ciclo seleccionado.</p>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Seleccionar ciclo
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 4rem)' }}>
      <button
        onClick={() => navigate('/talleres')}
        style={{
          alignSelf: 'flex-start',
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#374151',
          fontSize: '0.875rem',
        }}
      >
        ← Volver a Talleres
      </button>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
        <div style={{ flex: 7, minWidth: 0 }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
                  {taller?.nombre}
                </h1>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  {taller?.descripcion || 'Sin descripción'}
                </p>
              </div>
              <span style={{ padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: taller?.activo ? '#d1fae5' : '#f3f4f6', color: taller?.activo ? '#059669' : '#6b7280' }}>
                {taller?.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '60px repeat(7, 1fr)', 
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <div style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>Hora</div>
              {DIAS.map((dia) => (
                <div key={dia.value} style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textAlign: 'center', textTransform: 'uppercase' }}>
                  {dia.label.slice(0, 3)}
                </div>
              ))}
            </div>

            {HORAS.map((hora) => (
              <div key={hora} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', borderRight: '1px solid #f3f4f6' }}>
                  {getHoraLabel(hora)}
                </div>
                {DIAS.map((dia) => {
                  const horaStr = getHoraLabel(hora);
                  const key = `${dia.value}-${horaStr}`;
                  const horario = gridHorarios[key];
                  if (dia.value === 4 && horaStr === '17:00') {
                    console.log(`🔍 DEBUG CELDAS - Buscando key="${key}" para VIERNES 17:00, encontrado:`, horario);
                  }
                  const estaLleno = horario ? (horario.ocupacion ?? 0) >= horario.cupo_maximo : false;
                  
                  return (
                    <div
                      key={`${dia.value}-${hora}`}
                      onClick={() => handleCeldaClick(dia.value, horaStr)}
                      style={{
                        minHeight: '60px',
                        borderRight: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        background: horario ? (estaLleno ? '#fef2f2' : '#ecfdf5') : 'white',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!horario) e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        if (!horario) e.currentTarget.style.background = 'white';
                      }}
                    >
                      {horario && (
                        <div style={{
                          height: '100%',
                          background: estaLleno ? '#fecaca' : '#86efac',
                          borderRadius: '6px',
                          padding: '0.375rem',
                          fontSize: '0.7rem',
                          color: estaLleno ? '#7f1d1d' : '#14532d',
                        }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.125rem' }}>
                            {horario.ocupacion ?? 0}/{horario.cupo_maximo}
                          </div>
                          <div style={{ color: estaLleno ? '#991b1b' : '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {horario.profesor_nombre}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 3, minWidth: '280px', maxWidth: '360px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', position: 'sticky', top: '1rem' }}>
            {panelEstado === 'vacio' && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                <p style={{ fontSize: '0.875rem' }}>
                  Selecciona un horario.<br />
                  Haz clic en una celda del calendario para ver los alumnos o crear un nuevo horario.
                </p>
              </div>
            )}

            {panelEstado === 'crear' && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
                  Crear Horario
                </h3>
                <form onSubmit={handleCrearHorario}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Día
                    </label>
                    <select
                      value={formData.dia_semana}
                      onChange={(e) => setFormData({ ...formData, dia_semana: parseInt(e.target.value) })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                    >
                      {DIAS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Hora
                    </label>
                    <select
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                    >
                      {HORAS.map((h) => (<option key={h} value={getHoraLabel(h)}>{getHoraLabel(h)}</option>))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Profesor
                    </label>
                    <select
                      value={formData.profesor}
                      onChange={(e) => setFormData({ ...formData, profesor: e.target.value ? parseInt(e.target.value) : '' })}
                      required
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                    >
                      <option value="">Seleccionar...</option>
                      {profesores.map((p) => (<option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Cupo máximo
                    </label>
                    <input
                      type="number"
                      value={formData.cupo_maximo}
                      onChange={(e) => setFormData({ ...formData, cupo_maximo: parseInt(e.target.value) || 10 })}
                      min={1}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => { setPanelEstado('vacio'); setCeldaSeleccionada(null); }}
                      style={{ flex: 1, padding: '0.625rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !formData.profesor}
                      style={{ flex: 1, padding: '0.625rem', background: saving ? '#93c5fc' : '#6366f1', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', color: 'white' }}
                    >
                      {saving ? 'Guardando...' : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {panelEstado === 'detalle' && horarioSeleccionado && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                    Detalle del Horario
                  </h3>
                  <button
                    onClick={() => { setPanelEstado('vacio'); setHorarioSeleccionado(null); setEditandoProfesor(false); setEditandoPago(false); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af' }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Tipo de Pago</div>
                    {!editandoPago && (
                      <button
                        onClick={() => { 
                          setEditandoPago(true); 
                          setTipoPagoSeleccionado(horarioSeleccionado.tipo_pago || 'dinamico'); 
                          setMontoFijo(horarioSeleccionado.monto_fijo?.toString() || ''); 
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#6366f1', fontWeight: '500' }}
                      >
                        Configurar
                      </button>
                    )}
                  </div>
                  {editandoPago ? (
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setTipoPagoSeleccionado('dinamico')}
                          style={{ flex: 1, padding: '0.5rem', background: tipoPagoSeleccionado === 'dinamico' ? '#6366f1' : '#f3f4f6', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer', color: tipoPagoSeleccionado === 'dinamico' ? 'white' : '#374151' }}
                        >
                          Dinámico
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipoPagoSeleccionado('fijo')}
                          style={{ flex: 1, padding: '0.5rem', background: tipoPagoSeleccionado === 'fijo' ? '#6366f1' : '#f3f4f6', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer', color: tipoPagoSeleccionado === 'fijo' ? 'white' : '#374151' }}
                        >
                          Fijo
                        </button>
                      </div>
                      {tipoPagoSeleccionado === 'fijo' && (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Monto fijo (S/.)"
                            value={montoFijo}
                            onChange={(e) => setMontoFijo(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setEditandoPago(false)}
                          style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleCambiarTipoPago}
                          disabled={guardandoPago || (tipoPagoSeleccionado === 'fijo' && !montoFijo)}
                          style={{ flex: 1, padding: '0.5rem', background: guardandoPago || (tipoPagoSeleccionado === 'fijo' && !montoFijo) ? '#93c5fc' : '#6366f1', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: (guardandoPago || (tipoPagoSeleccionado === 'fijo' && !montoFijo)) ? 'not-allowed' : 'pointer', color: 'white' }}
                        >
                          {guardandoPago ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                      {horarioSeleccionado.tipo_pago === 'fijo' ? (
                        <span>Fijo {horarioSeleccionado.monto_fijo ? `(S/. ${horarioSeleccionado.monto_fijo})` : ''}</span>
                      ) : (
                        <span>Dinámico</span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Día y Hora</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                    {DIAS.find(d => d.value === horarioSeleccionado.dia_semana)?.label} - {normalizarHora(horarioSeleccionado.hora_inicio)}
                  </div>
                </div>

                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Profesor</div>
                    {!editandoProfesor && (
                      <button
                        onClick={() => { setEditandoProfesor(true); setNuevoProfesorId(horarioSeleccionado.profesor); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#6366f1', fontWeight: '500' }}
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                  {editandoProfesor ? (
                    <div>
                      <select
                        value={nuevoProfesorId}
                        onChange={(e) => setNuevoProfesorId(e.target.value ? parseInt(e.target.value) : '')}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '0.5rem' }}
                      >
                        {profesores.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setEditandoProfesor(false)}
                          style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleCambiarProfesor}
                          disabled={guardandoProfesor || nuevoProfesorId === horarioSeleccionado.profesor}
                          style={{ flex: 1, padding: '0.5rem', background: guardandoProfesor ? '#93c5fc' : '#6366f1', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: guardandoProfesor ? 'not-allowed' : 'pointer', color: 'white' }}
                        >
                          {guardandoProfesor ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                      {horarioSeleccionado.profesor_nombre}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cupo</div>
                    {!editandoCupo && (
                      <button
                        onClick={() => { setEditandoCupo(true); setCupoEditado(horarioSeleccionado.cupo_maximo.toString()); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#6366f1', fontWeight: '500' }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  {editandoCupo ? (
                    <div>
                      <input
                        type="number"
                        value={cupoEditado}
                        onChange={(e) => setCupoEditado(e.target.value)}
                        min={horarioSeleccionado.ocupacion ?? 1}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '0.5rem' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                        Mínimo: {horarioSeleccionado.ocupacion ?? 0} (alumnos actuales)
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setEditandoCupo(false)}
                          style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleGuardarCupo}
                          disabled={guardandoCupo || !cupoEditado || parseInt(cupoEditado) < (horarioSeleccionado.ocupacion ?? 0)}
                          style={{ flex: 1, padding: '0.5rem', background: (guardandoCupo || !cupoEditado || parseInt(cupoEditado) < (horarioSeleccionado.ocupacion ?? 0)) ? '#93c5fc' : '#6366f1', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500', cursor: (guardandoCupo || !cupoEditado || parseInt(cupoEditado) < (horarioSeleccionado.ocupacion ?? 0)) ? 'not-allowed' : 'pointer', color: 'white' }}
                        >
                          {guardandoCupo ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '700', color: ((horarioSeleccionado.ocupacion ?? 0) >= horarioSeleccionado.cupo_maximo) ? '#dc2626' : '#059669' }}>
                        {horarioSeleccionado.ocupacion ?? 0}
                      </span>
                      <span style={{ color: '#9ca3af' }}>/</span>
                      <span style={{ fontSize: '1rem', color: '#374151' }}>{horarioSeleccionado.cupo_maximo}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
                        ({horarioSeleccionado.cupo_disponible ?? horarioSeleccionado.cupo_maximo} disponibles)
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Alumnos ({horarioSeleccionado.alumnos?.length || 0})
                  </div>
                  {horarioSeleccionado.alumnos && horarioSeleccionado.alumnos.length > 0 ? (
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {horarioSeleccionado.alumnos.map((alumno) => (
                        <div key={alumno.id} style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '6px', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                          {alumno.nombre} {alumno.apellido} {alumno.edad !== null ? `(${alumno.edad} años)` : ''}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', background: '#f9fafb', borderRadius: '8px' }}>
                      No hay estudiantes
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {horarioSeleccionado.ocupacion === 0 && (
                    <button
                      onClick={handleEliminarHorario}
                      style={{ flex: 1, padding: '0.625rem', background: '#fee2e2', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', color: '#dc2626' }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar Horario"
        message="¿Estás seguro de que deseas eliminar este horario?"
        itemName={horarioSeleccionado ? `${DIAS.find(d => d.value === horarioSeleccionado.dia_semana)?.label} - ${normalizarHora(horarioSeleccionado.hora_inicio)}` : ''}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteHorario}
        onCancel={cancelDeleteHorario}
        isLoading={saving}
      />
    </div>
  );
}

export default memo(TallerDetalle);
