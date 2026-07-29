import { useState, useEffect, useCallback, memo } from 'react';
import api from '../../api/axios';
import { useToast } from '../../contexts/ToastContext';
import type { Feriado, Taller, Horario } from '../../api/endpoints';

interface FeriadoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  feriado: Feriado | null;
  cicloId: number | null;
}

type Modo = 'dia' | 'semana';

const initialForm = {
  fecha: '',
  fechaFin: '',
  motivo: '',
  taller: '' as number | '',
  horario: '' as number | '',
};

/** Genera array de fechas YYYY-MM-DD entre inicio y fin (inclusive) */
function generarFechas(inicio: string, fin: string): string[] {
  const fechas: string[] = [];
  const d = new Date(inicio + 'T00:00:00');
  const end = new Date(fin + 'T00:00:00');
  while (d <= end) {
    fechas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return fechas;
}

function FeriadoFormModal({ isOpen, onClose, onSuccess, feriado, cicloId }: FeriadoFormModalProps) {
  const { showToast, showApiError } = useToast();
  const [form, setForm] = useState(initialForm);
  const [modo, setModo] = useState<Modo>('dia');
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = !!feriado;

  const fetchTalleres = useCallback(async () => {
    if (!cicloId) return;
    try {
      const response = await api.get(`/ciclos/${cicloId}/talleres/?page_size=200`);
      const data = response.data.results || response.data;
      setTalleres(Array.isArray(data) ? data.filter((t: Taller) => t.activo) : []);
    } catch (err) {
      console.error('Error fetching talleres:', err);
    }
  }, [cicloId]);

  const fetchHorarios = useCallback(async (tallerId?: number) => {
    if (!cicloId) return;
    try {
      const url = tallerId
        ? `/ciclos/${cicloId}/horarios/?taller=${tallerId}&page_size=200`
        : `/ciclos/${cicloId}/horarios/?page_size=200`;
      const response = await api.get(url);
      const data = response.data.results || response.data;
      setHorarios(Array.isArray(data) ? data.filter((h: Horario) => h.activo) : []);
    } catch (err) {
      console.error('Error fetching horarios:', err);
    }
  }, [cicloId]);

  useEffect(() => {
    if (!isOpen || !cicloId) {
      setForm(initialForm);
      setModo('dia');
      setHorarios([]);
      return;
    }
    fetchTalleres();
    if (feriado) {
      setForm({
        fecha: feriado.fecha,
        fechaFin: '',
        motivo: feriado.motivo,
        taller: feriado.taller || '',
        horario: feriado.horario || '',
      });
      if (feriado.taller) fetchHorarios(feriado.taller);
      else fetchHorarios();
    } else {
      setForm(initialForm);
      fetchHorarios();
    }
  }, [isOpen, cicloId, feriado, fetchTalleres, fetchHorarios]);

  useEffect(() => {
    if (form.taller) {
      fetchHorarios(Number(form.taller));
    } else {
      setHorarios([]);
      setForm((prev) => ({ ...prev, horario: '' }));
    }
  }, [form.taller, fetchHorarios]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloId) return;
    if (!form.fecha || !form.motivo.trim()) {
      showToast('Completá fecha y motivo', 'warning');
      return;
    }
    if (modo === 'semana' && !form.fechaFin) {
      showToast('Completá la fecha de fin', 'warning');
      return;
    }
    if (modo === 'semana' && form.fechaFin < form.fecha) {
      showToast('La fecha de fin debe ser posterior a la de inicio', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (isEditing || modo === 'dia') {
        // Single create/edit
        const payload: Record<string, unknown> = {
          fecha: form.fecha,
          motivo: form.motivo.trim(),
        };
        if (form.taller) payload.taller = Number(form.taller);
        if (form.horario) payload.horario = Number(form.horario);
        if (feriado) {
          await api.patch(`/ciclos/${cicloId}/feriados/${feriado.id}/`, payload);
          showToast('Feriado actualizado', 'success');
        } else {
          await api.post(`/ciclos/${cicloId}/feriados/`, payload);
          showToast('Feriado creado', 'success');
        }
      } else {
        // Week mode: create one feriado per day with same grupo UUID
        const grupoId = crypto.randomUUID();
        const fechas = generarFechas(form.fecha, form.fechaFin);
        let creados = 0;
        let errores = 0;
        for (const fecha of fechas) {
          const payload: Record<string, unknown> = {
            fecha,
            motivo: form.motivo.trim(),
            grupo: grupoId,
          };
          if (form.taller) payload.taller = Number(form.taller);
          if (form.horario) payload.horario = Number(form.horario);
          try {
            await api.post(`/ciclos/${cicloId}/feriados/`, payload);
            creados++;
          } catch {
            errores++;
          }
        }
        if (errores === 0) {
          showToast(`Semana completa: ${creados} feriados creados`, 'success');
        } else {
          showToast(`${creados} creados, ${errores} omitidos (duplicados o errores)`, 'warning');
        }
      }
      onSuccess();
      onClose();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{feriado ? 'Editar Feriado' : 'Nuevo Feriado'}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#e5e7eb', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Modo selector — solo al crear */}
          {!isEditing && (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              {(['dia', 'semana'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: modo === m ? '2px solid #d4af37' : '1px solid #d1d5db',
                    background: modo === m ? '#fdfbf5' : 'white',
                    color: modo === m ? '#92700c' : '#6b7280',
                    fontWeight: modo === m ? 600 : 400,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {m === 'dia' ? 'Día' : 'Semana'}
                </button>
              ))}
            </div>
          )}

          {/* Fechas */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
              {modo === 'semana' ? 'Desde' : 'Fecha'}
            </label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }} />
          </div>

          {modo === 'semana' && !isEditing && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Hasta</label>
              <input type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }} />
              {form.fecha && form.fechaFin && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {generarFechas(form.fecha, form.fechaFin).length} días se crearán
                </div>
              )}
            </div>
          )}

          {/* Motivo */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Motivo</label>
            <input type="text" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Feriado nacional" required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }} />
          </div>

          {/* Taller */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Taller (opcional)</label>
            <select value={form.taller} onChange={(e) => setForm({ ...form, taller: e.target.value ? Number(e.target.value) : '' })} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}>
              <option value="">Todos los talleres</option>
              {talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          {/* Horario */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Horario (opcional)</label>
            <select value={form.horario} disabled={!form.taller} onChange={(e) => setForm({ ...form, horario: e.target.value ? Number(e.target.value) : '' })} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white', opacity: form.taller ? 1 : 0.5 }}>
              <option value="">{form.taller ? 'Todos los horarios del taller' : 'Primero seleccione un taller'}</option>
              {horarios.map((h) => <option key={h.id} value={h.id}>{h.dia_nombre} {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}</option>)}
            </select>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '10px', background: saving ? '#e5e7eb' : '#d4af37', color: saving ? '#9ca3af' : '#0a0a0a', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
              {saving ? 'Guardando...' : isEditing ? 'Actualizar' : modo === 'semana' ? `Crear ${form.fecha && form.fechaFin ? generarFechas(form.fecha, form.fechaFin).length : ''} feriados` : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(FeriadoFormModal);
