import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import { getApiBaseUrl } from '../utils/api';

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
  activo: boolean;
}

interface TallerOption {
  id: number;
  nombre: string;
}

interface AlumnoHorario {
  matricula_id: number;
  alumno_id: number;
  alumno_nombre: string;
  sesiones_disponibles: number;
  asistencia_id: number | null;
  estado: string | null;
  observacion: string;
}

interface Asistencia {
  id: number;
  matricula: number | null;
  alumno_id: number | null;
  alumno_nombre: string;
  horario: number;
  taller_nombre: string;
  profesor: number | null;
  profesor_nombre: string;
  fecha: string;
  hora: string;
  estado: string;
  observacion: string;
  es_recuperacion: boolean;
  activo: boolean;
  horario_dia?: string;
  horario_hora_inicio?: string;
  horario_hora_fin?: string;
}

const ESTADOS = [
  { value: 'asistio', label: 'Asistió', color: '#059669', bg: '#d1fae5' },
  { value: 'falta', label: 'Falta', color: '#d97706', bg: '#fef3c7' },
  { value: 'falta_grave', label: 'Falta Grave', color: '#dc2626', bg: '#fee2e2' },
];

function AsistenciasPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const apiBase = getApiBaseUrl();
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tallerSeleccionado, setTallerSeleccionado] = useState<number | null>(null);
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<number | null>(null);
  const [alumnosHorario, setAlumnosHorario] = useState<AlumnoHorario[]>([]);
  const [showRecuperacion, setShowRecuperacion] = useState(false);
  const [busquedaRecuperacion, setBusquedaRecuperacion] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<number | null>(null);
  const [editandoAsistencia, setEditandoAsistencia] = useState<Asistencia | null>(null);
  const [editandoProfesorOriginal, setEditandoProfesorOriginal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirmProfesor1, setShowConfirmProfesor1] = useState(false);
  const [showConfirmProfesor2, setShowConfirmProfesor2] = useState(false);

  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [horariosRes, profesRes] = await Promise.all([
        fetch(`${apiBase}/ciclos/${cicloActual.id}/horarios/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/ciclos/${cicloActual.id}/profesores/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [horariosData, profesData] = await Promise.all([
        horariosRes.json(),
        profesRes.json(),
      ]);
      setHorarios((horariosData.results || horariosData).filter((h: Horario) => h.activo));
      setProfesores((profesData.results || profesData).filter((p: any) => p.activo));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    fetch(`${apiBase}/ciclos/${cicloActual.id}/asistencias/`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => {
      setAsistencias(data.results || data);
    });
  }, [cicloActual]);

  const diaSemana = useMemo(() => {
    const jsDay = new Date(fecha + 'T00:00:00').getDay();
    return (jsDay + 6) % 7;
  }, [fecha]);

  const horariosDelDia = useMemo(() => {
    return horarios.filter(h => Number(h.dia_semana) === diaSemana);
  }, [horarios, diaSemana]);

  const talleres = useMemo<TallerOption[]>(() => {
    const mapa = new Map<number, string>();
    for (const h of horariosDelDia) {
      if (!mapa.has(h.taller)) {
        mapa.set(h.taller, h.taller_nombre);
      }
    }
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [horariosDelDia]);

  const horariosFiltrados = useMemo(() => {
    if (!tallerSeleccionado) return [];
    return horariosDelDia.filter(h => h.taller === tallerSeleccionado);
  }, [horariosDelDia, tallerSeleccionado]);

  useEffect(() => {
    if (tallerSeleccionado && !talleres.some(t => t.id === tallerSeleccionado)) {
      setTallerSeleccionado(null);
      setHorarioSeleccionado(null);
    } else if (horarioSeleccionado && !horariosFiltrados.some(h => h.id === horarioSeleccionado)) {
      setHorarioSeleccionado(null);
    }
  }, [talleres, tallerSeleccionado, horarioSeleccionado, horariosFiltrados]);

  useEffect(() => {
    if (horarioSeleccionado) {
      const horario = horarios.find(h => h.id === horarioSeleccionado);
      if (horario) {
        setProfesorSeleccionado(horario.profesor);
      }
    }
  }, [horarioSeleccionado, horarios]);

  const fetchAlumnosHorario = useCallback(async () => {
    if (!cicloActual || !horarioSeleccionado || !fecha) return;
    setLoadingAlumnos(true);
    const token = localStorage.getItem('access_token');
    console.log('fetchAlumnosHorario called:', { cicloActual: cicloActual.id, horarioSeleccionado, fecha });
    try {
      const url = `${apiBase}/ciclos/${cicloActual.id}/asistencias/por-horario/?horario_id=${horarioSeleccionado}&fecha=${fecha}`;
      console.log('Fetching URL:', url);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      console.log('Response status:', res.status);
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error API:', errorData);
        setAlumnosHorario([]);
        return;
      }
      const data = await res.json();
      console.log('Data received:', data);
      if (Array.isArray(data)) {
        setAlumnosHorario(data);
      } else if (data.results) {
        setAlumnosHorario(data.results);
      } else {
        console.error('Data format unexpected:', data);
        setAlumnosHorario([]);
      }
    } catch (err) {
      console.error('Error:', err);
      setAlumnosHorario([]);
    } finally {
      setLoadingAlumnos(false);
    }
  }, [cicloActual, horarioSeleccionado, fecha]);

  useEffect(() => {
    if (horarioSeleccionado && fecha) {
      fetchAlumnosHorario();
    }
  }, [horarioSeleccionado, fecha, fetchAlumnosHorario]);

  const handleCambiarEstado = async (alumno: AlumnoHorario, nuevoEstado: string) => {
    if (!cicloActual || !profesorSeleccionado) {
      showToast('Por favor selecciona un profesor primero', 'warning');
      return;
    }
    setSaving(true);
    const token = localStorage.getItem('access_token');
    const horaActual = new Date().toTimeString().slice(0, 5);

    try {
      let res;
      if (alumno.asistencia_id) {
        res = await fetch(`${apiBase}/asistencias/${alumno.asistencia_id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ estado: nuevoEstado }),
        });
      } else {
        res = await fetch(`${apiBase}/ciclos/${cicloActual.id}/asistencias/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            matricula: alumno.matricula_id,
            horario: horarioSeleccionado,
            profesor: profesorSeleccionado,
            fecha: fecha,
            hora: horaActual,
            estado: nuevoEstado,
          }),
        });
      }
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error API:', errorData);
        showApiError(new Error(JSON.stringify(errorData)));
        setSaving(false);
        return;
      }
      
      await fetchAlumnosHorario();
      const resList = await fetch(`${apiBase}/ciclos/${cicloActual.id}/asistencias/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resList.json();
      setAsistencias((data.results || data).filter((a: Asistencia) => a.activo !== false));
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const buscarAlumnoRecuperacion = async () => {
    if (!cicloActual || !busquedaRecuperacion) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/ciclos/${cicloActual.id}/alumnos/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const alumnos = data.results || data;
      const filtrados = alumnos.filter((a: any) =>
        a.nombre.toLowerCase().includes(busquedaRecuperacion.toLowerCase()) ||
        a.apellido.toLowerCase().includes(busquedaRecuperacion.toLowerCase()) ||
        a.dni.includes(busquedaRecuperacion)
      );
      setResultadosBusqueda(filtrados.slice(0, 5));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const agregarRecuperacion = async (alumno: any) => {
    if (!cicloActual || !horarioSeleccionado || !profesorSeleccionado) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');

    try {
      const resMat = await fetch(`${apiBase}/ciclos/${cicloActual.id}/matriculas/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataMat = await resMat.json();
      const matriculas = dataMat.results || dataMat;
      const matAlumno = matriculas.find((m: any) => m.alumno === alumno.id && m.activo);

      if (!matAlumno) {
        showToast('El alumno no tiene matrícula activa', 'warning');
        return;
      }

      const horaActual = new Date().toTimeString().slice(0, 5);

      await fetch(`${apiBase}/ciclos/${cicloActual.id}/asistencias/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          matricula: matAlumno.id,
          horario: horarioSeleccionado,
          profesor: profesorSeleccionado,
          fecha: fecha,
          hora: horaActual,
          estado: 'asistio',
          es_recuperacion: true,
        }),
      });

      setShowRecuperacion(false);
      setBusquedaRecuperacion('');
      setResultadosBusqueda([]);
      await fetchAlumnosHorario();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAsistencia = (asistencia: Asistencia) => {
    setEditandoAsistencia(asistencia);
    setEditandoProfesorOriginal(asistencia.profesor);
  };

  const guardarEdicionAsistencia = async () => {
    if (!editandoAsistencia || !cicloActual) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    const horaActual = new Date().toTimeString().slice(0, 5);

    try {
      const res = await fetch(`${apiBase}/asistencias/${editandoAsistencia.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          estado: editandoAsistencia.estado,
          observacion: editandoAsistencia.observacion,
          hora: horaActual,
          profesor: editandoAsistencia.profesor,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error API:', errorData);
        showApiError(new Error(JSON.stringify(errorData)));
        setSaving(false);
        return;
      }
      
      setEditandoAsistencia(null);
      setEditandoProfesorOriginal(null);
      await fetchAlumnosHorario();
      const resList = await fetch(`${apiBase}/ciclos/${cicloActual.id}/asistencias/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resList.json();
      setAsistencias(data.results || data);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const getEstadoInfo = (estado: string | null) => {
    if (!estado) return { label: 'Sin registrar', color: '#6b7280', bg: '#f3f4f6' };
    return ESTADOS.find(e => e.value === estado) || { label: estado, color: '#6b7280', bg: '#f3f4f6' };
  };

  const estadisticas = useMemo(() => {
    const filtro = (a: Asistencia) => 
      a.horario === horarioSeleccionado && a.fecha === fecha;
    const asistenciaHorario = asistencias.filter(filtro);
    return {
      total: asistenciaHorario.length,
      asistio: asistenciaHorario.filter(a => a.estado === 'asistio').length,
      falta: asistenciaHorario.filter(a => a.estado === 'falta').length,
      falta_grave: asistenciaHorario.filter(a => a.estado === 'falta_grave').length,
    };
  }, [asistencias, horarioSeleccionado, fecha]);

  const historialAsistencias = useMemo(() => {
    if (!horarioSeleccionado || !fecha) return [];
    return asistencias.filter(a => a.horario === horarioSeleccionado && a.fecha === fecha);
  }, [asistencias, horarioSeleccionado, fecha]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Asistencias</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Registro de asistencia por horario</p>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setHorarioSeleccionado(null); }}
              style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Taller</label>
            <select
              value={tallerSeleccionado || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null;
                setTallerSeleccionado(val);
                setHorarioSeleccionado(null);
              }}
              style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
            >
              <option value="">Seleccionar taller</option>
              {talleres.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Horario</label>
            <select
              value={horarioSeleccionado || ''}
              onChange={(e) => setHorarioSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
              disabled={!tallerSeleccionado}
              style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', opacity: tallerSeleccionado ? 1 : 0.5 }}
            >
              <option value="">{tallerSeleccionado ? 'Seleccionar horario' : 'Primero seleccione un taller'}</option>
              {horariosFiltrados.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.dia_nombre} {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
              {horarioSeleccionado ? 'Docente (asignado al horario)' : 'Profesor'}
            </label>
            <select
              value={profesorSeleccionado || ''}
              onChange={(e) => setProfesorSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
              disabled={!!horarioSeleccionado}
              style={{ 
                width: '100%', 
                padding: '0.625rem', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px', 
                fontSize: '0.875rem',
                opacity: horarioSeleccionado ? 0.7 : 1,
                background: horarioSeleccionado ? '#f9fafb' : 'white',
              }}
            >
              <option value="">{horarioSeleccionado ? 'Docente del horario' : 'Seleccionar profesor'}</option>
              {profesores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {horarioSeleccionado && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Lista de Alumnos</h3>
                  {horarioSeleccionado && horariosFiltrados.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {horariosFiltrados.find(h => h.id === horarioSeleccionado)?.dia_nombre} {horariosFiltrados.find(h => h.id === horarioSeleccionado)?.hora_inicio?.substring(0, 5)} - {horariosFiltrados.find(h => h.id === horarioSeleccionado)?.hora_fin?.substring(0, 5)}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ padding: '0.25rem 0.75rem', background: '#d1fae5', color: '#059669', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {estadisticas.asistio} Asistieron
                  </span>
                  <span style={{ padding: '0.25rem 0.75rem', background: '#fef3c7', color: '#d97706', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {estadisticas.falta} Faltas
                  </span>
                  <span style={{ padding: '0.25rem 0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {estadisticas.falta_grave} F. Grave
                  </span>
                </div>
              </div>

              {loadingAlumnos ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
              ) : alumnosHorario.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay alumnos matriculados en este horario</div>
              ) : (
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {alumnosHorario.map((alumno) => {
                    const estadoInfo = getEstadoInfo(alumno.estado);
                    const tieneAsistencia = !!alumno.asistencia_id;
                    return (
                      <div key={alumno.matricula_id} style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: '#111827' }}>{alumno.alumno_nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{alumno.sesiones_disponibles} sesiones disponibles</div>
                          </div>
                          <span 
                            onClick={() => {
                              if (alumno.asistencia_id) {
                                const asistencia = historialAsistencias.find(a => a.id === alumno.asistencia_id);
                                if (asistencia) handleEditAsistencia(asistencia);
                              }
                            }}
                            style={{ 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '6px', 
                              fontSize: '0.75rem', 
                              fontWeight: '600', 
                              background: estadoInfo.bg, 
                              color: estadoInfo.color,
                              cursor: tieneAsistencia ? 'pointer' : 'default',
                              border: tieneAsistencia ? '2px solid' : 'none',
                              borderColor: tieneAsistencia ? estadoInfo.color : 'transparent'
                            }}
                          >
                            {estadoInfo.label}
                          </span>
                        </div>
                        {tieneAsistencia && (
                          <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.5rem' }}>
                            Editar desde el panel derecho
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {ESTADOS.map((estado) => (
                            <button
                              key={estado.value}
                              onClick={() => handleCambiarEstado(alumno, estado.value)}
                              disabled={saving || tieneAsistencia}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: saving || tieneAsistencia ? 'not-allowed' : 'pointer',
                                background: '#f3f4f6',
                                color: '#374151',
                              }}
                            >
                              {estado.label}
                            </button>
                          ))}
                        </div>
                        {tieneAsistencia && (
                          <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.25rem' }}>
                            (Registrado - editar desde panel derecho)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setShowRecuperacion(true)}
                  style={{ width: '100%', padding: '0.75rem', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: '8px', color: '#374151', fontWeight: '500', cursor: 'pointer' }}
                >
                  + Agregar Recuperación
                </button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Historial del Día</h3>
                {horarioSeleccionado && horariosFiltrados.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {horariosFiltrados.find(h => h.id === horarioSeleccionado)?.dia_nombre} {horariosFiltrados.find(h => h.id === horarioSeleccionado)?.hora_inicio?.substring(0, 5)} - {horariosFiltrados.find(h => h.id === horarioSeleccionado)?.hora_fin?.substring(0, 5)}
                  </p>
                )}
              </div>
              {historialAsistencias.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>Sin registros</div>
              ) : (
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {historialAsistencias.map((a) => {
                    const estadoInfo = getEstadoInfo(a.estado);
                    return (
                      <div
                        key={a.id}
                        onClick={() => handleEditAsistencia(a)}
                        style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '500', color: '#111827', fontSize: '0.875rem' }}>{a.alumno_nombre}</span>
                          <span style={{ padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.625rem', fontWeight: '600', background: estadoInfo.bg, color: estadoInfo.color }}>
                            {estadoInfo.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {a.hora?.substring(0, 5)} {a.es_recuperacion && '(Recuperación)'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Prof. {a.profesor_nombre}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecuperacion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Agregar Recuperación</h3>
            <input
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={busquedaRecuperacion}
              onChange={(e) => setBusquedaRecuperacion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarAlumnoRecuperacion()}
              style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '1rem' }}
            />
            <button onClick={buscarAlumnoRecuperacion} style={{ width: '100%', padding: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', marginBottom: '1rem', cursor: 'pointer' }}>Buscar</button>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {resultadosBusqueda.map((alumno) => (
                <div key={alumno.id} onClick={() => agregarRecuperacion(alumno)} style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '500' }}>{alumno.apellido}, {alumno.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>DNI: {alumno.dni}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowRecuperacion(false)} style={{ width: '100%', padding: '0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {editandoAsistencia && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Editar Asistencia</h3>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{editandoAsistencia.alumno_nombre}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{editandoAsistencia.fecha} {editandoAsistencia.hora?.substring(0, 5)}</div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Docente</label>
              <select
                value={editandoAsistencia.profesor || ''}
                onChange={(e) => {
                  const nuevoProfesor = e.target.value ? parseInt(e.target.value) : null;
                  setEditandoAsistencia({ ...editandoAsistencia, profesor: nuevoProfesor });
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
              >
                <option value="">Seleccionar docente</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Estado</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {ESTADOS.map((estado) => (
                  <button
                    key={estado.value}
                    onClick={() => setEditandoAsistencia({ ...editandoAsistencia, estado: estado.value })}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      background: editandoAsistencia.estado === estado.value ? estado.color : '#f3f4f6',
                      color: editandoAsistencia.estado === estado.value ? 'white' : '#374151',
                    }}
                  >
                    {estado.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Observación</label>
              <textarea
                value={editandoAsistencia.observacion}
                onChange={(e) => setEditandoAsistencia({ ...editandoAsistencia, observacion: e.target.value })}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setEditandoAsistencia(null); setEditandoProfesorOriginal(null); }} style={{ flex: 1, padding: '0.75rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => {
                if (editandoAsistencia.profesor !== editandoProfesorOriginal && editandoProfesorOriginal !== null) {
                  setShowConfirmProfesor1(true);
                } else {
                  guardarEdicionAsistencia();
                }
              }} disabled={saving} style={{ flex: 1, padding: '0.75rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
        )}

        {showConfirmProfesor1 && (
          <ConfirmModal
            isOpen={showConfirmProfesor1}
            title="Cambiar Docente"
            message={`¿Está seguro que desea cambiar el docente de esta asistencia de "${editandoAsistencia?.profesor_nombre}"?`}
            confirmLabel="Sí, cambiar"
            cancelLabel="Cancelar"
            onConfirm={() => { setShowConfirmProfesor1(false); setShowConfirmProfesor2(true); }}
            onCancel={() => { 
              setShowConfirmProfesor1(false); 
              if (editandoAsistencia && editandoProfesorOriginal !== null) {
                setEditandoAsistencia({ ...editandoAsistencia, profesor: editandoProfesorOriginal });
              }
            }}
          />
        )}

        {showConfirmProfesor2 && (
          <ConfirmModal
            isOpen={showConfirmProfesor2}
            title="Confirmar Cambio de Docente"
            message="Esta acción modificará el registro de asistencia. ¿Está completamente seguro?"
            confirmLabel="Sí, confirmar cambio"
            cancelLabel="Volver"
            onConfirm={() => { 
              setShowConfirmProfesor2(false);
              guardarEdicionAsistencia();
            }}
            onCancel={() => { 
              setShowConfirmProfesor2(false); 
              if (editandoAsistencia && editandoProfesorOriginal !== null) {
                setEditandoAsistencia({ ...editandoAsistencia, profesor: editandoProfesorOriginal });
              }
            }}
          />
        )}
    </div>
  );
}

export default memo(AsistenciasPage);
