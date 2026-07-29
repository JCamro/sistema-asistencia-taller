import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import FeriadoFormModal from './FeriadoFormModal';
import { getFeriados, deleteFeriado, aplicarFeriado, deleteGrupo, aplicarGrupo } from '../../api/endpoints';
import type { Feriado } from '../../api/endpoints';

interface FeriadoGrupo {
  grupo: string;
  motivo: string;
  fecha_inicio: string;
  fecha_fin: string;
  count: number;
  taller: number | null;
  taller_nombre: string | null;
  horario: number | null;
  horario_nombre: string | null;
  items: Feriado[];
}

function isFeriadoGrupo(item: Feriado | FeriadoGrupo): item is FeriadoGrupo {
  return Array.isArray((item as FeriadoGrupo).items);
}

function agruparFeriados(feriados: Feriado[]): (FeriadoGrupo | Feriado)[] {
  const porGrupo = new Map<string, Feriado[]>();
  const sueltos: Feriado[] = [];

  for (const f of feriados) {
    if (f.grupo) {
      const arr = porGrupo.get(f.grupo) || [];
      arr.push(f);
      porGrupo.set(f.grupo, arr);
    } else {
      sueltos.push(f);
    }
  }

  const grupos: FeriadoGrupo[] = [];
  for (const [grupo, items] of porGrupo) {
    const sorted = [...items].sort((a, b) => a.fecha.localeCompare(b.fecha));
    grupos.push({
      grupo,
      motivo: sorted[0].motivo,
      fecha_inicio: sorted[0].fecha,
      fecha_fin: sorted[sorted.length - 1].fecha,
      count: sorted.length,
      taller: sorted[0].taller,
      taller_nombre: sorted[0].taller_nombre,
      horario: sorted[0].horario,
      horario_nombre: sorted[0].horario_nombre,
      items: sorted,
    });
  }

  return [...grupos, ...sueltos].sort((a, b) => {
    const fa = 'fecha_inicio' in a ? a.fecha_inicio : a.fecha;
    const fb = 'fecha_inicio' in b ? b.fecha_inicio : b.fecha;
    return fb.localeCompare(fa);
  });
}

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
  const [deletingGrupoId, setDeletingGrupoId] = useState<string | null>(null);
  const [aplicandoId, setAplicandoId] = useState<number | null>(null);
  const [aplicandoGrupoId, setAplicandoGrupoId] = useState<string | null>(null);
  const [confirmAplicar, setConfirmAplicar] = useState<Feriado | null>(null);
  const [confirmAplicarGrupo, setConfirmAplicarGrupo] = useState<FeriadoGrupo | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const items = useMemo(() => agruparFeriados(feriados), [feriados]);

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

  const confirmDeleteGrupo = async () => {
    if (!cicloActual || !deletingGrupoId) return;
    try {
      await deleteGrupo(cicloActual.id, deletingGrupoId);
      showToast('Grupo de feriados eliminado', 'success');
      const newPage = feriados.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      fetchFeriados(newPage);
    } catch (err) {
      showApiError(err);
    } finally {
      setDeletingGrupoId(null);
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

  const handleAplicarGrupo = async (grupo: FeriadoGrupo) => {
    if (!cicloActual) return;
    setAplicandoGrupoId(grupo.grupo);
    try {
      const response = await aplicarGrupo(cicloActual.id, grupo.grupo);
      showToast(`Semana aplicada: ${response.data.aplicados} faltas registradas`, 'success');
    } catch (err) {
      showApiError(err);
    } finally {
      setAplicandoGrupoId(null);
    }
  };

  const toggleGroup = (grupoId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
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

      <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #c8ccd4', overflow: 'hidden' }}>
        {items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay feriados registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item) => {
              if (isFeriadoGrupo(item)) {
                const grupo = item;
                const isExpanded = expandedGroups.has(grupo.grupo);
                const isAplicando = aplicandoGrupoId === grupo.grupo;
                return (
                  <div key={grupo.grupo}>
                    {/* Group row — clickable */}
                    <div
                      onClick={() => toggleGroup(grupo.grupo)}
                      style={{ padding: '1rem 1.25rem', borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'white', borderLeft: '3px solid #d4af37', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fdfbf5')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <span
                          className="touch-target"
                          style={{
                            width: 32, height: 32, borderRadius: '8px', border: '1.5px solid #c8ccd4',
                            background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d4af37'; e.currentTarget.style.background = '#fdfbf5'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#c8ccd4'; e.currentTarget.style.background = 'white'; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isExpanded ? '#d4af37' : '#6b7280'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{grupo.motivo}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span>{formatFecha(grupo.fecha_inicio)} — {formatFecha(grupo.fecha_fin)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem', borderRadius: '9999px', background: '#f3f4f6', fontSize: '0.6875rem', fontWeight: 600, color: '#374151' }}>{grupo.count} días</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            {grupo.taller_nombre ? grupo.taller_nombre : 'Todos los talleres'}
                            {grupo.horario_nombre ? ` · ${grupo.horario_nombre}` : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmAplicarGrupo(grupo); }} disabled={isAplicando} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none', background: isAplicando ? '#e5e7eb' : '#fee2e2', color: isAplicando ? '#9ca3af' : '#991b1b', fontSize: '0.8125rem', fontWeight: 600, cursor: isAplicando ? 'not-allowed' : 'pointer' }}>
                          {isAplicando ? 'Aplicando...' : 'Aplicar semana'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeletingGrupoId(grupo.grupo); }} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fecaca', background: 'white', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    </div>
                    {/* Expanded sub-rows */}
                    {isExpanded && (
                      <div style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {grupo.items.map((f) => (
                          <div key={f.id} style={{ padding: '0.625rem 1.25rem 0.625rem 3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: '#f9fafb', borderLeft: '3px solid #d4af37' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.8125rem' }}>{formatFecha(f.fecha)}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  {f.taller_nombre ? f.taller_nombre : 'Todos los talleres'}
                                  {f.horario_nombre ? ` · ${f.horario_nombre}` : ''}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => setConfirmAplicar(f)} disabled={aplicandoId === f.id} className="touch-target" style={{ padding: '0.375rem 0.625rem', borderRadius: '8px', border: 'none', background: aplicandoId === f.id ? '#e5e7eb' : '#fee2e2', color: aplicandoId === f.id ? '#9ca3af' : '#991b1b', fontSize: '0.75rem', fontWeight: 600, cursor: aplicandoId === f.id ? 'not-allowed' : 'pointer' }}>
                              {aplicandoId === f.id ? '...' : 'Aplicar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Single feriado
              const f = item as Feriado;
              return (
                <div key={f.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
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
                    <button onClick={() => setConfirmAplicar(f)} disabled={aplicandoId === f.id} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none', background: aplicandoId === f.id ? '#e5e7eb' : '#fee2e2', color: aplicandoId === f.id ? '#9ca3af' : '#991b1b', fontSize: '0.8125rem', fontWeight: 600, cursor: aplicandoId === f.id ? 'not-allowed' : 'pointer' }}>
                      {aplicandoId === f.id ? 'Aplicando...' : 'Aplicar'}
                    </button>
                    <button onClick={() => openEditModal(f)} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setDeletingId(f.id)} className="touch-target" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fecaca', background: 'white', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Eliminar</button>
                  </div>
                </div>
              );
            })}
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

      <ConfirmModal
        isOpen={deletingGrupoId !== null}
        title="Eliminar Grupo de Feriados"
        message="¿Estás seguro de que deseas eliminar todos los feriados de este grupo?"
        itemName=""
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteGrupo}
        onCancel={() => setDeletingGrupoId(null)}
        isLoading={false}
      />

      <ConfirmModal
        isOpen={confirmAplicar !== null}
        title="Aplicar Feriado"
        message="Se registrarán faltas para todos los alumnos afectados. ¿Continuar?"
        itemName={confirmAplicar ? `${formatFecha(confirmAplicar.fecha)} — ${confirmAplicar.motivo}` : ''}
        confirmLabel="Aplicar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (confirmAplicar) { const f = confirmAplicar; setConfirmAplicar(null); handleAplicar(f); } }}
        onCancel={() => setConfirmAplicar(null)}
        isLoading={aplicandoId !== null}
        variant="action"
      />

      <ConfirmModal
        isOpen={confirmAplicarGrupo !== null}
        title="Aplicar Semana de Feriados"
        message="Se registrarán faltas para todos los días del grupo. ¿Continuar?"
        itemName={confirmAplicarGrupo ? `${confirmAplicarGrupo.motivo} — ${confirmAplicarGrupo.count} días` : ''}
        confirmLabel="Aplicar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (confirmAplicarGrupo) { const g = confirmAplicarGrupo; setConfirmAplicarGrupo(null); handleAplicarGrupo(g); } }}
        onCancel={() => setConfirmAplicarGrupo(null)}
        isLoading={aplicandoGrupoId !== null}
        variant="action"
      />
    </div>
  );
}

export default memo(FeriadosPage);
