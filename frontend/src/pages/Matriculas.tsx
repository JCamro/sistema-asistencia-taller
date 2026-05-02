import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import TraspasoModal from '../components/ui/TraspasoModal';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { Pagination } from '../components/ui/Pagination';
import api from '../api/axios';
import { utcToLimaDate, formatLimaDate } from '../utils/timezone';
import { getMatriculas } from '../api/endpoints';

const HORAS_GRID = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const DIAS_GRID = [
  { value: 0, label: 'Lunes', abbr: 'Lun' },
  { value: 1, label: 'Martes', abbr: 'Mar' },
  { value: 2, label: 'Miércoles', abbr: 'Mié' },
  { value: 3, label: 'Jueves', abbr: 'Jue' },
  { value: 4, label: 'Viernes', abbr: 'Vie' },
  { value: 5, label: 'Sábado', abbr: 'Sáb' },
  { value: 6, label: 'Domingo', abbr: 'Dom' },
];

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
  dni?: string;
  telefono?: string;
}

interface Taller {
  id: number;
  nombre: string;
  activo: boolean;
}

interface Horario {
  id: number;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  profesor_nombre: string;
  cupo_maximo: number;
  ocupacion: number;
  cupo_disponible: number;
  activo: boolean;
}

interface Matricula {
  id: number;
  alumno: number;
  alumno_nombre: string;
  ciclo: number;
  taller: number;
  taller_nombre: string;
  sesiones_contratadas: number;
  precio_total: number;
  precio_por_sesion: number;
  metodo_pago: string;
  activo: boolean;
  concluida: boolean;
  estado_calculado: 'activa' | 'inactiva' | 'concluida' | 'no_procesado';
  sesiones_consumidas: number;
  sesiones_disponibles: number;
  fecha_matricula: string;
  created_at: string;
  updated_at: string;
}

interface MatriculaFormData {
  alumno: number | '';
  taller: number | '';
  horarios: number[];
  sesiones_contratadas: number;
  precio_total: string;
  metodo_pago: string;
  activo: boolean;
  concluida: boolean;
  fecha_matricula: string;
}

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

const initialFormData: MatriculaFormData = {
  alumno: '',
  taller: '',
  horarios: [],
  sesiones_contratadas: 8,
  precio_total: '',
  metodo_pago: 'efectivo',
  activo: true,
  concluida: false,
  fecha_matricula: '',
};

function MatriculasPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<MatriculaFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [alumnoSearch, setAlumnoSearch] = useState('');
  const [showAlumnoDropdown, setShowAlumnoDropdown] = useState(false);
  const [horariosLoading, setHorariosLoading] = useState(false);
  const [viewMatricula, setViewMatricula] = useState<Matricula | null>(null);
  const [asistenciasDetalle, setAsistenciasDetalle] = useState<AsistenciaDetalle[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [traspasandoId, setTraspasandoId] = useState<number | null>(null);
  const [traspasandoNombre, setTraspasandoNombre] = useState<string>('');
  const [traspasandoTaller, setTraspasandoTaller] = useState<string>('');
  const [traspasandoLoading, setTraspasandoLoading] = useState(false);
  const [eliminandoAsistenciaId, setEliminandoAsistenciaId] = useState<number | null>(null);
  const [eliminandoAsistenciaInfo, setEliminandoAsistenciaInfo] = useState<string>('');
  const [segundaConfirmacion, setSegundaConfirmacion] = useState(false);
  const [verHorarioMatriculaId, setVerHorarioMatriculaId] = useState<number | null>(null);
  const [horariosDetalle, setHorariosDetalle] = useState<HorarioDetalle[]>([]);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [precioSugerido, setPrecioSugerido] = useState<number | null>(null);
  const [calculandoPrecio, setCalculandoPrecio] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchMatriculas = useCallback(async (page: number = 1, search?: string) => {
    if (!cicloActual) return;
    try {
      const res = await getMatriculas(cicloActual.id, page, search);
      const matriculasData = res.data.results || res.data;
      setMatriculas(Array.isArray(matriculasData) ? matriculasData : []);
      setTotalPages(Math.ceil((res.data.count || 0) / 20) || 1);
      setTotalCount(res.data.count || 0);
      setCurrentPage(page);
    } catch (err: any) {
      console.error('Error fetching matriculas:', err);
      if (err.response?.status === 401) {
        showToast('Sesión expirada. Iniciá sesión de nuevo.', 'error');
      }
    }
  }, [cicloActual, showToast]);

  const fetchLookups = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const [alumnosRes, talleresRes, horariosMatriculasRes] = await Promise.all([
        api.get(`/ciclos/${cicloActual.id}/alumnos/`),
        api.get(`/ciclos/${cicloActual.id}/talleres/`),
        api.get(`/matriculas-horarios/?matricula__ciclo=${cicloActual.id}`),
      ]);
      
      const alumnosData = alumnosRes.data.results || alumnosRes.data;
      const talleresData = talleresRes.data.results || talleresRes.data;
      const horariosMatriculasData = horariosMatriculasRes.data.results || horariosMatriculasRes.data;
      
      setAlumnos(Array.isArray(alumnosData) ? alumnosData.filter((a: Alumno) => a.activo) : []);
      setTalleres(Array.isArray(talleresData) ? talleresData.filter((t: Taller) => t.activo) : []);
      
      // Mapear horarios por matrícula
      const mhMap = new Map<number, { dia_semana: number; hora_inicio: string }[]>();
      const mhList: any[] = Array.isArray(horariosMatriculasData) ? horariosMatriculasData : [];
      mhList.forEach((mh: any) => {
        const matriculaId = mh.matricula;
        const horaInfo = {
          dia_semana: mh.horario_dia_semana,
          hora_inicio: mh.horario_hora_inicio,
        };
        if (!mhMap.has(matriculaId)) {
          mhMap.set(matriculaId, []);
        }
        mhMap.get(matriculaId)!.push(horaInfo);
      });
    } catch (err: any) {
      console.error('Error fetching lookups:', err);
      if (err.response?.status === 401) {
        showToast('Sesión expirada. Iniciá sesión de nuevo.', 'error');
      }
    }
  }, [cicloActual, showToast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMatriculas(1), fetchLookups()]).finally(() => setLoading(false));
  }, [cicloActual, fetchMatriculas, fetchLookups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    fetchMatriculas(1, debouncedSearch);
  }, [fetchMatriculas, debouncedSearch]);

  const fetchHorarios = useCallback(async (tallerId: number) => {
    if (!cicloActual) return;
    setHorariosLoading(true);
    try {
      const res = await api.get(`/ciclos/${cicloActual.id}/horarios/?taller=${tallerId}`);
      const data = res.data.results || res.data;
      const horariosData = Array.isArray(data) ? data.filter((h: Horario) => h.activo) : [];
      setHorarios(horariosData);
    } catch (err: any) {
      console.error('Error fetching horarios:', err);
    } finally {
      setHorariosLoading(false);
    }
  }, [cicloActual]);

  const horariosGrid = useMemo(() => {
    const grid: { [key: string]: Horario[] } = {};
    horarios.forEach((h) => {
      const hora = h.hora_inicio ? h.hora_inicio.substring(0, 2) : '00';
      const key = `${h.dia_semana}-${hora}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(h);
    });
    return grid;
  }, [horarios]);

  const fetchAsistenciasDetalle = useCallback(async (matricula: Matricula) => {
    setViewMatricula(matricula);
    setLoadingDetalle(true);
    setAsistenciasDetalle([]);
    try {
      const res = await api.get(`/asistencias/?matricula=${matricula.id}`);
      const data = res.data.results || res.data;
      const lista = Array.isArray(data) ? data as AsistenciaDetalle[] : [];
      setAsistenciasDetalle(lista.sort((a, b) => {
        if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
        return b.hora.localeCompare(a.hora);
      }));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingDetalle(false);
    }
  }, []);

  const fetchHorariosDetalle = useCallback(async (matriculaId: number) => {
    try {
      const res = await api.get(`/matriculas/${matriculaId}/horarios/`);
      const data = res.data.results || res.data;
      setHorariosDetalle(Array.isArray(data) ? data as HorarioDetalle[] : []);
    } catch (err) {
      console.error('Error:', err);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuAbierto(null);
    if (menuAbierto !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuAbierto]);

  useEffect(() => {
    if (formData.taller) {
      fetchHorarios(Number(formData.taller));
    } else {
      setHorarios([]);
    }
  }, [formData.taller, fetchHorarios]);

  useEffect(() => {
    if (!formData.taller || !formData.sesiones_contratadas || formData.sesiones_contratadas < 1) {
      setPrecioSugerido(null);
      return;
    }
    let cancelled = false;
    const calcular = async () => {
      setCalculandoPrecio(true);
      try {
        const res = await api.get(`/matriculas/calcular-precio/?taller_id=${formData.taller}&sesiones=${formData.sesiones_contratadas}`);
        const data = res.data;
        if (!cancelled) {
          setPrecioSugerido(data.precio_total > 0 ? data.precio_total : null);
          if (data.precio_total > 0) {
            setFormData(prev => ({ ...prev, precio_total: data.precio_total.toString() }));
          }
        }
      } catch {
        if (!cancelled) setPrecioSugerido(null);
      } finally {
        if (!cancelled) setCalculandoPrecio(false);
      }
    };
    calcular();
    return () => { cancelled = true; };
  }, [formData.taller, formData.sesiones_contratadas]);

  const filteredAlumnos = useMemo(() => {
    if (!alumnoSearch) return [];
    const searchLower = alumnoSearch.toLowerCase();
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchLower) || 
      a.apellido.toLowerCase().includes(searchLower) ||
      a.dni?.includes(alumnoSearch)
    ).slice(0, 10);
  }, [alumnoSearch, alumnos]);

  const filteredMatriculas = useMemo(() => {
    // Server-side text search via debouncedSearch
    // Client-side filtering only handles estado filter
    
    return matriculas.filter((m) => {
      // Filtro por estado
      const coincideEstado = filtroEstado === 'todas' || 
        (filtroEstado === 'activa' && m.estado_calculado === 'activa') ||
        (filtroEstado === 'inactiva' && m.estado_calculado === 'inactiva') ||
        (filtroEstado === 'concluida' && m.estado_calculado === 'concluida') ||
        (filtroEstado === 'no_procesado' && m.estado_calculado === 'no_procesado') ||
        (filtroEstado === 'por_concluir' && m.estado_calculado === 'activa' && m.sesiones_disponibles <= 3);
      
      return coincideEstado;
    });
  }, [matriculas, filtroEstado]);

  const toggleHorario = (horarioId: number) => {
    const current = formData.horarios || [];
    if (current.includes(horarioId)) {
      setFormData({ ...formData, horarios: current.filter(id => id !== horarioId) });
    } else {
      setFormData({ ...formData, horarios: [...current, horarioId] });
    }
  };

  const calcularFrecuencia = useMemo(() => {
    const diasUnicos = new Set(
      horarios.filter(h => formData.horarios.includes(h.id)).map(h => h.dia_semana)
    );
    return diasUnicos.size;
  }, [formData.horarios, horarios]);

  const calcularDuracion = useMemo(() => {
    if (calcularFrecuencia === 0 || formData.sesiones_contratadas === 0) return 0;
    return Math.ceil(formData.sesiones_contratadas / calcularFrecuencia);
  }, [formData.sesiones_contratadas, calcularFrecuencia]);

  const handlePageChange = (page: number) => {
    fetchMatriculas(page);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual || !formData.alumno || !formData.taller || formData.horarios.length === 0) {
      showToast('Por favor complete todos los campos requeridos', 'warning');
      return;
    }
    if (!formData.precio_total || parseFloat(formData.precio_total) <= 0) {
      showToast('El monto total debe ser mayor a 0', 'warning');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/matriculas/${editingId}/` : `/ciclos/${cicloActual.id}/matriculas/`;
      
      // Enviar fecha_matricula como string (Django interpreta como midnight Lima timezone)
      const payload: Record<string, unknown> = {
        alumno: formData.alumno,
        taller: formData.taller,
        sesiones_contratadas: formData.sesiones_contratadas,
        precio_total: parseFloat(formData.precio_total),
        metodo_pago: formData.metodo_pago,
        fecha_matricula: formData.fecha_matricula || null,
      };

      if (editingId) {
        payload.activo = formData.activo;
        payload.concluida = formData.concluida;
      }

      if (!editingId && formData.horarios.length > 0) {
        payload.horarios = formData.horarios;
      }

      const res = editingId 
        ? await api.patch(url, payload)
        : await api.post(url, payload);
      
      const matriculaData = res.data;

      if (!editingId && formData.horarios.length > 0) {
        // Crear nuevos horarios para nueva matrícula
        for (const horarioId of formData.horarios) {
          try {
            await api.post('/matriculas-horarios/', {
              matricula: matriculaData.id,
              horario: horarioId,
            });
          } catch (err: any) {
            // Si ya existe (idempotente), no es error
            if (!err.response || (err.response.status !== 400 && err.response.status !== 200)) {
              throw err;
            }
          }
        }
      } else if (editingId) {
        // Obtener horarios actuales y actualizarlos
        const resHorarios = await api.get(`/matriculas-horarios/?matricula=${editingId}`);
        const dataHorarios = resHorarios.data.results || resHorarios.data;
        const horariosActuales: number[] = Array.isArray(dataHorarios) ? dataHorarios.map((mh: any) => mh.horario) : [];
        
        // Eliminar horarios que ya no están seleccionados
        for (const horarioId of horariosActuales) {
          if (!formData.horarios.includes(horarioId)) {
            const mhToDelete = Array.isArray(dataHorarios) ? dataHorarios.find((mh: any) => mh.horario === horarioId) : null;
            if (mhToDelete) {
              await api.delete(`/matriculas-horarios/${mhToDelete.id}/`);
            }
          }
        }
        
        // Agregar nuevos horarios
        for (const horarioId of formData.horarios) {
          if (!horariosActuales.includes(horarioId)) {
            try {
              await api.post('/matriculas-horarios/', {
                matricula: editingId,
                horario: horarioId,
              });
            } catch (err: any) {
              // Si ya existe (idempotente), no es error
              if (!err.response || (err.response.status !== 400 && err.response.status !== 200)) {
                throw err;
              }
            }
          }
        }
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      showToast(editingId ? 'Matrícula actualizada' : 'Matrícula creada', 'success');
      fetchMatriculas(currentPage);
    } catch (err: any) {
      console.error('Error saving matricula:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (matricula: Matricula) => {
    // Primero cargamos los horarios existentes
    let horariosExistentes: number[] = [];
    try {
      const res = await api.get(`/matriculas-horarios/?matricula=${matricula.id}`);
      const data = res.data.results || res.data;
      horariosExistentes = Array.isArray(data) ? data.map((mh: any) => mh.horario) : [];
    } catch (err) {
      console.error('Error loading horarios:', err);
    }
    
    setEditingId(matricula.id);
    setAlumnoSearch(matricula.alumno_nombre);
    setFormData({
      alumno: matricula.alumno,
      taller: matricula.taller,
      horarios: horariosExistentes,
      sesiones_contratadas: matricula.sesiones_contratadas,
      precio_total: matricula.precio_total.toString(),
      metodo_pago: matricula.metodo_pago || 'efectivo',
      activo: matricula.activo,
      concluida: matricula.concluida,
      fecha_matricula: utcToLimaDate(matricula.fecha_matricula) || new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleDelete = (id: number, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/matriculas/${deletingId}/`);
      showToast('Matrícula eliminada', 'success');
      // If deleting the last item on a page, go to previous page
      const newPage = matriculas.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      fetchMatriculas(newPage);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setDeletingId(null);
      setDeletingName('');
    }
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeletingName('');
  };

  const confirmarEliminarAsistencia = (asistencia: AsistenciaDetalle) => {
    setEliminandoAsistenciaId(asistencia.id);
    setEliminandoAsistenciaInfo(`${asistencia.fecha} ${asistencia.horario_hora_inicio?.substring(0,5)} a ${asistencia.horario_hora_fin?.substring(0,5)}`);
    setSegundaConfirmacion(false);
  };

  const handleEliminarAsistencia = async () => {
    if (!eliminandoAsistenciaId || !segundaConfirmacion) return;
    try {
      await api.delete(`/asistencias/${eliminandoAsistenciaId}/`);
      setAsistenciasDetalle(prev => prev.filter(a => a.id !== eliminandoAsistenciaId));
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

  const handleTraspaso = async (alumnoDestinoId: number) => {
    if (!traspasandoId) return;
    setTraspasandoLoading(true);
    try {
      const res = await api.post(`/matriculas/${traspasandoId}/traspasar/`, {
        alumno_destino_id: alumnoDestinoId,
      });
      showToast(res.data.detail || 'Traspaso realizado exitosamente', 'success');
      setTraspasandoId(null);
      setTraspasandoNombre('');
      setTraspasandoTaller('');
      fetchMatriculas(currentPage);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setTraspasandoLoading(false);
    }
  };

  const cancelTraspaso = () => {
    setTraspasandoId(null);
    setTraspasandoNombre('');
    setTraspasandoTaller('');
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setAlumnoSearch('');
    setShowAlumnoDropdown(false);
    setShowModal(true);
  };

  const selectAlumno = (alumno: Alumno) => {
    setFormData({ ...formData, alumno: alumno.id });
    setAlumnoSearch(`${alumno.apellido}, ${alumno.nombre}`);
    setShowAlumnoDropdown(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #40E0D0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Matrículas</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{totalCount} matrículas activas</p>
        </div>
        <button onClick={openCreateModal} disabled={alumnos.length === 0 || talleres.length === 0} style={{ background: alumnos.length === 0 || talleres.length === 0 ? '#e5e7eb' : '#40E0D0', color: '#000000', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.875rem', cursor: (alumnos.length === 0 || talleres.length === 0) ? 'not-allowed' : 'pointer' }}>
          <span>+</span> Nueva Matrícula
        </button>
      </div>

      {alumnos.length === 0 && <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', marginBottom: '1.5rem', color: '#b45309', fontSize: '0.875rem' }}>⚠️ Debes crear alumnos y talleres primero.</div>}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Buscar por alumno, taller..." 
            value={searchText} 
            onChange={(e) => setSearchText(e.target.value)} 
            style={{ flex: 1, minWidth: '200px', padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }} 
          />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white', minWidth: '140px' }}>
            <option value="todas">Todas</option>
            <option value="activa">Activas</option>
            <option value="por_concluir">Por concluir (≤3 clases)</option>
            <option value="no_procesado">No Procesado</option>
            <option value="inactiva">Inactivas</option>
            <option value="concluida">Concluidas</option>
          </select>
        </div>
        <ResponsiveTable<Matricula>
          columns={[
            {
              key: 'alumno_nombre',
              label: 'Alumno',
              render: (m) => <div style={{ fontWeight: '600', color: '#111827' }}>{m.alumno_nombre}</div>,
            },
            { key: 'taller_nombre', label: 'Taller' },
            {
              key: 'sesiones',
              label: 'Sesiones',
              align: 'center',
              render: (m: Matricula) => (
                <span style={{ fontFamily: 'monospace', color: m.sesiones_disponibles > 0 ? '#059669' : '#dc2626' }}>
                  {m.sesiones_consumidas}/{m.sesiones_contratadas}
                </span>
              ),
            },
            {
              key: 'precio_total',
              label: 'Total',
              align: 'right',
              render: (m: Matricula) => <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>S/. {m.precio_total}</span>,
            },
            {
              key: 'estado',
              label: 'Estado',
              align: 'center',
              render: (m: Matricula) => (
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  background: m.estado_calculado === 'no_procesado' ? '#fef3c7' : m.estado_calculado === 'activa' ? '#d1fae5' : m.estado_calculado === 'concluida' ? '#fcd34d' : '#f3f4f6',
                  color: m.estado_calculado === 'no_procesado' ? '#b45309' : m.estado_calculado === 'activa' ? '#059669' : m.estado_calculado === 'concluida' ? '#92400e' : '#6b7280'
                }}>
                  {m.estado_calculado === 'no_procesado' ? 'No Procesado' : m.estado_calculado === 'activa' ? 'Activa' : m.estado_calculado === 'concluida' ? 'Concluida' : 'Inactiva'}
                </span>
              ),
            },
            {
              key: 'fecha_matricula',
              label: 'Fecha Matrícula',
              align: 'center',
              render: (m: Matricula) => formatLimaDate(m.fecha_matricula) || '-',
            },
          ]}
          data={filteredMatriculas}
          keyField="id"
          actions={(m) => (
            <>
              <button
                onClick={() => { setVerHorarioMatriculaId(m.id); fetchHorariosDetalle(m.id); }}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Ver
              </button>
              <button
                onClick={() => fetchAsistenciasDetalle(m)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Asistencias
              </button>
              <button
                onClick={() => handleEdit(m)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#40E0D0', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(m.id, m.alumno_nombre)}
                disabled={deletingId === m.id}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: deletingId === m.id ? '#9ca3af' : '#ef4444', cursor: deletingId === m.id ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                {deletingId === m.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </>
          )}
          emptyMessage="No hay matrículas"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{editingId ? 'Editar Matrícula' : 'Nueva Matrícula'}</h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              
              {/* SECCIÓN 1: DATOS DEL ALUMNO */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Datos del Alumno</h3>
                {editingId ? (
                  <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span style={{ fontWeight: '600', color: '#374151' }}>{alumnoSearch}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>No editable · Use traspaso para cambiar</span>
                  </div>
                ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Escribe el nombre del alumno..."
                    value={alumnoSearch}
                    onChange={(e) => { setAlumnoSearch(e.target.value); setShowAlumnoDropdown(true); setFormData({ ...formData, alumno: '' }); }}
                    onFocus={() => setShowAlumnoDropdown(true)}
                    style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                  {showAlumnoDropdown && filteredAlumnos.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflow: 'auto', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                      {filteredAlumnos.map((alumno) => (
                        <div
                          key={alumno.id}
                          onClick={() => selectAlumno(alumno)}
                          style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ fontWeight: '500', color: '#111827' }}>{alumno.apellido}, {alumno.nombre}</div>
                          {alumno.dni && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>DNI: {alumno.dni}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* SECCIÓN 2: TALLER Y HORARIOS */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Taller y Horarios</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <select
                    value={formData.taller}
                    onChange={(e) => setFormData({ ...formData, taller: e.target.value ? parseInt(e.target.value) : '', horarios: [] })}
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}
                  >
                    <option value="">Seleccionar taller</option>
                    {talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>

                {formData.taller && (
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                      Seleccionar Horarios Semanales (1h)
                    </div>
                    {horariosLoading ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando horarios...</div>
                    ) : horarios.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>No hay horarios disponibles para este taller</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                          <thead>
                            <tr style={{ background: '#f9fafb' }}>
                              <th style={{ padding: '0.5rem', width: '60px', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280' }}>Hora</th>
                              {DIAS_GRID.map(d => (
                                <th key={d.value} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280' }}>{d.abbr}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {HORAS_GRID.map(hora => {
                              const horaStr = hora.toString().padStart(2, '0');
                              return (
                                <tr key={hora}>
                                  <td style={{ padding: '0.25rem', textAlign: 'center', fontSize: '0.7rem', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                                    {horaStr}:00
                                  </td>
                                  {DIAS_GRID.map(dia => {
                                    const key = `${dia.value}-${horaStr}`;
                                    const horariosEnCelda = horariosGrid[key] || [];
                                    
                                    return (
                                      <td key={key} style={{ padding: '0.25rem', border: '1px solid #e5e7eb', minHeight: '50px', verticalAlign: 'top', background: '#fafafa' }}>
                                        {horariosEnCelda.map(h => {
                                          const isSelected = formData.horarios.includes(h.id);
                                          const estaLleno = h.cupo_disponible <= 0;
                                          
                                          return (
                                            <div
                                              key={h.id}
                                              onClick={() => !estaLleno && toggleHorario(h.id)}
                                              style={{
                                                padding: '0.25rem',
                                                marginBottom: '0.25rem',
                                                borderRadius: '4px',
                                                cursor: estaLleno ? 'not-allowed' : 'pointer',
                                                background: isSelected ? '#dbeafe' : estaLleno ? '#fef2f2' : '#ecfdf5',
                                                border: isSelected ? '2px solid #40E0D0' : '1px solid #86efac',
                                              }}
                                            >
                                              <div style={{ fontWeight: '600', fontSize: '0.65rem', color: '#111827' }}>
                                                {h.hora_inicio?.substring(0, 5)}-{h.hora_fin?.substring(0, 5)}
                                              </div>
                                              <div style={{ fontSize: '0.55rem', color: '#6b7280' }}>{h.profesor_nombre}</div>
                                              <div style={{ fontSize: '0.55rem', fontWeight: '500', color: estaLleno ? '#dc2626' : '#059669' }}>
                                                {estaLleno ? 'LLENO' : `${h.cupo_disponible}/${h.cupo_maximo}`}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {formData.horarios.length > 0 && (
                      <div style={{
                        marginTop: '0.75rem', padding: '0.75rem',
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.375rem' }}>
                          {formData.horarios.length} horario{formData.horarios.length > 1 ? 's' : ''} seleccionado{formData.horarios.length > 1 ? 's' : ''}
                        </div>
                        {horarios.filter(h => formData.horarios.includes(h.id)).map((h) => {
                          const diaLabel = DIAS_GRID.find(d => d.value === h.dia_semana)?.label ?? '';
                          return (
                            <div key={h.id} style={{
                              fontSize: '0.75rem', color: '#166534', padding: '0.2rem 0',
                              display: 'flex', justifyContent: 'space-between',
                            }}>
                              <span style={{ fontWeight: '500' }}>{diaLabel}</span>
                              <span>{h.hora_inicio?.substring(0, 5)} – {h.hora_fin?.substring(0, 5)}</span>
                              <span style={{ color: '#6b7280' }}>{h.profesor_nombre}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECCIÓN 3: DETALLES DE PAGO */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Detalles de Pago</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  
                  {/* Columna Izquierda */}
                  <div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Cantidad de Sesiones (Paquete)</label>
                      <input
                        type="number"
                        value={formData.sesiones_contratadas}
                        onChange={(e) => setFormData({ ...formData, sesiones_contratadas: parseInt(e.target.value) || 1 })}
                        min={1}
                        style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Fecha de Matrícula</label>
                      <input
                        type="date"
                        value={formData.fecha_matricula}
                        onChange={(e) => setFormData({ ...formData, fecha_matricula: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '6px' }}>
                      {calcularFrecuencia > 0 ? (
                        <>Frecuencia sugerida: {calcularFrecuencia} vez{calcularFrecuencia > 1 ? 's' : ''} por semana. Duración aprox: {calcularDuracion} semana{calcularDuracion > 1 ? 's' : ''}.</>
                      ) : (
                        <>Selecciona horarios para calcular la frecuencia.</>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Monto Total a Pagar (S/.)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.precio_total}
                          onChange={(e) => setFormData({ ...formData, precio_total: e.target.value })}
                          required
                          min={0.01}
                          style={{ width: '100%', padding: '0.625rem', border: formData.precio_total && parseFloat(formData.precio_total) <= 0 ? '2px solid #dc2626' : '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                        />
                        {calculandoPrecio && (
                          <span style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#9ca3af' }}>
                            Calculando...
                          </span>
                        )}
                      </div>
                      {precioSugerido !== null && (
                        <div style={{
                          marginTop: '0.25rem', fontSize: '0.75rem', color: '#059669',
                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                        }}>
                          ✓ Precio según paquete configurado
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Columna Derecha */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>Método de Pago</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {['efectivo', 'transferencia', 'tarjeta'].map((metodo) => (
                        <button
                          key={metodo}
                          type="button"
                          onClick={() => setFormData({ ...formData, metodo_pago: metodo })}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            border: formData.metodo_pago === metodo ? '2px solid #40E0D0' : '1px solid #d1d5db',
                            background: formData.metodo_pago === metodo ? '#eff6ff' : 'white',
                            color: formData.metodo_pago === metodo ? '#1d4ed8' : '#374151',
                            fontWeight: formData.metodo_pago === metodo ? '600' : '400',
                            cursor: 'pointer',
                            textAlign: 'left',
                            textTransform: 'capitalize',
                            fontSize: '0.875rem',
                          }}
                        >
                          {metodo}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Opciones adicionales - solo en modo editar */}
              {editingId && (
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> 
                    Activa
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={formData.concluida} onChange={(e) => setFormData({ ...formData, concluida: e.target.checked })} /> 
                    Concluida
                  </label>
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving || !formData.alumno || !formData.taller || formData.horarios.length === 0} style={{ flex: 1, padding: '0.75rem', background: (saving || !formData.alumno || !formData.taller || formData.horarios.length === 0) ? '#93c5fc' : '#40E0D0', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: (saving || !formData.alumno || !formData.taller || formData.horarios.length === 0) ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Guardar Matrícula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMatricula && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '650px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>{viewMatricula.alumno_nombre}</h2>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{viewMatricula.taller_nombre} · {asistenciasDetalle.length} registro{asistenciasDetalle.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setViewMatricula(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>&times;</button>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', background: '#d1fae5', color: '#059669' }}>
                  {asistenciasDetalle.filter(a => a.estado === 'asistio').length} Asistió
                </span>
                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', background: '#fef3c7', color: '#d97706' }}>
                  {asistenciasDetalle.filter(a => a.estado === 'falta').length} Falta
                </span>
                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', background: '#fee2e2', color: '#dc2626' }}>
                  {asistenciasDetalle.filter(a => a.estado === 'falta_grave').length} Falta Grave
                </span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {loadingDetalle ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando asistencias...</div>
              ) : asistenciasDetalle.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay asistencias registradas</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Fecha</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Horario</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Profesor</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistenciasDetalle.map((a) => {
                      const estadoInfo = a.estado === 'asistio'
                        ? { label: 'Asistió', color: '#059669', bg: '#d1fae5' }
                        : a.estado === 'falta_grave'
                          ? { label: 'Falta Grave', color: '#dc2626', bg: '#fee2e2' }
                          : { label: 'Falta', color: '#d97706', bg: '#fef3c7' };
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.625rem 1rem', fontSize: '0.8rem', color: '#111827', fontWeight: '500' }}>{a.fecha}</td>
                          <td style={{ padding: '0.625rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{a.horario_hora_inicio?.substring(0,5)} a {a.horario_hora_fin?.substring(0,5)}</td>
                          <td style={{ padding: '0.625rem 1rem' }}>
                            <span style={{ padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', background: estadoInfo.bg, color: estadoInfo.color }}>
                              {estadoInfo.label}
                            </span>
                            {a.es_recuperacion && (
                              <span style={{ marginLeft: '0.375rem', fontSize: '0.65rem', color: '#8b5cf6', fontWeight: '500' }}>Recup.</span>
                            )}
                          </td>
                          <td style={{ padding: '0.625rem 1rem', fontSize: '0.8rem', color: '#374151' }}>{a.profesor_nombre}</td>
                          <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                            <button onClick={() => confirmarEliminarAsistencia(a)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500' }} title="Eliminar">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => setViewMatricula(null)} style={{ width: '100%', padding: '0.625rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deletingId !== null}
        title="Eliminar Matrícula"
        message="¿Estás seguro de que deseas eliminar esta matrícula?"
        itemName={deletingName}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={false}
      />

      <TraspasoModal
        isOpen={traspasandoId !== null}
        matriculaId={traspasandoId}
        alumnoOrigen={traspasandoNombre}
        tallerNombre={traspasandoTaller}
        cicloId={cicloActual?.id ?? null}
        onConfirm={handleTraspaso}
        onCancel={cancelTraspaso}
        isLoading={traspasandoLoading}
      />

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

      {verHorarioMatriculaId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>Horario del Alumno</h2>
              <button onClick={() => setVerHorarioMatriculaId(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {horariosDetalle.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay horarios registrados</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {horariosDetalle.map((h) => (
                    <div key={h.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>{h.horario_detalle.taller}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {h.horario_detalle.dia} · {h.horario_detalle.hora_inicio} a {h.horario_detalle.hora_fin}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Profesor: {h.horario_detalle.profesor}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => setVerHorarioMatriculaId(null)} style={{ width: '100%', padding: '0.625rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MatriculasPage);
