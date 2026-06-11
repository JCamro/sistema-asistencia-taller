import { useState, useEffect, useMemo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import {
  getHorasTrabajadas, getHoraTrabajada, createHoraTrabajada,
  updateHoraTrabajada, deleteHoraTrabajada,
  aprobarHoraTrabajada, rechazarHoraTrabajada,
  generarHorasTrabajadas, getProfesores, getHorarios,
  HoraTrabajada, HoraTrabajadaDetail,
} from '../api/endpoints';
import { formatMonto } from '../utils/formatters';
import { useWindowWidth } from '../hooks/useWindowWidth';

const HorasTrabajadasPage = () => {
  const { cicloActual } = useCiclo();
  const toast = useToast();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [horas, setHoras] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [generarModalOpen, setGenerarModalOpen] = useState(false);
  const [horaEditando, setHoraEditando] = useState<any>(null);

  // Form state
  const [formProfesor, setFormProfesor] = useState<number | null>(null);
  const [formHorario, setFormHorario] = useState<number | null>(null);
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formTipo, setFormTipo] = useState('asistencia');
  const [formNumAlumnos, setFormNumAlumnos] = useState('');
  const [formHorasTrabajadas, setFormHorasTrabajadas] = useState('1.00');
  const [formObservacion, setFormObservacion] = useState('');
  const [formMontoProfesor, setFormMontoProfesor] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Generator form
  const [genFechaInicio, setGenFechaInicio] = useState('');
  const [genFechaFin, setGenFechaFin] = useState('');
  const [generando, setGenerando] = useState(false);

  const loadData = async () => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const [horasRes, profesoresRes, horariosRes] = await Promise.all([
        getHorasTrabajadas(cicloActual.id, `page=${page}`),
        getProfesores(cicloActual.id),
        getHorarios(cicloActual.id),
      ]);
      setHoras(horasRes.data.results);
      setTotalCount(horasRes.data.count);
      const profesData = profesoresRes.data as any;
      setProfesores(profesData.results || profesData || []);
      const horariosData = horariosRes.data as any;
      setHorarios(horariosData.results || horariosData || []);
    } catch (error) {
      console.error('Error:', error);
      toast.showToast('Error al cargar horas trabajadas', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (cicloActual) {
      loadData();
    }
  }, [cicloActual, page]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [filtroTipo, filtroEstado, filtroFechaInicio, filtroFechaFin]);

  // Build query params for filters
  const getFilterParams = () => {
    const params: string[] = [`page=${page}`];
    if (filtroTipo) params.push(`tipo=${encodeURIComponent(filtroTipo)}`);
    if (filtroEstado) params.push(`estado=${encodeURIComponent(filtroEstado)}`);
    if (filtroFechaInicio) params.push(`fecha__gte=${encodeURIComponent(filtroFechaInicio)}`);
    if (filtroFechaFin) params.push(`fecha__lte=${encodeURIComponent(filtroFechaFin)}`);
    return params.join('&');
  };

  // Fetch with filters
  const loadFilteredData = async () => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const params = getFilterParams();
      const [horasRes, profesoresRes, horariosRes] = await Promise.all([
        getHorasTrabajadas(cicloActual.id, params),
        getProfesores(cicloActual.id),
        getHorarios(cicloActual.id),
      ]);
      setHoras(horasRes.data.results);
      setTotalCount(horasRes.data.count);
      const profesData = profesoresRes.data as any;
      setProfesores(profesData.results || profesData || []);
      const horariosData = horariosRes.data as any;
      setHorarios(horariosData.results || horariosData || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (cicloActual) {
      loadFilteredData();
    }
  }, [cicloActual, page, filtroTipo, filtroEstado, filtroFechaInicio, filtroFechaFin]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) return;
    setGuardando(true);
    try {
      const data: any = {
        profesor: formProfesor,
        ciclo: cicloActual.id,
        fecha: formFecha,
        tipo: formTipo,
        horas_trabajadas: formHorasTrabajadas,
        num_alumnos: formNumAlumnos ? parseInt(formNumAlumnos) : 0,
        observacion: formObservacion,
      };
      if (formTipo !== 'hora_extra' && formHorario) {
        data.horario = formHorario;
      }
      if (formMontoProfesor) {
        data.monto_profesor = parseFloat(formMontoProfesor);
      }
      await createHoraTrabajada(data);
      toast.showToast('Registro creado exitosamente', 'success');
      setModalOpen(false);
      resetForm();
      loadFilteredData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.showToast(error.response?.data?.detail || 'Error al crear registro', 'error');
    }
    setGuardando(false);
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horaEditando) return;
    setGuardando(true);
    try {
      const data: any = {
        observacion: formObservacion,
      };
      if (formNumAlumnos) data.num_alumnos = parseInt(formNumAlumnos);
      if (formMontoProfesor) data.monto_profesor = parseFloat(formMontoProfesor);
      await updateHoraTrabajada(horaEditando.id, data);
      toast.showToast('Registro actualizado exitosamente', 'success');
      setModalOpen(false);
      setHoraEditando(null);
      resetForm();
      loadFilteredData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.showToast(error.response?.data?.detail || 'Error al actualizar registro', 'error');
    }
    setGuardando(false);
  };

  const handleAprobar = async (id: number) => {
    try {
      await aprobarHoraTrabajada(id);
      toast.showToast('Registro aprobado', 'success');
      loadFilteredData();
    } catch (error) {
      toast.showToast('Error al aprobar registro', 'error');
    }
  };

  const handleRechazar = async (id: number) => {
    try {
      await rechazarHoraTrabajada(id);
      toast.showToast('Registro rechazado', 'success');
      loadFilteredData();
    } catch (error) {
      toast.showToast('Error al rechazar registro', 'error');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      await deleteHoraTrabajada(id);
      toast.showToast('Registro eliminado', 'success');
      loadFilteredData();
    } catch (error) {
      toast.showToast('Error al eliminar registro', 'error');
    }
  };

  const handleGenerar = async () => {
    if (!cicloActual || !genFechaInicio || !genFechaFin) return;
    setGenerando(true);
    try {
      const res = await generarHorasTrabajadas(cicloActual.id, genFechaInicio, genFechaFin);
      toast.showToast(`Generadas: ${res.data.creados} creadas, ${res.data.actualizados} actualizadas`, 'success');
      setGenerarModalOpen(false);
      setGenFechaInicio('');
      setGenFechaFin('');
      loadFilteredData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.showToast(error.response?.data?.detail || 'Error al generar horas', 'error');
    }
    setGenerando(false);
  };

  const abrirEditar = async (hora: any) => {
    try {
      const res = await getHoraTrabajada(hora.id);
      setHoraEditando(res.data);
      setFormObservacion(res.data.observacion || '');
      setFormNumAlumnos(String(res.data.num_alumnos));
      setFormMontoProfesor(String(res.data.monto_profesor || ''));
      setModalOpen(true);
    } catch (error) {
      toast.showToast('Error al cargar detalle', 'error');
    }
  };

  const resetForm = () => {
    setFormProfesor(null);
    setFormHorario(null);
    setFormFecha(new Date().toISOString().split('T')[0]);
    setFormTipo('asistencia');
    setFormNumAlumnos('');
    setFormHorasTrabajadas('1.00');
    setFormObservacion('');
    setFormMontoProfesor('');
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      clase_regular: 'Clase Regular',
      asistencia: 'Asistencia',
      hora_extra: 'Hora Extra',
      clase_cancelada: 'Clase Cancelada',
    };
    return labels[tipo] || tipo;
  };

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
    };
    return labels[estado] || estado;
  };

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      pendiente: '#f59e0b',
      aprobada: '#10b981',
      rechazada: '#ef4444',
    };
    return colors[estado] || '#6b7280';
  };

  const getCreatedFromLabel = (from: string) => {
    return from === 'asistencia_auto' ? 'Auto' : 'Manual';
  };

  const totalPages = Math.ceil(totalCount / 20);

  if (!cicloActual) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Horas Trabajadas</h1>
          <p style={{ color: '#6b7280' }}>Gestiona las horas trabajadas del ciclo {cicloActual.nombre}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { resetForm(); setHoraEditando(null); setModalOpen(true); }}
            style={{ padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)' }}
          >
            + Nuevo Registro
          </button>
          <button
            onClick={() => setGenerarModalOpen(true)}
            style={{ padding: '0.625rem 1.25rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Generar desde Asistencias
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', minWidth: '150px' }}
        >
          <option value="">Todos los tipos</option>
          <option value="clase_regular">Clase Regular</option>
          <option value="asistencia">Asistencia</option>
          <option value="hora_extra">Hora Extra</option>
          <option value="clase_cancelada">Clase Cancelada</option>
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', minWidth: '150px' }}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
        </select>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="date"
            value={filtroFechaInicio}
            onChange={e => setFiltroFechaInicio(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
            placeholder="Fecha desde"
          />
          <span style={{ color: '#9ca3af' }}>—</span>
          <input
            type="date"
            value={filtroFechaFin}
            onChange={e => setFiltroFechaFin(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
            placeholder="Fecha hasta"
          />
        </div>
      </div>

      {/* Totales */}
      {!loading && horas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
            <p style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Registros</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#92400e' }}>{totalCount}</p>
          </div>
          <div style={{ background: '#e0e7ff', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
            <p style={{ fontSize: '0.75rem', color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendientes</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3730a3' }}>{horas.filter((h: any) => h.estado === 'pendiente').length}</p>
          </div>
          <div style={{ background: '#d1fae5', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <p style={{ fontSize: '0.75rem', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aprobadas</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#065f46' }}>{horas.filter((h: any) => h.estado === 'aprobada').length}</p>
          </div>
          <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(196, 30, 58, 0.2)' }}>
            <p style={{ fontSize: '0.75rem', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rechazadas</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>{horas.filter((h: any) => h.estado === 'rechazada').length}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <ResponsiveTable<any>
          columns={[
            { key: 'fecha', label: 'Fecha', render: (h) => new Date(h.fecha).toLocaleDateString('es-PE') },
            { key: 'profesor_nombre', label: 'Profesor' },
            { key: 'tipo', label: 'Tipo', render: (h) => getTipoLabel(h.tipo) },
            { key: 'estado', label: 'Estado', render: (h) => (
              <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: `${getEstadoColor(h.estado)}20`, color: getEstadoColor(h.estado) }}>
                {getEstadoLabel(h.estado)}
              </span>
            )},
            { key: 'num_alumnos', label: 'Alumnos', align: 'center', render: (h) => h.num_alumnos || '-' },
            { key: 'monto_profesor', label: 'Pago', align: 'right', render: (h) => <span style={{ fontWeight: 600 }}>{formatMonto(h.monto_profesor)}</span> },
            { key: 'created_from', label: 'Origen', align: 'center', render: (h) => (
              <span style={{ padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500, background: h.created_from === 'asistencia_auto' ? '#dbeafe' : '#fef3c7', color: h.created_from === 'asistencia_auto' ? '#1e40af' : '#92400e' }}>
                {getCreatedFromLabel(h.created_from)}
              </span>
            )},
          ]}
          data={loading ? [] : horas}
          keyField="id"
          actions={(h) => (
            <>
              {h.estado === 'pendiente' && (
                <>
                  <button
                    onClick={() => handleAprobar(h.id)}
                    className="touch-target"
                    style={{ padding: '0.25rem 0.5rem', border: '1px solid #10b981', borderRadius: '6px', background: 'white', color: '#10b981', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleRechazar(h.id)}
                    className="touch-target"
                    style={{ padding: '0.25rem 0.5rem', border: '1px solid #ef4444', borderRadius: '6px', background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Rechazar
                  </button>
                </>
              )}
              {h.estado === 'pendiente' && (
                <button
                  onClick={() => abrirEditar(h)}
                  className="touch-target"
                  style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Editar
                </button>
              )}
              <button
                onClick={() => handleEliminar(h.id)}
                className="touch-target"
                style={{ padding: '0.25rem 0.5rem', border: '1px solid #ef4444', borderRadius: '6px', background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Eliminar
              </button>
            </>
          )}
          emptyMessage={loading ? 'Cargando...' : 'No hay registros de horas trabajadas'}
        />
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: page <= 1 ? '#f3f4f6' : 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? '#9ca3af' : '#374151' }}
          >
            Anterior
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: page >= totalPages ? '#f3f4f6' : 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: page >= totalPages ? '#9ca3af' : '#374151' }}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal de crear/editar */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>{horaEditando ? 'Editar Registro' : 'Nuevo Registro'}</h2>
            <form onSubmit={horaEditando ? handleEditar : handleCrear}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {!horaEditando && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Tipo</label>
                      <select value={formTipo} onChange={e => setFormTipo(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                        <option value="clase_regular">Clase Regular</option>
                        <option value="asistencia">Asistencia</option>
                        <option value="hora_extra">Hora Extra</option>
                        <option value="clase_cancelada">Clase Cancelada</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Profesor</label>
                      <select value={formProfesor || ''} onChange={e => setFormProfesor(e.target.value ? Number(e.target.value) : null)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                        <option value="">Seleccionar profesor</option>
                        {profesores.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {formTipo !== 'hora_extra' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Horario</label>
                        <select value={formHorario || ''} onChange={e => setFormHorario(e.target.value ? Number(e.target.value) : null)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                          <option value="">Seleccionar horario</option>
                          {horarios
                            .filter((hor: any) => !formProfesor || hor.profesor === formProfesor)
                            .map((hor: any) => (
                              <option key={hor.id} value={hor.id}>
                                {hor.taller_nombre} - {hor.dia_nombre} {hor.hora_inicio?.slice(0, 5)}-{hor.hora_fin?.slice(0, 5)}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Fecha</label>
                      <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Horas Trabajadas</label>
                      <input type="number" step="0.01" value={formHorasTrabajadas} onChange={e => setFormHorasTrabajadas(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>N° Alumnos</label>
                      <input type="number" value={formNumAlumnos} onChange={e => setFormNumAlumnos(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Pago Profesor (opcional)</label>
                      <input type="number" step="0.01" value={formMontoProfesor} onChange={e => setFormMontoProfesor(e.target.value)} placeholder="Auto-cálculo si se omite" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    </div>
                  </>
                )}
                {horaEditando && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>N° Alumnos</label>
                      <input type="number" value={formNumAlumnos} onChange={e => setFormNumAlumnos(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Monto Profesor</label>
                      <input type="number" step="0.01" value={formMontoProfesor} onChange={e => setFormMontoProfesor(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    </div>
                  </>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Observación</label>
                  <textarea value={formObservacion} onChange={e => setFormObservacion(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" disabled={guardando} style={{ flex: 1, padding: '0.625rem', background: '#d4af37', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setModalOpen(false); setHoraEditando(null); }} style={{ flex: 1, padding: '0.625rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de generar desde asistencias */}
      {generarModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Generar desde Asistencias</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Genera o actualiza registros de horas trabajadas a partir de las asistencias registradas en el período seleccionado.
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Fecha Inicio</label>
                <input type="date" value={genFechaInicio} onChange={e => setGenFechaInicio(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Fecha Fin</label>
                <input type="date" value={genFechaFin} onChange={e => setGenFechaFin(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={handleGenerar} disabled={generando || !genFechaInicio || !genFechaFin} style={{ flex: 1, padding: '0.625rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '8px', cursor: generando ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {generando ? 'Generando...' : 'Generar'}
              </button>
              <button type="button" onClick={() => setGenerarModalOpen(false)} style={{ flex: 1, padding: '0.625rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorasTrabajadasPage;
