import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import api from '../../api/axios';
import { useToast } from '../../contexts/ToastContext';
import type { Matricula, Alumno, Taller, Horario } from '../../api/endpoints';
import { utcToLimaDate } from '../../utils/timezone';

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

interface MatriculaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  matricula?: Matricula | null;
  cicloId?: number | null;
}

/**
 * MatriculaFormModal — Formulario de creación/edición de matrícula
 *
 * Secciones del formulario:
 * 1. Datos del alumno (búsqueda con autocomplete; bloqueado en edición)
 * 2. Taller y horarios (grilla semanal día×hora con toggle de selección)
 * 3. Detalles de pago (sesiones, fecha, frecuencia sugerida, monto total)
 *
 * El precio se calcula automáticamente vía API al seleccionar taller y sesiones.
 * En edición permite marcar activa/concluida y gestiona la sincronización de
 * horarios (crear/eliminar registros de MatriculaHorario).
 */
function MatriculaFormModal({ isOpen, onClose, onSuccess, matricula, cicloId }: MatriculaFormModalProps) {
  const editingId = matricula?.id ?? null;
  const { showToast, showApiError } = useToast();
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [formData, setFormData] = useState<MatriculaFormData>(initialFormData);
  const [alumnoSearch, setAlumnoSearch] = useState('');
  const [showAlumnoDropdown, setShowAlumnoDropdown] = useState(false);
  const [horariosLoading, setHorariosLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [precioSugerido, setPrecioSugerido] = useState<number | null>(null);
  const [calculandoPrecio, setCalculandoPrecio] = useState(false);

  const fetchLookups = useCallback(async () => {
    if (!cicloId) return;
    try {
      const [alumnosResponse, talleresResponse] = await Promise.all([
        api.get(`/ciclos/${cicloId}/alumnos/?page_size=200`),
        api.get(`/ciclos/${cicloId}/talleres/?page_size=200`),
      ]);
      const alumnosJsonData = alumnosResponse.data.results || alumnosResponse.data;
      const talleresJsonData = talleresResponse.data.results || talleresResponse.data;
      setAlumnos(Array.isArray(alumnosJsonData) ? alumnosJsonData.filter((a: Alumno) => a.activo) : []);
      setTalleres(Array.isArray(talleresJsonData) ? talleresJsonData.filter((t: Taller) => t.activo) : []);
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  }, [cicloId]);

  const fetchHorarios = useCallback(async (tallerId: number) => {
    if (!cicloId) return;
    setHorariosLoading(true);
    try {
      const response = await api.get(`/ciclos/${cicloId}/horarios/?taller=${tallerId}&page_size=200`);
      const jsonData = response.data.results || response.data;
      setHorarios(Array.isArray(jsonData) ? jsonData.filter((h: Horario) => h.activo) : []);
    } catch (err: any) {
      console.error('Error fetching horarios:', err);
    } finally {
      setHorariosLoading(false);
    }
  }, [cicloId]);

  useEffect(() => {
    if (!isOpen || !cicloId) return;
    fetchLookups();
    if (matricula) {
      const loadHorarios = async () => {
        let horariosExistentes: number[] = [];
        try {
          const response = await api.get(`/matriculas-horarios/?matricula=${matricula.id}`);
          const jsonData = response.data.results || response.data;
          horariosExistentes = Array.isArray(jsonData) ? jsonData.map((mh: any) => mh.horario) : [];
        } catch (err) {
          console.error('Error loading horarios:', err);
        }
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
        setAlumnoSearch(matricula.alumno_nombre);
        if (matricula.taller) fetchHorarios(matricula.taller);
      };
      loadHorarios();
    } else {
      setFormData(initialFormData);
      setAlumnoSearch('');
      setShowAlumnoDropdown(false);
      setHorarios([]);
      setPrecioSugerido(null);
    }
  }, [isOpen, cicloId, matricula, fetchHorarios, fetchLookups]);

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
        const response = await api.get(`/matriculas/calcular-precio/?taller_id=${formData.taller}&sesiones=${formData.sesiones_contratadas}`);
        const jsonData = response.data;
        if (!cancelled) {
          setPrecioSugerido(jsonData.precio_total > 0 ? jsonData.precio_total : null);
          if (jsonData.precio_total > 0) {
            setFormData((prev) => ({ ...prev, precio_total: jsonData.precio_total.toString() }));
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
    return alumnos
      .filter((a) =>
        a.nombre.toLowerCase().includes(searchLower) ||
        a.apellido.toLowerCase().includes(searchLower) ||
        a.dni?.includes(alumnoSearch)
      )
      .slice(0, 10);
  }, [alumnoSearch, alumnos]);

  // Construir grilla día×hora: agrupa horarios por "dia_semana-hora" para la tabla visual
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

  const calcularFrecuencia = useMemo(() => {
    const diasUnicos = new Set(horarios.filter((h) => formData.horarios.includes(h.id)).map((h) => h.dia_semana));
    return diasUnicos.size;
  }, [formData.horarios, horarios]);

  const calcularDuracion = useMemo(() => {
    if (calcularFrecuencia === 0 || formData.sesiones_contratadas === 0) return 0;
    return Math.ceil(formData.sesiones_contratadas / calcularFrecuencia);
  }, [formData.sesiones_contratadas, calcularFrecuencia]);

  const toggleHorario = (horarioId: number) => {
    setFormData((prev) => {
      const current = prev.horarios || [];
      if (current.includes(horarioId)) {
        return { ...prev, horarios: current.filter((id) => id !== horarioId) };
      }
      return { ...prev, horarios: [...current, horarioId] };
    });
  };

  const selectAlumno = (alumno: Alumno) => {
    setFormData((prev) => ({ ...prev, alumno: alumno.id }));
    setAlumnoSearch(`${alumno.apellido}, ${alumno.nombre}`);
    setShowAlumnoDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloId) return;
    if (!formData.alumno || !formData.taller || formData.horarios.length === 0) {
      showToast('Por favor complete todos los campos requeridos', 'warning');
      return;
    }
    if (!formData.precio_total || parseFloat(formData.precio_total) <= 0) {
      showToast('El monto total debe ser mayor a 0', 'warning');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/matriculas/${editingId}/` : `/ciclos/${cicloId}/matriculas/`;
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
      const response = editingId ? await api.patch(url, payload) : await api.post(url, payload);
      const matriculaData = response.data;
      if (!editingId && formData.horarios.length > 0) {
        for (const horarioId of formData.horarios) {
          try {
            await api.post('/matriculas-horarios/', { matricula: matriculaData.id, horario: horarioId });
          } catch (err: any) {
            if (!err.response || (err.response.status !== 400 && err.response.status !== 200)) throw err;
          }
        }
      } else if (editingId) {
        const matriculasHorariosResponse = await api.get(`/matriculas-horarios/?matricula=${editingId}`);
        const matriculasHorariosJsonData = matriculasHorariosResponse.data.results || matriculasHorariosResponse.data;
        const horariosActuales: number[] = Array.isArray(matriculasHorariosJsonData) ? matriculasHorariosJsonData.map((mh: any) => mh.horario) : [];
        for (const horarioId of horariosActuales) {
          if (!formData.horarios.includes(horarioId)) {
            const mhToDelete = Array.isArray(matriculasHorariosJsonData) ? matriculasHorariosJsonData.find((mh: any) => mh.horario === horarioId) : null;
            if (mhToDelete) await api.delete(`/matriculas-horarios/${mhToDelete.id}/`);
          }
        }
        for (const horarioId of formData.horarios) {
          if (!horariosActuales.includes(horarioId)) {
            try {
              await api.post('/matriculas-horarios/', { matricula: editingId, horario: horarioId });
            } catch (err: any) {
              if (!err.response || (err.response.status !== 400 && err.response.status !== 200)) throw err;
            }
          }
        }
      }
      onSuccess();
      onClose();
      showToast(editingId ? 'Matrícula actualizada' : 'Matrícula creada', 'success');
    } catch (err: any) {
      console.error('Error saving matricula:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{editingId ? 'Editar Matrícula' : 'Nueva Matrícula'}</h2>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 4, height: 16, borderRadius: 2, background: '#d4af37' }} />
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Datos del Alumno</h3>
            </div>
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
                  onChange={(e) => { setAlumnoSearch(e.target.value); setShowAlumnoDropdown(true); setFormData((prev) => ({ ...prev, alumno: '' })); }}
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
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
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

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 4, height: 16, borderRadius: 2, background: '#7c3aed' }} />
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Taller y Horarios</h3>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <select
                value={formData.taller}
                onChange={(e) => setFormData((prev) => ({ ...prev, taller: e.target.value ? parseInt(e.target.value) : '', horarios: [] }))}
                required
                style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}
              >
                <option value="">Seleccionar taller</option>
                {talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>

            {formData.taller && (
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>Seleccionar Horarios Semanales (1h)</div>
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
                          {DIAS_GRID.map((d) => (
                            <th key={d.value} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280' }}>{d.abbr}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {HORAS_GRID.map((hora) => {
                          const horaStr = hora.toString().padStart(2, '0');
                          return (
                            <tr key={hora}>
                              <td style={{ padding: '0.25rem', textAlign: 'center', fontSize: '0.7rem', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>{horaStr}:00</td>
                              {DIAS_GRID.map((dia) => {
                                const key = `${dia.value}-${horaStr}`;
                                const horariosEnCelda = horariosGrid[key] || [];
                                return (
                                  <td key={key} style={{ padding: '0.25rem', border: '1px solid #e5e7eb', minHeight: '50px', verticalAlign: 'top', background: '#fafafa' }}>
                                    {horariosEnCelda.map((h) => {
                                      const isSelected = formData.horarios.includes(h.id);
                                      const estaLleno = (h.cupo_disponible ?? 0) <= 0 && !isSelected;
                                      return (
                                        <div
                                          key={h.id}
                                          onClick={() => toggleHorario(h.id)}
                                          style={{
                                            padding: '0.25rem',
                                            marginBottom: '0.25rem',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            background: isSelected ? '#dbeafe' : estaLleno ? '#fef2f2' : '#ecfdf5',
                                            border: isSelected ? '2px solid #40E0D0' : '1px solid #86efac',
                                            opacity: estaLleno ? 0.5 : 1,
                                          }}
                                        >
                                          <div style={{ fontWeight: '600', fontSize: '0.65rem', color: '#111827' }}>{h.hora_inicio?.substring(0, 5)}-{h.hora_fin?.substring(0, 5)}</div>
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
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.375rem' }}>
                      {formData.horarios.length} horario{formData.horarios.length > 1 ? 's' : ''} seleccionado{formData.horarios.length > 1 ? 's' : ''}
                    </div>
                    {horarios.filter((h) => formData.horarios.includes(h.id)).map((h) => {
                      const diaLabel = DIAS_GRID.find((d) => d.value === h.dia_semana)?.label ?? '';
                      return (
                        <div key={h.id} style={{ fontSize: '0.75rem', color: '#166534', padding: '0.2rem 0', display: 'flex', justifyContent: 'space-between' }}>
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

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 4, height: 16, borderRadius: 2, background: '#059669' }} />
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Detalles de Pago</h3>
            </div>
            <div>
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Cantidad de Sesiones (Paquete)</label>
                  <input
                    type="number"
                    value={formData.sesiones_contratadas}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sesiones_contratadas: parseInt(e.target.value) || 1 }))}
                    min={1}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Fecha de Matrícula</label>
                  <input
                    type="date"
                    value={formData.fecha_matricula}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fecha_matricula: e.target.value }))}
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
                      onChange={(e) => setFormData((prev) => ({ ...prev, precio_total: e.target.value }))}
                      required
                      min={0.01}
                      style={{ width: '100%', padding: '0.625rem', border: formData.precio_total && parseFloat(formData.precio_total) <= 0 ? '2px solid #dc2626' : '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                    {calculandoPrecio && (
                      <span style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#9ca3af' }}>Calculando...</span>
                    )}
                  </div>
                  {precioSugerido !== null && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      ✓ Precio según paquete configurado
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {editingId && (
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={formData.activo} onChange={(e) => setFormData((prev) => ({ ...prev, activo: e.target.checked }))} /> Activa
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={formData.concluida} onChange={(e) => setFormData((prev) => ({ ...prev, concluida: e.target.checked }))} /> Concluida
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
            <button
              type="submit"
              disabled={saving || !formData.alumno || !formData.taller || formData.horarios.length === 0}
              style={{
                flex: 1,
                padding: '0.625rem',
                border: 'none',
                borderRadius: '10px',
                background: (saving || !formData.alumno || !formData.taller || formData.horarios.length === 0) ? '#e5e7eb' : '#d4af37',
                color: (saving || !formData.alumno || !formData.taller || formData.horarios.length === 0) ? '#9ca3af' : '#0a0a0a',
                fontWeight: 600,
                cursor: (saving || !formData.alumno || !formData.taller || formData.horarios.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Matrícula'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(MatriculaFormModal);
