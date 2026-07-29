import { useState, useEffect, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageHeader from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import TraspasoModal from '../../components/ui/TraspasoModal';
import MatriculasFilterBar from './MatriculasFilterBar';
import MatriculaFormModal, { type MatriculaInitialData } from './MatriculaFormModal';
import MatriculaStudentCard from './MatriculaStudentCard';
import api from '../../api/axios';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { getMatriculasAgrupadas } from '../../api/endpoints';
import type { MatriculaAgrupada, Alumno, Taller, Matricula } from '../../api/endpoints';

function getOrderingParam(order: string) {
  switch (order) {
    case 'oldest': return 'fecha_matricula';
    case 'alpha': return 'alumno__apellido';
    default: return '-fecha_matricula';
  }
}

function MatriculasPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grupos, setGrupos] = useState<MatriculaAgrupada[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [matriculasFlat, setMatriculasFlat] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const { searchText, setSearchText, debouncedValue: debouncedSearch, resetSearch } = useDebouncedSearch();

  const filtroEstado = searchParams.get('estado') || 'todas';
  const filtroTaller = searchParams.get('taller') || '';
  const filtroDia = searchParams.get('dia') || '';
  const filtroHora = searchParams.get('hora') || '';
  const sortOrder = (searchParams.get('orden') as 'recent' | 'oldest' | 'alpha') || 'recent';
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [traspasandoId, setTraspasandoId] = useState<number | null>(null);
  const [traspasandoNombre, setTraspasandoNombre] = useState<string>('');
  const [traspasandoTaller, setTraspasandoTaller] = useState<string>('');
  const [traspasandoLoading, setTraspasandoLoading] = useState(false);
  const [recrearData, setRecrearData] = useState<MatriculaInitialData | null>(null);

  const updateParam = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'todas') next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
    setCurrentPage(1);
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
    resetSearch();
    setCurrentPage(1);
  }, [setSearchParams, resetSearch]);

  useEffect(() => {
    setSearchText(searchParams.get('search') || '');
  }, [searchParams, setSearchText]);

  const fetchGrupos = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      let params = '';
      if (debouncedSearch) params += `search=${encodeURIComponent(debouncedSearch.slice(0, 100))}&`;
      if (filtroEstado && filtroEstado !== 'todas') params += `estado=${encodeURIComponent(filtroEstado)}&`;
      if (filtroTaller) params += `taller=${encodeURIComponent(filtroTaller)}&`;
      if (filtroDia) params += `dia=${encodeURIComponent(filtroDia)}&`;
      if (filtroHora) params += `hora=${encodeURIComponent(filtroHora)}&`;
      params += `ordering=${encodeURIComponent(getOrderingParam(sortOrder))}&`;
      if (page > 1) params += `page=${page}`;
      const response = await getMatriculasAgrupadas(cicloActual.id, params.replace(/&$/, ''));
      const data = response.data.results || response.data || [];
      setGrupos(Array.isArray(data) ? data : []);
      setTotalPages(Math.ceil((response.data.count || 0) / 20) || 1);
      setTotalCount(response.data.count || 0);
      setCurrentPage(page);
    } catch (err: any) {
      console.error('Error fetching grupos:', err);
      if (err.response?.status === 401) showToast('Sesión expirada. Iniciá sesión de nuevo.', 'error');
    } finally {
      setLoading(false);
    }
  }, [cicloActual, debouncedSearch, filtroEstado, filtroTaller, filtroDia, filtroHora, sortOrder, showToast]);

  const fetchLookups = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const [alumnosResponse, talleresResponse] = await Promise.all([
        api.get(`/ciclos/${cicloActual.id}/alumnos/?page_size=200`),
        api.get(`/ciclos/${cicloActual.id}/talleres/?page_size=200`),
      ]);
      const alumnosData = alumnosResponse.data.results || alumnosResponse.data;
      const talleresData = talleresResponse.data.results || talleresResponse.data;
      setAlumnos(Array.isArray(alumnosData) ? alumnosData.filter((a: Alumno) => a.activo) : []);
      setTalleres(Array.isArray(talleresData) ? talleresData.filter((t: Taller) => t.activo) : []);
    } catch (err: any) {
      console.error('Error fetching lookups:', err);
      if (err.response?.status === 401) showToast('Sesión expirada. Iniciá sesión de nuevo.', 'error');
    }
  }, [cicloActual, showToast]);

  const fetchMatriculasFlat = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const response = await api.get(`/ciclos/${cicloActual.id}/matriculas/?page_size=200`);
      const data = response.data.results || response.data;
      setMatriculasFlat(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching matriculas:', err);
    }
  }, [cicloActual]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchGrupos(1), fetchLookups(), fetchMatriculasFlat()]).finally(() => setLoading(false));
  }, [cicloActual]);

  useEffect(() => {
    fetchGrupos(1);
  }, [debouncedSearch, filtroEstado, filtroTaller, filtroDia, filtroHora, sortOrder, fetchGrupos]);

  const handlePageChange = (page: number) => fetchGrupos(page);

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
      const newPage = grupos.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      fetchGrupos(newPage);
      fetchMatriculasFlat();
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

  const handleEdit = (id: number) => {
    setEditingId(id);
    setShowModal(true);
  };

  const handleRecrear = async (id: number) => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [res, horariosRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/ciclos/${cicloActual.id}/matriculas/${id}/detalle/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get(`/matriculas-horarios/?matricula=${id}`),
      ]);
      if (!res.ok) {
        showToast('No se pudo cargar la matrícula', 'error');
        return;
      }
      const data = await res.json();
      const matricula = data.matricula || data;
      const horariosJson = horariosRes.data.results || horariosRes.data;
      const horariosIds = Array.isArray(horariosJson) ? horariosJson.map((mh: any) => mh.horario) : [];
      setRecrearData({
        alumno_id: matricula.alumno_id ?? matricula.alumno,
        alumno_nombre: matricula.alumno_nombre ?? '',
        taller_id: matricula.taller_id ?? matricula.taller,
        taller_nombre: matricula.taller_nombre ?? matricula.taller ?? '',
        horarios_ids: horariosIds,
        sesiones_contratadas: matricula.sesiones_contratadas,
        metodo_pago: matricula.metodo_pago ?? 'efectivo',
      });
      setEditingId(null);
      setShowModal(true);
    } catch (err) {
      console.error('Error al cargar matrícula para re-crear:', err);
      showToast('Error al cargar la matrícula', 'error');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setRecrearData(null);
  };

  const handleSuccess = () => {
    fetchGrupos(editingId ? currentPage : 1);
    fetchMatriculasFlat();
  };

  const handleTraspaso = async (alumnoDestinoId: number) => {
    if (!traspasandoId) return;
    setTraspasandoLoading(true);
    try {
      const response = await api.post(`/matriculas/${traspasandoId}/traspasar/`, { alumno_destino_id: alumnoDestinoId });
      showToast(response.data.detail || 'Traspaso realizado exitosamente', 'success');
      setTraspasandoId(null);
      setTraspasandoNombre('');
      setTraspasandoTaller('');
      fetchGrupos(currentPage);
      fetchMatriculasFlat();
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

  const recientesConcluidas = grupos.flatMap((g) => g.matriculas.filter((m) => {
    if (m.estado !== 'concluida' || !m.fecha_matricula) return false;
    const fecha = new Date(m.fecha_matricula);
    const hace7 = new Date();
    hace7.setDate(hace7.getDate() - 7);
    return fecha >= hace7;
  }));

  if (loading && grupos.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #40E0D0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Matrículas" cicloNombre={cicloActual?.nombre} actionLabel="Nueva Matrícula" onAction={openCreateModal} actionDisabled={alumnos.length === 0 || talleres.length === 0} />

      {alumnos.length === 0 && (
        <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderRadius: '10px', marginBottom: '1rem', color: '#92400e', fontSize: '0.8125rem', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Debés crear alumnos y talleres primero.
        </div>
      )}

      {recientesConcluidas.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Recién concluidas</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {recientesConcluidas.slice(0, 5).map((m) => (
              <span key={m.id} style={{ padding: '0.35rem 0.75rem', background: 'white', borderRadius: '9999px', fontSize: '0.75rem', color: '#92400e', border: '1px solid #fde68a' }}>
                {m.taller} · {m.sesiones_consumidas}/{m.sesiones_contratadas}
              </span>
            ))}
          </div>
        </div>
      )}

      <MatriculasFilterBar
        searchText={searchText}
        onSearchChange={(value) => { setSearchText(value); updateParam('search', value); }}
        taller={filtroTaller ? Number(filtroTaller) : ''}
        onTallerChange={(value) => updateParam('taller', value ? String(value) : '')}
        dia={filtroDia !== '' ? Number(filtroDia) : ''}
        onDiaChange={(value) => updateParam('dia', value !== '' ? String(value) : '')}
        hora={filtroHora !== '' ? Number(filtroHora) : ''}
        onHoraChange={(value) => updateParam('hora', value !== '' ? String(value) : '')}
        estado={filtroEstado}
        onEstadoChange={(value) => updateParam('estado', value)}
        sortOrder={sortOrder}
        onSortChange={(value) => updateParam('orden', value)}
        talleres={talleres}
        onClear={clearFilters}
      />

      <div>
        {grupos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: '12px', border: '1.5px solid #c8ccd4' }}>No hay matrículas</div>
        ) : (
          <>
            {grupos.map((g) => (
              <MatriculaStudentCard
                key={g.alumno_id}
                grupo={g}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTraspaso={(id, name, taller) => {
                  setTraspasandoId(id);
                  setTraspasandoNombre(name);
                  setTraspasandoTaller(taller);
                }}
                onRecrear={handleRecrear}
              />
            ))}
          </>
        )}
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} onPageChange={handlePageChange} />
        )}
      </div>

      <MatriculaFormModal
        isOpen={showModal}
        onClose={closeModal}
        onSuccess={handleSuccess}
        matricula={editingId ? matriculasFlat.find((m) => m.id === editingId) || null : null}
        editingId={editingId}
        cicloId={cicloActual?.id}
        initialData={recrearData}
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
