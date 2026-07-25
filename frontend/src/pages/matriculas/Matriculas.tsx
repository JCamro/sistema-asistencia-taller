import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import TraspasoModal from '../../components/ui/TraspasoModal';
import MatriculasFilterBar from './MatriculasFilterBar';
import MatriculaFormModal from './MatriculaFormModal';
import MatriculaDetailModal from './MatriculaDetailModal';
import api from '../../api/axios';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { formatLimaDate } from '../../utils/timezone';
import { getMatriculas } from '../../api/endpoints';
import type { Matricula, Alumno, Taller } from '../../api/endpoints';

/**
 * MatriculasPage — Pantalla de gestión de matrículas
 *
 * Permite crear, editar, eliminar, ver detalle y traspasar matrículas.
 * Incluye filtros server-side (búsqueda, estado, taller, día, hora, orden)
 * y paginación. Se apoya en MatriculasFilterBar, MatriculaFormModal,
 * MatriculaDetailModal y TraspasoModal.
 *
 * Flujo: FilterBar → Tabla (ResponsiveTable) → Modales (crear/editar, detalle, traspaso)
 */
function MatriculasPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  const { searchText, setSearchText, debouncedValue: debouncedSearch } = useDebouncedSearch();
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [filtroTaller, setFiltroTaller] = useState<number | ''>('');
  const [filtroDia, setFiltroDia] = useState<number | ''>('');
  const [filtroHora, setFiltroHora] = useState<number | ''>('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'alpha'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [detailMatriculaId, setDetailMatriculaId] = useState<number | null>(null);
  const [detailModo, setDetailModo] = useState<'asistencias' | 'horarios'>('asistencias');
  const [traspasandoId, setTraspasandoId] = useState<number | null>(null);
  const [traspasandoNombre, setTraspasandoNombre] = useState<string>('');
  const [traspasandoTaller, setTraspasandoTaller] = useState<string>('');
  const [traspasandoLoading, setTraspasandoLoading] = useState(false);

  // Mapear opción de orden a parámetro de API (Django ordering)
  const getOrderingParam = (order: string) => {
    switch (order) {
      case 'oldest': return 'fecha_matricula';
      case 'alpha': return 'alumno__apellido';
      default: return '-fecha_matricula';
    }
  };

  const fetchMatriculas = useCallback(async (page: number = 1, search?: string, estado?: string, ordering?: string, taller?: number | string, dia?: number | string, hora?: number | string) => {
    if (!cicloActual) return;
    try {
      const response = await getMatriculas(cicloActual.id, page, search, estado, ordering, taller, dia, hora);
      const matriculasJsonData = response.data.results || response.data;
      setMatriculas(Array.isArray(matriculasJsonData) ? matriculasJsonData : []);
      setTotalPages(Math.ceil((response.data.count || 0) / 20) || 1);
      setTotalCount(response.data.count || 0);
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
      const [alumnosResponse, talleresResponse] = await Promise.all([
        api.get(`/ciclos/${cicloActual.id}/alumnos/?page_size=200`),
        api.get(`/ciclos/${cicloActual.id}/talleres/?page_size=200`),
      ]);
      const alumnosJsonData = alumnosResponse.data.results || alumnosResponse.data;
      const talleresJsonData = talleresResponse.data.results || talleresResponse.data;
      setAlumnos(Array.isArray(alumnosJsonData) ? alumnosJsonData.filter((a: Alumno) => a.activo) : []);
      setTalleres(Array.isArray(talleresJsonData) ? talleresJsonData.filter((t: Taller) => t.activo) : []);
    } catch (err: any) {
      console.error('Error fetching lookups:', err);
      if (err.response?.status === 401) {
        showToast('Sesión expirada. Iniciá sesión de nuevo.', 'error');
      }
    }
  }, [cicloActual, showToast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMatriculas(1, '', 'todas', getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora),
      fetchLookups(),
    ]).finally(() => setLoading(false));
  }, [cicloActual, fetchMatriculas, fetchLookups, sortOrder]);

  useEffect(() => {
    fetchMatriculas(1, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
  }, [filtroEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMatriculas(1, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
  }, [filtroTaller, filtroDia, filtroHora]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMatriculas(1, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
  }, [fetchMatriculas, debouncedSearch, sortOrder, filtroTaller, filtroDia, filtroHora]);

  const handlePageChange = (page: number) => {
    fetchMatriculas(page, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
  };

  const handleDelete = (id: number, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeletingName('');
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/matriculas/${deletingId}/`);
      showToast('Matrícula eliminada', 'success');
      const newPage = matriculas.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      fetchMatriculas(newPage, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setDeletingId(null);
      setDeletingName('');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setShowModal(true);
  };

  const handleEdit = (m: Matricula) => {
    setEditingId(m.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSuccess = () => {
    fetchMatriculas(editingId ? currentPage : 1, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
  };

  const openDetail = (id: number, modo: 'asistencias' | 'horarios') => {
    setDetailMatriculaId(id);
    setDetailModo(modo);
  };

  const closeDetail = () => {
    setDetailMatriculaId(null);
  };

  const handleTraspaso = async (alumnoDestinoId: number) => {
    if (!traspasandoId) return;
    setTraspasandoLoading(true);
    try {
      const response = await api.post(`/matriculas/${traspasandoId}/traspasar/`, {
        alumno_destino_id: alumnoDestinoId,
      });
      showToast(response.data.detail || 'Traspaso realizado exitosamente', 'success');
      setTraspasandoId(null);
      setTraspasandoNombre('');
      setTraspasandoTaller('');
      fetchMatriculas(currentPage, debouncedSearch, filtroEstado, getOrderingParam(sortOrder), filtroTaller, filtroDia, filtroHora);
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
      <PageHeader
        title="Matrículas"
        cicloNombre={cicloActual?.nombre}
        actionLabel="Nueva Matrícula"
        onAction={openCreateModal}
        actionDisabled={alumnos.length === 0 || talleres.length === 0}
      />

      {alumnos.length === 0 && (
        <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderRadius: '10px', marginBottom: '1rem', color: '#92400e', fontSize: '0.8125rem', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Debes crear alumnos y talleres primero.
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <MatriculasFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          taller={filtroTaller}
          onTallerChange={setFiltroTaller}
          dia={filtroDia}
          onDiaChange={setFiltroDia}
          hora={filtroHora}
          onHoraChange={setFiltroHora}
          estado={filtroEstado}
          onEstadoChange={setFiltroEstado}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          talleres={talleres}
        />
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
              render: (m) => (
                <span style={{ fontFamily: 'monospace', color: m.sesiones_disponibles > 0 ? '#059669' : '#dc2626' }}>
                  {m.sesiones_consumidas}/{m.sesiones_contratadas}
                </span>
              ),
            },
            {
              key: 'precio_total',
              label: 'Total',
              align: 'right',
              render: (m) => <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>S/. {m.precio_total}</span>,
            },
            {
              key: 'estado',
              label: 'Estado',
              align: 'center',
              render: (m) => (
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
              render: (m) => formatLimaDate(m.fecha_matricula) || '-',
            },
          ]}
          data={matriculas}
          keyField="id"
          actions={(m) => (
            <>
              <button
                onClick={() => openDetail(m.id, 'horarios')}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Ver
              </button>
              <button
                onClick={() => openDetail(m.id, 'asistencias')}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Asistencias
              </button>
              <button
                onClick={() => handleEdit(m)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '500', padding: '0.35rem 0.5rem' }}
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
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      <MatriculaFormModal
        isOpen={showModal}
        onClose={closeModal}
        onSuccess={handleSuccess}
        matricula={editingId ? matriculas.find((m) => m.id === editingId) || null : null}
        cicloId={cicloActual?.id}
      />

      <MatriculaDetailModal
        isOpen={detailMatriculaId !== null}
        onClose={closeDetail}
        matriculaId={detailMatriculaId}
        cicloId={cicloActual?.id}
        modo={detailModo}
      />

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
