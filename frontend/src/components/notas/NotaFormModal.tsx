import { memo, useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import { createNota, updateNota, type Nota, type NotaInput } from '../../api/endpoints';

interface NotaFormModalProps {
  isOpen: boolean;
  editing: Nota | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyInput: NotaInput = {
  ciclo: 0,
  titulo: '',
  contenido: '',
  fecha: '',
  es_recordatorio: false,
  fecha_vencimiento: null,
};

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

function getInitialForm(editing: Nota | null, cicloId: number): NotaInput {
  if (editing) {
    return {
      ciclo: editing.ciclo,
      titulo: editing.titulo,
      contenido: editing.contenido,
      fecha: editing.fecha,
      es_recordatorio: editing.es_recordatorio,
      fecha_vencimiento: editing.fecha_vencimiento,
    };
  }
  return {
    ...emptyInput,
    ciclo: cicloId,
    fecha: new Date().toISOString().slice(0, 10),
  };
}

function NotaFormModal({ isOpen, editing, onClose, onSaved }: NotaFormModalProps) {
  const { cicloActual } = useCiclo();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const cicloId = cicloActual?.id ?? 0;
  const [form, setForm] = useState<NotaInput>(() => getInitialForm(editing, cicloId));

  const createMutation = useMutation({
    mutationFn: createNota,
    onSuccess: async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ['notas', cicloId] });
        await queryClient.refetchQueries({ queryKey: ['notas-no-leidas', cicloId] });
      } catch {
        showToast('Error al refrescar datos', 'error');
      }
      onSaved();
      showToast('Nota creada', 'success');
    },
    onError: () => showToast('Error al crear nota', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NotaInput> }) => updateNota(id, data),
    onSuccess: async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ['notas', cicloId] });
        await queryClient.refetchQueries({ queryKey: ['notas-no-leidas', cicloId] });
      } catch {
        showToast('Error al refrescar datos', 'error');
      }
      onSaved();
      showToast('Nota actualizada', 'success');
    },
    onError: () => showToast('Error al actualizar nota', 'error'),
  });

  const handleSave = useCallback(() => {
    if (!form.titulo.trim()) {
      showToast('El título es obligatorio', 'warning');
      return;
    }
    const fecha = form.fecha || new Date().toISOString().slice(0, 10);
    if (form.es_recordatorio && form.fecha_vencimiento && form.fecha_vencimiento < fecha) {
      showToast('La fecha de vencimiento no puede ser anterior a la fecha de la nota', 'warning');
      return;
    }
    const payload: NotaInput = {
      ...form,
      ciclo: cicloId,
      contenido: form.contenido?.trim() || '',
      fecha,
      es_recordatorio: !!form.es_recordatorio,
      fecha_vencimiento: form.es_recordatorio ? form.fecha_vencimiento || null : null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, editing, cicloId, showToast, createMutation, updateMutation]);

  if (!isOpen) return null;

  return (
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
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={onClose} style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem' }}>Cancelar</button>
            <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', background: '#d4af37', color: '#0a0a0a', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}><EditIcon /> {editing ? 'Guardar' : 'Crear'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(NotaFormModal);
