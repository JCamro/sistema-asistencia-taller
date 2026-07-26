import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import { getApiBaseUrl } from '../../utils/api';
import AsistenciasFilterBar from './AsistenciasFilterBar';
import AsistenciaContenido, { type AsistenciaEdit } from './AsistenciaContenido';
import AsistenciaRecuperacionModal from './AsistenciaRecuperacionModal';
import AsistenciaEditModal from './AsistenciaEditModal';
import type { PorHorarioResponse } from '../../api/endpoints';

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

/**
 * AsistenciasPage — Pantalla de registro de asistencia diaria
 *
 * Esta página permite marcar asistencia (asistio/falta/falta_grave) por alumno,
 * organizada por taller → horario. También soporta clases de recuperación y
 * edición de registros individuales.
 *
 * Flujo: FilterBar (fecha, taller, horario) → Contenido (resumen de horarios
 * o tabla + historial) → Modales (recuperación, edición)
 */
function AsistenciasPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const apiBase = getApiBaseUrl();
  const [searchParams, setSearchParams] = useSearchParams();
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0];
  const tallerSeleccionado = searchParams.get('taller') ? Number(searchParams.get('taller')) : null;
  const horarioSeleccionado = searchParams.get('horario') ? Number(searchParams.get('horario')) : null;
  const [alumnosHorario, setAlumnosHorario] = useState<AlumnoHorario[]>([]);
  const [alumnosPorHorario, setAlumnosPorHorario] = useState<Map<number, AlumnoHorario[]>>(new Map());
  const [loadingTodosAlumnos, setLoadingTodosAlumnos] = useState(false);
  const [showRecuperacion, setShowRecuperacion] = useState(false);
  const [busquedaRecuperacion, setBusquedaRecuperacion] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<number | null>(null);
  const [profesorBloqueado, setProfesorBloqueado] = useState(true);
  const [editandoAsistencia, setEditandoAsistencia] = useState<Asistencia | null>(null);
  const [saving, setSaving] = useState(false);
  const [esFeriado, setEsFeriado] = useState(false);
  const [motivoFeriado, setMotivoFeriado] = useState<string | null>(null);

  const setFecha = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('fecha', value);
      return next;
    });
  };
  const setTallerSeleccionado = (value: number | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('taller', String(value));
      else next.delete('taller');
      next.delete('horario');
      return next;
    });
  };
  const setHorarioSeleccionado = (value: number | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('horario', String(value));
      else next.delete('horario');
      return next;
    });
  };
  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setProfesorSeleccionado(null);
  };

  // fetchData: carga horarios activos y profesores del ciclo una sola vez
  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [horariosResponse, profesoresResponse] = await Promise.all([
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/horarios/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/profesores/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [horariosJsonData, profesoresJsonData] = await Promise.all([horariosResponse.json(), profesoresResponse.json()]);
      setHorarios((horariosJsonData.results || horariosJsonData).filter((h: Horario) => h.activo));
      setProfesores((profesoresJsonData.results || profesoresJsonData).filter((p: any) => p.activo));
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
    }).then((response) => response.json()).then((jsonData) => {
      setAsistencias(jsonData.results || jsonData);
    });
  }, [cicloActual, fecha, apiBase]);

  // Convertir día JS (dom=0 → sáb=6) a nuestro modelo (lun=0 → dom=6)
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
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return { horarioId: h.id, alumnos: [] };
        const jsonData: PorHorarioResponse = await response.json();
        return { horarioId: h.id, alumnos: jsonData.resultados || [] };
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

  // Al cambiar el filtro de taller: resetear taller si ya no existe en la lista,
  // y resetear horario si el seleccionado ya no pertenece a los filtrados
  useEffect(() => {
    if (tallerSeleccionado && !talleres.some(t => t.id === tallerSeleccionado)) {
      setTallerSeleccionado(null);
      setHorarioSeleccionado(null);
    } else if (horarioSeleccionado && !horariosFiltrados.some((h) => h.id === horarioSeleccionado)) {
      setHorarioSeleccionado(null);
    }
  }, [talleres, tallerSeleccionado, horarioSeleccionado, horariosFiltrados]);

  useEffect(() => {
    if (horarioSeleccionado) {
      const horario = horarios.find((h) => h.id === horarioSeleccionado);
      if (horario) {
        setProfesorSeleccionado(horario.profesor);
        setProfesorBloqueado(true);
      }
    }
  }, [horarioSeleccionado, horarios]);

  const fetchAlumnosHorario = useCallback(async () => {
    if (!cicloActual || !horarioSeleccionado || !fecha) return [];
    setLoadingAlumnos(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = `${apiBase}/api/ciclos/${cicloActual.id}/asistencias/por-horario/?horario_id=${horarioSeleccionado}&fecha=${fecha}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error API:', errorData);
        setAlumnosHorario([]);
        setEsFeriado(false);
        setMotivoFeriado(null);
        return [];
      }
      const jsonData: PorHorarioResponse = await response.json();
      setEsFeriado(!!jsonData.es_feriado);
      setMotivoFeriado(jsonData.motivo || null);
      const resultados = jsonData.resultados || [];
      setAlumnosHorario(resultados);
      return resultados;
    } catch (err) {
      console.error('Error:', err);
      setAlumnosHorario([]);
      setEsFeriado(false);
      setMotivoFeriado(null);
      return [];
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
    const sesionesPrevias = alumno.sesiones_disponibles;
    try {
      let response;
      if (alumno.asistencia_id) {
        response = await fetch(`${apiBase}/api/asistencias/${alumno.asistencia_id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ estado: nuevoEstado }),
        });
      } else {
        response = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, {
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
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error API:', errorData);
        showApiError(new Error(JSON.stringify(errorData)));
        setSaving(false);
        return;
      }
      const nuevosAlumnos = await fetchAlumnosHorario();
      await fetchTodosAlumnos();
      const responseList = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, { headers: { Authorization: `Bearer ${token}` } });
      const jsonData = await responseList.json();
      setAsistencias((jsonData.results || jsonData).filter((a: Asistencia) => a.activo !== false));
      const alumnoActualizado = nuevosAlumnos.find((a) => a.alumno_id === alumno.alumno_id);
      if (sesionesPrevias > 0 && alumnoActualizado && alumnoActualizado.sesiones_disponibles === 0) {
        showToast(`La matrícula de ${alumno.alumno_nombre} ha concluido`, 'success');
      }
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
      const response = await fetch(
        `${apiBase}/api/ciclos/${cicloActual.id}/asistencias/recuperables/?horario_id=${horarioSeleccionado}&fecha=${fecha}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        console.error('Error fetching recuperables:', response.status);
        setResultadosBusqueda([]);
        return;
      }
      const jsonData = await response.json();
      const filtrados = (jsonData || []).filter((a: any) =>
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
      const response = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, {
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
      if (!response.ok) {
        const errorData = await response.json();
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
      const responseList = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, { headers: { Authorization: `Bearer ${token}` } });
      const jsonData = await responseList.json();
      setAsistencias((jsonData.results || jsonData).filter((a: Asistencia) => a.activo !== false));
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
      const response = await fetch(`${apiBase}/api/asistencias/${asistencia.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          estado: asistencia.estado,
          observacion: asistencia.observacion,
          hora: horaActual,
          profesor: asistencia.profesor,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error API:', errorData);
        showApiError(new Error(JSON.stringify(errorData)));
        setSaving(false);
        return;
      }
      setEditandoAsistencia(null);
      await fetchAlumnosHorario();
      const responseList = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/asistencias/`, { headers: { Authorization: `Bearer ${token}` } });
      const jsonData = await responseList.json();
      setAsistencias(jsonData.results || jsonData);
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
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
        profesorBloqueado={profesorBloqueado}
        onToggleProfesorBloqueado={() => setProfesorBloqueado((prev) => !prev)}
        onClear={clearFilters}
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
        esFeriado={esFeriado}
        motivoFeriado={motivoFeriado}
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
