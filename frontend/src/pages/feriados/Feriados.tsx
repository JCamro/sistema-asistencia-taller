import { useState, useEffect, useCallback, memo } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import FeriadoFormModal from './FeriadoFormModal';
import { getFeriados, deleteFeriado, aplicarFeriado } from '../../api/endpoints';
import type { Feriado } from '../../api/endpoints';

function FeriadosPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingFeriado, setEditingFeriado] = useState<Feriado | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [aplicandoId, setAplicandoId] = useState<number | null>(null);

  const fetchFeriados = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const response = await getFeriados(cicloActual.id, page);
      const data = response.data.results || response.data || [];
      setFeriados(Array.isArray(data) ? data : []);
      setTotalPages(Math.ceil((response.data.count || 0) / 20) || 1);
      setTotalCount(response.data.count || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching feriados:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, showApiError]);

  useEffect(() => {
    fetchFeriados(1);
  }, [fetchFeriados]);

  const handlePageChange = (page: number) => fetchFeriados(page);

  const openCreateModal = () => {
    setEditingFeriado(null);
    setShowModal(true);
  };

  const openEditModal = (feriado: Feriado) => {
    setEditingFeriado(feriado);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFeriado(null);
  };

  const handleSuccess = () => fetchFeriados(editingFeriado ? currentPage : 1);

  const confirmDelete = async () => {
    if (!cicloActual || !deletingId) return;
    try {
      await deleteFeriado(cicloActual.id, deletingId);
      showToast('Feriado eliminado', 'success');
      const newPage = feriados.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      fetchFeriados(newPage);
    } catch (err) {
      showApiError(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAplicar = async (feriado: Feriado) => {
    if (!cicloActual) return;
    setAplicandoId(feriado.id);
    try {
      const response = await aplicarFeriado(cicloActual.id, feriado.id);
      showToast(`Feriado aplicado: ${response.data.creadas} faltas registradas`, 'success');
    } catch (err) {
      showApiError(err);
    } finally {
      setAplicandoId(null);
    }
  };

  const formatFecha = (fecha: string) => {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  };

  if (loading && feriados.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader title="Feriados" cicloNombre={cicloActual?.nombre} actionLabel="Nuevo Feriado" onAction={openCreateModal} />

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        {feriados.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay feriados registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {feriados.map((f) => (
              <div key={f.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{formatFecha(f.fecha)}</div>
                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>{f.motivo}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                      {f.taller_nombre ? f.taller_nombre : 'Todos los talleres'}
                      {f.horario_nombre ? ` · ${f.horario_nombre}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => handleAplicar(f)} disabled={aplicandoId === f.id} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none', background: aplicandoId === f.id ? '#e5e7eb' : '#fee2e2', color: aplicandoId === f.id ? '#9ca3af' : '#991b1b', fontSize: '0.8125rem', fontWeight: 600, cursor: aplicandoId === f.id ? 'not-allowed' : 'pointer' }}>
                    {aplicandoId === f.id ? 'Aplicando...' : 'Aplicar'}
                  </button>
                  <button onClick={() => openEditModal(f)} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => setDeletingId(f.id)} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fecaca', background: 'white', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} onPageChange={handlePageChange} />
        )}
      </div>

      <FeriadoFormModal isOpen={showModal} onClose={closeModal} onSuccess={handleSuccess} feriado={editingFeriado} cicloId={cicloActual?.id ?? null} />

      <ConfirmModal
        isOpen={deletingId !== null}
        title="Eliminar Feriado"
        message="¿Estás seguro de que deseas eliminar este feriado?"
        itemName=""
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
        isLoading={false}
      />
    </div>
  );
}

export default memo(FeriadosPage);
