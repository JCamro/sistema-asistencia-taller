import { memo, useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../ui/ConfirmModal';
import {
  getNotas,
  createNota,
  updateNota,
  deleteNota,
  marcarLeida,
  marcarNoLeida,
  type Nota,
  type NotaInput,
} from '../../api/endpoints';

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
);
const BellIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);
const EyeOpenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);
const EyeClosedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
);

function formatLimaDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Lunes como inicio
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfMonth(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  first.setHours(0, 0, 0, 0);
  return first;
}

function normalizeDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupNotes(notes: Nota[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const groups: Record<string, Nota[]> = { Hoy: [], Ayer: [], 'Esta semana': [], 'Este mes': [], Anteriores: [] };

  notes.forEach((n) => {
    const d = normalizeDate(n.fecha);
    if (d.getTime() === today.getTime()) groups['Hoy'].push(n);
    else if (d.getTime() === yesterday.getTime()) groups['Ayer'].push(n);
    else if (d >= weekStart) groups['Esta semana'].push(n);
    else if (d >= monthStart) groups['Este mes'].push(n);
    else groups['Anteriores'].push(n);
  });

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

const emptyInput: NotaInput = {
  ciclo: 0,
  titulo: '',
  contenido: '',
  fecha: '',
  es_recordatorio: false,
  fecha_vencimiento: null,
};

function NotasFAB() {
  const { cicloActual } = useCiclo();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Nota | null>(null);
  const [form, setForm] = useState<NotaInput>(emptyInput);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const cicloId = cicloActual?.id ?? 0;

  const { data: notasData, isLoading } = useQuery({
    queryKey: ['notas', cicloId],
    queryFn: () => getNotas(cicloId).then((res) => res.data),
    enabled: !!cicloId,
  });
  const notas = notasData?.results || [];
  const totalNotas = notasData?.count || 0;

  const createMutation = useMutation({
    mutationFn: createNota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', cicloId] });
      queryClient.invalidateQueries({ queryKey: ['notas-no-leidas', cicloId] });
      closeModal();
      showToast('Nota creada', 'success');
    },
    onError: () => showToast('Error al crear nota', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NotaInput> }) => updateNota(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', cicloId] });
      queryClient.invalidateQueries({ queryKey: ['notas-no-leidas', cicloId] });
      closeModal();
      showToast('Nota actualizada', 'success');
    },
    onError: () => showToast('Error al actualizar nota', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', cicloId] });
      queryClient.invalidateQueries({ queryKey: ['notas-no-leidas', cicloId] });
      closeModal();
      showToast('Nota eliminada', 'success');
    },
    onError: () => showToast('Error al eliminar nota', 'error'),
  });

  const grouped = useMemo(() => groupNotes(notas), [notas]);

  const openCreate = useCallback(() => {
    setPanelOpen(false);
    setEditing(null);
    setForm({
      ...emptyInput,
      ciclo: cicloId,
      fecha: new Date().toISOString().slice(0, 10),
      es_recordatorio: false,
      fecha_vencimiento: null,
    });
    setModalOpen(true);
  }, [cicloId]);

  const openEdit = useCallback((nota: Nota) => {
    setPanelOpen(false);
    setEditing(nota);
    setForm({
      ciclo: nota.ciclo,
      titulo: nota.titulo,
      contenido: nota.contenido,
      fecha: nota.fecha,
      es_recordatorio: nota.es_recordatorio,
      fecha_vencimiento: nota.fecha_vencimiento,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyInput);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.titulo.trim()) {
      showToast('El título es obligatorio', 'warning');
      return;
    }
    const payload: NotaInput = {
      ...form,
      ciclo: cicloId,
      contenido: form.contenido?.trim() || '',
      fecha: form.fecha || new Date().toISOString().slice(0, 10),
      es_recordatorio: !!form.es_recordatorio,
      fecha_vencimiento: form.es_recordatorio ? form.fecha_vencimiento || null : null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, editing, cicloId, showToast, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (editing) {
      setModalOpen(false);
      setDeleteId(editing.id);
    }
  }, [editing]);

  const confirmDelete = useCallback(() => {
    if (deleteId !== null) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, deleteMutation]);

  const toggleLeida = useCallback(async (e: React.MouseEvent, nota: Nota) => {
    e.stopPropagation();
    try {
      if (nota.leida) await marcarNoLeida(nota.id);
      else await marcarLeida(nota.id);
      queryClient.invalidateQueries({ queryKey: ['notas', cicloId] });
      queryClient.invalidateQueries({ queryKey: ['notas-no-leidas', cicloId] });
    } catch {
      showToast('Error al cambiar estado', 'error');
    }
  }, [cicloId, queryClient, showToast]);

  const handleNoteClick = useCallback(async (nota: Nota) => {
    if (!nota.leida) {
      try {
        await marcarLeida(nota.id);
        queryClient.invalidateQueries({ queryKey: ['notas', cicloId] });
        queryClient.invalidateQueries({ queryKey: ['notas-no-leidas', cicloId] });
      } catch {
        // continuamos abriendo igual
      }
    }
    openEdit(nota);
  }, [cicloId, openEdit, queryClient]);

  if (!cicloActual) return null;

  return (
    <>
      <button
        onClick={() => setPanelOpen((v) => !v)}
        title="Notas y recordatorios"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #d4af37 0%, #f0d878 100%)',
          color: '#0a0a0a',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
        }}
        aria-label="Notas"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
      </button>

      {panelOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 360,
            maxWidth: '100vw',
            height: '100vh',
            background: 'white',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
            zIndex: 110,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#fef9e7,#fdf3d0)' }}>
            <span style={{ fontWeight: 700, color: '#5c4508', fontSize: '1rem' }}>Notas</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={openCreate} title="Nueva nota" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#d4af37', color: '#0a0a0a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
              <button onClick={() => setPanelOpen(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>Cargando...</div>
            ) : grouped.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0', fontSize: '0.875rem' }}>No hay notas aún.<br />Presioná + para crear una.</div>
            ) : (
              grouped.map(([section, items]) => (
                <div key={section} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{section}</div>
                  {items.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNoteClick(n)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: n.leida ? 'white' : '#fffbeb',
                        border: '1px solid #f1f5f9',
                        marginBottom: '0.5rem',
                        cursor: 'pointer',
                        borderLeft: n.leida ? '3px solid transparent' : '3px solid #d4af37',
                        transition: 'box-shadow 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: n.leida ? 500 : 700, color: '#0f172a', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.titulo}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.125rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.contenido || <span style={{ color: '#94a3b8' }}>(sin contenido)</span>}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem' }}>
                            {n.es_recordatorio && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.65rem', color: '#d97706', background: '#fef3c7', padding: '0.1rem 0.35rem', borderRadius: '9999px' }}><BellIcon />{n.fecha_vencimiento ? `Vence ${formatLimaDate(n.fecha_vencimiento)}` : 'Recordatorio'}</span>
                            )}
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{formatLimaDate(n.fecha)}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => toggleLeida(e, n)}
                          title={n.leida ? 'Marcar no leída' : 'Marcar leída'}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: n.leida ? '#94a3b8' : '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          {n.leida ? <EyeClosedIcon /> : <EyeOpenIcon />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            zIndex: 105,
          }}
        />
      )}

      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '14px',
            width: '100%',
            maxWidth: 420,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{editing ? 'Editar nota' : 'Nueva nota'}</span>
              <button onClick={closeModal} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej. Revisar pagos pendientes"
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>Contenido</label>
                <textarea
                  value={form.contenido}
                  onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))}
                  rows={4}
                  placeholder="Detalle de la nota..."
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={form.es_recordatorio}
                      onChange={(e) => setForm((f) => ({ ...f, es_recordatorio: e.target.checked }))}
                    />
                    Recordatorio
                  </label>
                </div>
              </div>
              {form.es_recordatorio && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={form.fecha_vencimiento || ''}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value || null }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                {editing ? (
                  <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500 }}><TrashIcon /> Eliminar</button>
                ) : <span />}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={closeModal} style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem' }}>Cancelar</button>
                  <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', background: '#d4af37', color: '#0a0a0a', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}><EditIcon /> {editing ? 'Guardar' : 'Crear'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteId !== null}
        title="Eliminar nota"
        message="Esta acción no se puede deshacer."
        itemName={deleteId !== null ? notas.find(n => n.id === deleteId)?.titulo || '' : ''}
        variant="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

export default memo(NotasFAB);
