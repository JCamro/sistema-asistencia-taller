import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/ui/PageHeader';
import { getApiBaseUrl } from '../utils/api';
import AsistenciasFilterBar from './AsistenciasFilterBar';
import AsistenciaContenido, { type AsistenciaEdit } from './AsistenciaContenido';
import AsistenciaRecuperacionModal from './AsistenciaRecuperacionModal';
import AsistenciaEditModal from './AsistenciaEditModal';

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
}

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
  const [alumnosPorHorario, setAlumnosPorHorario] = useState<Map<number, AlumnoHorario[]>>(new Map());
  const [loadingTodosAlumnos, setLoadingTodosAlumnos] = useState(false);
  const [showRecuperacion, setShowRecuperacion] = useState(false);
  const [busquedaRecuperacion, setBusquedaRecuperacion] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<number | null>(null);
  const [editandoAsistencia, setEditandoAsistencia] = useState<Asistencia | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [horariosRes, profesRes] = await Promise.all([
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/horarios/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/profesores/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [horariosData, profesData] = await Promise.all([horariosRes.json(), profesRes.json()]);
      setHorarios((horariosData.results || horariosData).filter((h: Horario) => h.activo));
      setProfesores((profesData.results || profesData).filter((p: any) => p.activo));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, apiBase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).then((data) => {
      setAsistencias(data.results || data);
    });
  }, [cicloActual, fecha, apiBase]);

  const diaSemana = useMemo(() => {
    const jsDay = new Date(fecha + 'T00:00:00').getDay();
    return (jsDay + 6) % 7;
  }, [fecha]);

  const { horariosDelDia, talleres } = useMemo(() => {
    const delDia = horarios.filter((h) => Number(h.dia_semana) === diaSemana);
    const mapa = new Map<number, string>();
    for (const h of delDia) {
      if (!mapa.has(h.taller)) mapa.set(h.taller, h.taller_nombre);
    }
    return {
      horariosDelDia: delDia,
      talleres: Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }, [horarios, diaSemana]);

  const horariosFiltrados = useMemo(() => {
    if (!tallerSeleccionado) return horariosDelDia;
    return horariosDelDia.filter((h) => h.taller === tallerSeleccionado);
  }, [horariosDelDia, tallerSeleccionado]);

  const fetchTodosAlumnos = useCallback(async () => {
    if (!cicloActual || horariosFiltrados.length === 0 || !fecha) return;
    setLoadingTodosAlumnos(true);
    const token = localStorage.getItem('access_token');
    try {
      const promises = horariosFiltrados.map(async (h) => {
        const url = `${apiBase}/api/ciclos/${cicloActual.id}/asistencias/por-horario/?horario_id=${h.id}&fecha=${fecha}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return { horarioId: h.id, alumnos: [] };
        const data = await res.json();
        return { horarioId: h.id, alumnos: Array.isArray(data) ? data : (data.results || []) };
      });
      const results = await Promise.all(promises);
      const mapa = new Map<number, AlumnoHorario[]>();
      results.forEach(({ horarioId, alumnos }) => mapa.set(horarioId, alumnos));
      setAlumnosPorHorario(mapa);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingTodosAlumnos(false);
    }
  }, [cicloActual, horariosFiltrados, fecha, apiBase]);

  useEffect(() => {
    if (tallerSeleccionado && !talleres.some((t) => t.id === tallerSeleccionado)) {
      setTallerSeleccionado(null);
      setHorarioSeleccionado(null);
    } else if (horarioSeleccionado && !horariosFiltrados.some((h) => h.id === horarioSeleccionado)) {
      setHorarioSeleccionado(null);
    }
  }, [talleres, tallerSeleccionado, horarioSeleccionado, horariosFiltrados]);

  useEffect(() => {
    if (horarioSeleccionado) {
      const horario = horarios.find((h) => h.id === horarioSeleccionado);
      if (horario) setProfesorSeleccionado(horario.profesor);
    }
  }, [horarioSeleccionado, horarios]);

  const fetchAlumnosHorario = useCallback(async () => {
    if (!cicloActual || !horarioSeleccionado || !fecha) return;
    setLoadingAlumnos(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = `${apiBase}/api/ciclos/${cicloActual.id}/asistencias/por-horario/?horario_id=${horarioSeleccionado}&fecha=${fecha}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error API:', errorData);
        setAlumnosHorario([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setAlumnosHorario(data);
      else if (data.results) setAlumnosHorario(data.results);
      else setAlumnosHorario([]);
    } catch (err) {
      console.error('Error:', err);
      setAlumnosHorario([]);
    } finally {
      setLoadingAlumnos(false);
    }
  }, [cicloActual, horarioSeleccionado, fecha, apiBase]);

  useEffect(() => {
    if (horarioSeleccionado && fecha) fetchAlumnosHorario();
  }, [horarioSeleccionado, fecha, fetchAlumnosHorario]);

  useEffect(() => {
    if (fecha && horariosFiltrados.length > 0) fetchTodosAlumnos();
  }, [fecha, horariosFiltrados, fetchTodosAlumnos]);

  const handleCambiarEstado = async (alumno: AlumnoHorario, nuevoEstado: string) => {
    if (!cicloActual || !profesorSeleccionado) {
      showToast('Seleccionar un horario primero', 'warning');
      return;
    }
    setSaving(true);
    const token = localStorage.getItem('access_token');
    const horaActual = new Date().toTimeString().slice(0, 5);
    try {
      let res;
      if (alumno.asistencia_id) {
        res = await fetch(`${apiBase}/api/asistencias/${alumno.asistencia_id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ estado: nuevoEstado }),
        });
      } else {
        res = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, {
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
      await fetchTodosAlumnos();
      const resList = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, { headers: { Authorization: `Bearer ${token}` } });
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
    if (!cicloActual || !horarioSeleccionado || !busquedaRecuperacion) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(
        `${apiBase}/api/ciclos/${cicloActual.id}/asistencias/recuperables/?horario_id=${horarioSeleccionado}&fecha=${fecha}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        console.error('Error fetching recuperables:', res.status);
        setResultadosBusqueda([]);
        return;
      }
      const data = await res.json();
      const filtrados = (data || []).filter((a: any) =>
        a.alumno_nombre.toLowerCase().includes(busquedaRecuperacion.toLowerCase())
      );
      setResultadosBusqueda(filtrados.slice(0, 5));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const agregarRecuperacion = async (alumno: any) => {
    if (!cicloActual || !horarioSeleccionado || !profesorSeleccionado || !alumno.matricula_id) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const horaActual = new Date().toTimeString().slice(0, 5);
      const res = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          matricula: alumno.matricula_id,
          horario: horarioSeleccionado,
          profesor: profesorSeleccionado,
          fecha: fecha,
          hora: horaActual,
          estado: 'asistio',
          es_recuperacion: true,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error API:', errorData);
        showApiError(new Error(JSON.stringify(errorData)));
        setSaving(false);
        return;
      }
      setShowRecuperacion(false);
      setBusquedaRecuperacion('');
      setResultadosBusqueda([]);
      await fetchAlumnosHorario();
      await fetchTodosAlumnos();
      const resList = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resList.json();
      setAsistencias((data.results || data).filter((a: Asistencia) => a.activo !== false));
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAsistencia = (asistencia: AsistenciaEdit) => {
    setEditandoAsistencia(asistencia as Asistencia);
  };

  const handleEditAsistenciaFromAlumno = (alumno: AlumnoHorario) => {
    if (!alumno.asistencia_id) return;
    const asistencia = asistencias.find((a) => a.id === alumno.asistencia_id);
    if (asistencia) handleEditAsistencia(asistencia);
  };

  const guardarEdicionAsistencia = async (asistencia: Asistencia) => {
    if (!cicloActual) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    const horaActual = new Date().toTimeString().slice(0, 5);
    try {
      const res = await fetch(`${apiBase}/api/asistencias/${asistencia.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          estado: asistencia.estado,
          observacion: asistencia.observacion,
          hora: horaActual,
          profesor: asistencia.profesor,
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
      await fetchAlumnosHorario();
      const resList = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resList.json();
      setAsistencias(data.results || data);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <PageHeader title="Asistencias" cicloNombre={cicloActual?.nombre} />

      <AsistenciasFilterBar
        fecha={fecha}
        onFechaChange={setFecha}
        tallerSeleccionado={tallerSeleccionado}
        onTallerChange={setTallerSeleccionado}
        horarioSeleccionado={horarioSeleccionado}
        onHorarioChange={setHorarioSeleccionado}
        profesorSeleccionado={profesorSeleccionado}
        onProfesorChange={setProfesorSeleccionado}
        talleres={talleres}
        horariosFiltrados={horariosFiltrados}
        profesores={profesores}
      />

      <AsistenciaContenido
        loading={loading}
        fecha={fecha}
        tallerSeleccionado={tallerSeleccionado}
        horarioSeleccionado={horarioSeleccionado}
        horariosDelDia={horariosDelDia}
        horariosFiltrados={horariosFiltrados}
        alumnosHorario={alumnosHorario}
        loadingAlumnos={loadingAlumnos}
        saving={saving}
        asistencias={asistencias}
        alumnosPorHorario={alumnosPorHorario}
        loadingTodosAlumnos={loadingTodosAlumnos}
        onEstadoChange={handleCambiarEstado}
        onEditAsistenciaFromAlumno={handleEditAsistenciaFromAlumno}
        onEditAsistencia={handleEditAsistencia}
        onOpenRecuperacion={() => setShowRecuperacion(true)}
      />

      <AsistenciaRecuperacionModal
        isOpen={showRecuperacion}
        busqueda={busquedaRecuperacion}
        onBusquedaChange={setBusquedaRecuperacion}
        onSearch={buscarAlumnoRecuperacion}
        resultados={resultadosBusqueda}
        onSeleccionar={agregarRecuperacion}
        onClose={() => setShowRecuperacion(false)}
      />

      <AsistenciaEditModal
        isOpen={editandoAsistencia !== null}
        asistencia={editandoAsistencia}
        profesores={profesores}
        saving={saving}
        onClose={() => setEditandoAsistencia(null)}
        onSave={guardarEdicionAsistencia}
      />
    </div>
  );
}

export default memo(AsistenciasPage);
