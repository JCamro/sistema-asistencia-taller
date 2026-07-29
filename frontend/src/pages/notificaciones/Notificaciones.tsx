import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmModal from '../../components/ui/ConfirmModal';
import NotaFormModal from '../../components/notas/NotaFormModal';
import { queryKeys } from '../../api/queryKeys';
import {
  getNotas,
  deleteNota,
  marcarLeida,
  marcarNoLeida,
  type Nota,
} from '../../api/endpoints';
import { EmptyIcon } from './icons';
import { groupNotas, GROUP_ORDER } from './date-helpers';
import { NotaCard } from './NotaCard';
import { FilterBar } from './FilterBar';
import { DateGroupHeader } from './DateGroupHeader';
import { StatsBar } from './StatsBar';

// ── Page ─────────────────────────────────────────────────────────────────────

function NotificacionesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cicloActual } = useCiclo();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const autoOpenedRef = useRef(false);

  const [search, setSearch] = useState('');
  const initialFilter = (searchParams.get('filter') === 'recordatorios' ? 'recordatorios' : 'notas') as 'notas' | 'recordatorios';
  const [type, setType] = useState<'notas' | 'recordatorios'>(initialFilter);
  const [readStatus, setReadStatus] = useState<'todas' | 'no_leidas'>('todas');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Nota | null>(null);
  const [modalOpen, setModalOpen] = useState(searchParams.get('crear') === '1');
  const [modalKey, setModalKey] = useState(0);
  const [deleting, setDeleting] = useState<Nota | null>(null);

  const esRecordatorioParam = type === 'recordatorios' ? 'true' : 'false';
  const leidaParam = readStatus === 'no_leidas' ? 'false' : undefined;

  useEffect(() => {
    if (searchParams.get('crear') === '1' && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      navigate('/notificaciones', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleTypeChange = useCallback((v: 'notas' | 'recordatorios') => {
    setType(v);
    setReadStatus('todas'); // reset read filter when switching type
    setPage(1);
  }, []);
  const handleReadStatusChange = useCallback((v: 'todas' | 'no_leidas') => { setReadStatus(v); setPage(1); }, []);
  const handleSearchChange = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  const queryKey = queryKeys.notas(cicloActual?.id ?? 0, page, search, esRecordatorioParam, leidaParam);

  const { data: notasResponse, isPending, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!cicloActual) return { count: 0, results: [] };
      const response = await getNotas(cicloActual.id, {
        page, search,
        es_recordatorio: esRecordatorioParam,
        leida: leidaParam,
      });
      return response.data;
    },
    enabled: !!cicloActual,
    staleTime: 30_000,
  });

  const notas = useMemo(() => {
    const raw = notasResponse?.results || [];
    return [...raw].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [notasResponse]);

  const grouped = useMemo(() => groupNotas(notas), [notas]);
  const totalCount = notasResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / 20) || 1;

  // ── Mutations with optimistic cache update ──

  const handleSaved = useCallback(() => { setModalOpen(false); setEditing(null); }, []);

  const handleEdit = useCallback((n: Nota) => {
    setEditing(n);
    setModalKey(k => k + 1);
    setModalOpen(true);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: deleteNota,
    onMutate: async (id) => {
      // Optimistic: remove from cache immediately
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: { count: number; results: Nota[] } | undefined) => {
        if (!old) return old;
        return { ...old, count: old.count - 1, results: old.results.filter(n => n.id !== id) };
      });
      return { previous };
    },
    onSuccess: async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ['notas', cicloActual?.id ?? 0] });
        await queryClient.refetchQueries({ queryKey: ['notas-no-leidas', cicloActual?.id ?? 0] });
      } catch {
        showToast('Error al refrescar datos', 'error');
      }
      setDeleting(null);
      showToast('Nota eliminada', 'success');
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      showToast('Error al eliminar nota', 'error');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ id, read }: { id: number; read: boolean }) => {
      if (read) await marcarLeida(id);
      else await marcarNoLeida(id);
    },
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: { count: number; results: Nota[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map(n => n.id === id ? { ...n, leida: read } : n),
        };
      });
      return { previous };
    },
    onSuccess: async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ['notas', cicloActual?.id ?? 0] });
        await queryClient.refetchQueries({ queryKey: ['notas-no-leidas', cicloActual?.id ?? 0] });
      } catch {
        showToast('Error al refrescar datos', 'error');
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      showToast('Error al cambiar estado', 'error');
    },
  });

  const handleToggleRead = useCallback((n: Nota) => {
    markReadMutation.mutate({ id: n.id, read: !n.leida });
  }, [markReadMutation]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalKey(k => k + 1);
    setModalOpen(true);
  }, []);

  const hasActiveFilters = search || readStatus !== 'todas';

  // ── Loading ──
  if (isPending && !notasResponse && !modalOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <PageHeader title="Notificaciones" cicloNombre={cicloActual?.nombre} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '1rem' }}>
          <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>Error al cargar notificaciones.</p>
          <button onClick={() => queryClient.refetchQueries({ queryKey: ['notas', cicloActual?.id ?? 0] })} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>Reintentar</button>
        </div>
      </div>
    );
  }

  // ── Empty ──
  const emptyState = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '0.75rem' }}>
      <EmptyIcon />
      <p style={{ color: '#9ca3af', fontSize: '0.9375rem', fontWeight: 500 }}>
        {hasActiveFilters ? 'No se encontraron resultados' : 'No hay notificaciones'}
      </p>
      {!hasActiveFilters && (
        <button onClick={openCreate} style={{ marginTop: '0.5rem', padding: '0.5rem 1.25rem', borderRadius: '10px', border: 'none', background: '#111827', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}>
          Crear primera nota
        </button>
      )}
    </div>
  );

  // ── Render ──
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <PageHeader title="Notificaciones" cicloNombre={cicloActual?.nombre} actionLabel="Nueva nota" onAction={openCreate} />

      <FilterBar
        type={type}
        readStatus={readStatus}
        onTypeChange={handleTypeChange}
        onReadStatusChange={handleReadStatusChange}
        onSearchChange={handleSearchChange}
      />

      {notas.length === 0 ? (
        emptyState
      ) : (
        <>
          <StatsBar notas={notas} />

          <div>
            {GROUP_ORDER.map(groupLabel => {
              const items = grouped.get(groupLabel);
              if (!items || items.length === 0) return null;
              return (
                <div key={groupLabel}>
                  <DateGroupHeader label={groupLabel} count={items.length} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {items.map(n => (
                      <NotaCard
                        key={n.id}
                        nota={n}
                        onEdit={handleEdit}
                        onDelete={(nota) => setDeleting(nota)}
                        onToggleRead={handleToggleRead}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: 'white', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.8125rem', color: page === 1 ? '#d1d5db' : '#374151', fontWeight: 500 }}
          >
            Anterior
          </button>
          <span style={{ fontSize: '0.8125rem', color: '#6b7280', padding: '0 0.5rem' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: 'white', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.8125rem', color: page === totalPages ? '#d1d5db' : '#374151', fontWeight: 500 }}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modals */}
      <NotaFormModal key={modalKey} isOpen={modalOpen} editing={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSaved={handleSaved} />
      <ConfirmModal
        isOpen={deleting !== null}
        title="Eliminar nota"
        message="Esta acción no se puede deshacer."
        itemName={deleting?.titulo || ''}
        variant="destructive"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

export default memo(NotificacionesPage);
