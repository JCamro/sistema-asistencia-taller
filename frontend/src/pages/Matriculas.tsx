import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import TraspasoModal from '../components/ui/TraspasoModal';

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
  modalidad: string;
  activo: boolean;
  concluida: boolean;
  sesiones_consumidas: number;
  sesiones_disponibles: number;
  fecha_matricula: string;
}

interface MatriculaFormData {
  alumno: number | '';
  taller: number | '';
  horarios: number[];
  sesiones_contratadas: number;
  precio_total: string;
  modalidad: string;
  metodo_pago: string;
  activo: boolean;
  concluida: boolean;
}

interface AsistenciaDetalle {
  id: number;
  profesor_nombre: string;
  fecha: string;
  hora: string;
  estado: string;
  observacion: string;
  es_recuperacion: boolean;
}

const initialFormData: MatriculaFormData = {
  alumno: '',
  taller: '',
  horarios: [],
  sesiones_contratadas: 8,
  precio_total: '',
  modalidad: 'presencial',
  metodo_pago: 'efectivo',
  activo: true,
  concluida: false,
};

function MatriculasPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [matriculasRes, alumnosRes, talleresRes] = await Promise.all([
        fetch(`/api/ciclos/${cicloActual.id}/matriculas/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/ciclos/${cicloActual.id}/alumnos/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/ciclos/${cicloActual.id}/talleres/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [matriculasData, alumnosData, talleresData] = await Promise.all([
        matriculasRes.json(),
        alumnosRes.json(),
        talleresRes.json(),
      ]);
      setMatriculas(matriculasData.results || matriculasData);
      setAlumnos((alumnosData.results || alumnosData).filter((a: Alumno) => a.activo));
      setTalleres((talleresData.results || talleresData).filter((t: Taller) => t.activo));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  const fetchHorarios = useCallback(async (tallerId: number) => {
    if (!cicloActual) return;
    setHorariosLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/ciclos/${cicloActual.id}/horarios/?taller=${tallerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const horariosData = (data.results || data).filter((h: Horario) => h.activo);
      setHorarios(horariosData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setHorariosLoading(false);
    }
  }, [cicloActual]);

  const fetchAsistenciasDetalle = useCallback(async (matricula: Matricula) => {
    setViewMatricula(matricula);
    setLoadingDetalle(true);
    setAsistenciasDetalle([]);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/asistencias/?matricula=${matricula.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const lista = (data.results || data) as AsistenciaDetalle[];
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

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (formData.taller) {
      fetchHorarios(Number(formData.taller));
    } else {
      setHorarios([]);
    }
  }, [formData.taller, fetchHorarios]);

  const filteredAlumnos = useMemo(() => {
    if (!alumnoSearch) return [];
    const searchLower = alumnoSearch.toLowerCase();
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchLower) || 
      a.apellido.toLowerCase().includes(searchLower) ||
      a.dni?.includes(alumnoSearch)
    ).slice(0, 10);
  }, [alumnoSearch, alumnos]);

  const filteredMatriculas = matriculas.filter((m) =>
    m.alumno_nombre.toLowerCase().includes(search.toLowerCase()) ||
    m.taller_nombre.toLowerCase().includes(search.toLowerCase())
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual || !formData.alumno || !formData.taller || formData.horarios.length === 0) {
      showToast('Por favor complete todos los campos requeridos', 'warning');
      return;
    }
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = editingId ? `/api/matriculas/${editingId}/` : `/api/ciclos/${cicloActual.id}/matriculas/`;
      const method = editingId ? 'PATCH' : 'POST';
      
      const payload = {
        alumno: formData.alumno,
        taller: formData.taller,
        sesiones_contratadas: formData.sesiones_contratadas,
        precio_total: parseFloat(formData.precio_total),
        modalidad: formData.modalidad,
        activo: formData.activo,
        concluida: formData.concluida,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }

      const matriculaData = await res.json();

      if (!editingId && formData.horarios.length > 0) {
        // Crear nuevos horarios para nueva matrícula
        for (const horarioId of formData.horarios) {
          await fetch('/api/matriculas-horarios/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              matricula: matriculaData.id,
              horario: horarioId,
            }),
          });
        }
      } else if (editingId) {
        // Obtener horarios actuales y actualizarlos
        const resHorarios = await fetch(`/api/matriculas-horarios/?matricula=${editingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dataHorarios = await resHorarios.json();
        const horariosActuales = (dataHorarios.results || dataHorarios).map((mh: any) => mh.horario);
        
        // Eliminar horarios que ya no están seleccionados
        for (const horarioId of horariosActuales) {
          if (!formData.horarios.includes(horarioId)) {
            const mhToDelete = (dataHorarios.results || dataHorarios).find((mh: any) => mh.horario === horarioId);
            if (mhToDelete) {
              await fetch(`/api/matriculas-horarios/${mhToDelete.id}/`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          }
        }
        
        // Agregar nuevos horarios
        for (const horarioId of formData.horarios) {
          if (!horariosActuales.includes(horarioId)) {
            await fetch('/api/matriculas-horarios/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                matricula: editingId,
                horario: horarioId,
              }),
            });
          }
        }
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchData();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (matricula: Matricula) => {
    const token = localStorage.getItem('access_token');
    
    // Primero cargamos los horarios existentes
    let horariosExistentes: number[] = [];
    try {
      const res = await fetch(`/api/matriculas-horarios/?matricula=${matricula.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      horariosExistentes = (data.results || data).map((mh: any) => mh.horario);
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
      modalidad: matricula.modalidad,
      metodo_pago: 'efectivo',
      activo: matricula.activo,
      concluida: matricula.concluida,
    });
    setShowModal(true);
  };

  const handleDelete = (id: number, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`/api/matriculas/${deletingId}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchData();
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

  const handleTraspaso = async (alumnoDestinoId: number) => {
    if (!traspasandoId) return;
    setTraspasandoLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/matriculas/${traspasandoId}/traspasar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alumno_destino_id: alumnoDestinoId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      const data = await res.json();
      showToast(data.detail || 'Traspaso realizado exitosamente', 'success');
      setTraspasandoId(null);
      setTraspasandoNombre('');
      setTraspasandoTaller('');
      fetchData();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setTraspasandoLoading(false);
    }
  };

  const openTraspaso = (m: Matricula) => {
    setTraspasandoId(m.id);
    setTraspasandoNombre(m.alumno_nombre);
    setTraspasandoTaller(m.taller_nombre);
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
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{matriculas.length} matrículas activas</p>
        </div>
        <button onClick={openCreateModal} disabled={alumnos.length === 0 || talleres.length === 0} style={{ background: alumnos.length === 0 || talleres.length === 0 ? '#e5e7eb' : '#40E0D0', color: '#000000', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.875rem', cursor: (alumnos.length === 0 || talleres.length === 0) ? 'not-allowed' : 'pointer' }}>
          <span>+</span> Nueva Matrícula
        </button>
      </div>

      {alumnos.length === 0 && <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', marginBottom: '1.5rem', color: '#b45309', fontSize: '0.875rem' }}>⚠️ Debes crear alumnos y talleres primero.</div>}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <input type="text" placeholder="Buscar por alumno o taller..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Alumno</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Taller</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Sesiones</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Total</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatriculas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay matrículas</td></tr>
            ) : (
              filteredMatriculas.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem' }}><div style={{ fontWeight: '600', color: '#111827' }}>{m.alumno_nombre}</div></td>
                  <td style={{ padding: '1rem', color: '#374151' }}>{m.taller_nombre}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'monospace', color: m.sesiones_disponibles > 0 ? '#059669' : '#dc2626' }}>{m.sesiones_consumidas}/{m.sesiones_contratadas}</span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>S/. {m.precio_total}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: m.concluida ? '#fef3c7' : m.activo ? '#d1fae5' : '#f3f4f6', color: m.concluida ? '#b45309' : m.activo ? '#059669' : '#6b7280' }}>
                      {m.concluida ? 'Concluida' : m.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => fetchAsistenciasDetalle(m)} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', marginRight: '1rem' }}>Asistencias</button>
                    <button onClick={() => handleEdit(m)} style={{ background: 'none', border: 'none', color: '#40E0D0', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', marginRight: '1rem' }}>Editar</button>
                    {m.activo && <button onClick={() => openTraspaso(m)} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', marginRight: '1rem' }}>Traspasar</button>}
                    <button onClick={() => handleDelete(m.id, m.alumno_nombre)} disabled={deletingId === m.id} style={{ background: 'none', border: 'none', color: deletingId === m.id ? '#9ca3af' : '#ef4444', cursor: deletingId === m.id ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>{deletingId === m.id ? '...' : 'Eliminar'}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        {horarios.map((horario) => {
                          const isSelected = formData.horarios.includes(horario.id);
                          const estaLleno = horario.cupo_disponible <= 0;
                          const progreso = horario.cupo_maximo > 0 ? ((horario.cupo_maximo - horario.cupo_disponible) / horario.cupo_maximo) * 100 : 0;

                          return (
                            <div
                              key={horario.id}
                              onClick={() => !estaLleno && toggleHorario(horario.id)}
                              style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                border: isSelected ? '2px solid #40E0D0' : `1px solid ${estaLleno ? '#fecaca' : '#d1d5db'}`,
                                background: isSelected ? '#eff6ff' : estaLleno ? '#fef2f2' : 'white',
                                cursor: estaLleno ? 'not-allowed' : 'pointer',
                                opacity: estaLleno ? 0.7 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: '600', color: '#111827', fontSize: '0.875rem' }}>{horario.dia_nombre}</span>
                                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{horario.hora_inicio?.substring(0, 5)}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>{horario.profesor_nombre}</div>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                  <span style={{ color: estaLleno ? '#dc2626' : '#059669', fontWeight: '500' }}>
                                    {estaLleno ? 'LLENO' : `${horario.cupo_disponible} cupos`}
                                  </span>
                                </div>
                                <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${progreso}%`, background: estaLleno ? '#dc2626' : '#22c55e', transition: 'width 0.3s' }} />
                                </div>
                              </div>
                              {isSelected && (
                                <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#40E0D0', fontWeight: '500' }}>✓ Seleccionado</div>
                              )}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  
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
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '6px' }}>
                      {calcularFrecuencia > 0 ? (
                        <>Frecuencia sugerida: {calcularFrecuencia} vez{calcularFrecuencia > 1 ? 's' : ''} por semana. Duración aprox: {calcularDuracion} semana{calcularDuracion > 1 ? 's' : ''}.</>
                      ) : (
                        <>Selecciona horarios para calcular la frecuencia.</>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Monto Total a Pagar (S/.)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.precio_total}
                        onChange={(e) => setFormData({ ...formData, precio_total: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                      />
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

              {/* Opciones adicionales */}
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
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Hora</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Profesor</th>
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
                          <td style={{ padding: '0.625rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{a.hora?.substring(0, 5)}</td>
                          <td style={{ padding: '0.625rem 1rem' }}>
                            <span style={{ padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', background: estadoInfo.bg, color: estadoInfo.color }}>
                              {estadoInfo.label}
                            </span>
                            {a.es_recuperacion && (
                              <span style={{ marginLeft: '0.375rem', fontSize: '0.65rem', color: '#8b5cf6', fontWeight: '500' }}>Recup.</span>
                            )}
                          </td>
                          <td style={{ padding: '0.625rem 1rem', fontSize: '0.8rem', color: '#374151' }}>{a.profesor_nombre}</td>
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
    </div>
  );
}

export default memo(MatriculasPage);
