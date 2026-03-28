import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';

interface Taller {
  id: number;
  nombre: string;
}

interface Profesor {
  id: number;
  nombre: string;
  apellido: string;
}

interface Horario {
  id: number;
  ciclo: number;
  taller: number;
  taller_nombre: string;
  profesor: number;
  profesor_nombre: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
  activo: boolean;
}

interface HorarioFormData {
  taller: number | '';
  profesor: number | '';
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  activo: boolean;
}

const initialFormData: HorarioFormData = {
  taller: '',
  profesor: '',
  dia_semana: '0',
  hora_inicio: '',
  hora_fin: '',
  cupo_maximo: 10,
  activo: true,
};

const DIAS_SEMANA = [
  { value: '0', label: 'Lunes' },
  { value: '1', label: 'Martes' },
  { value: '2', label: 'Miércoles' },
  { value: '3', label: 'Jueves' },
  { value: '4', label: 'Viernes' },
  { value: '5', label: 'Sábado' },
  { value: '6', label: 'Domingo' },
];

function HorariosPage() {
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<HorarioFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [horariosRes, talleresRes, profesoresRes] = await Promise.all([
        fetch(`/api/ciclos/${cicloActual.id}/horarios/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/ciclos/${cicloActual.id}/talleres/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/ciclos/${cicloActual.id}/profesores/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [horariosData, talleresData, profesoresData] = await Promise.all([
        horariosRes.json(),
        talleresRes.json(),
        profesoresRes.json(),
      ]);
      setHorarios(horariosData.results || horariosData);
      setTalleres(talleresData.results || talleresData);
      setProfesores(profesoresData.results || profesoresData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupedHorarios = DIAS_SEMANA.map((dia) => ({
    ...dia,
    horarios: horarios.filter((h) => h.dia_semana === parseInt(dia.value)),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual || !formData.taller || !formData.profesor) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = editingId
        ? `/api/horarios/${editingId}/`
        : `/api/ciclos/${cicloActual.id}/horarios/`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          ciclo: cicloActual.id,
          dia_semana: parseInt(formData.dia_semana),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchData();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (horario: Horario) => {
    setEditingId(horario.id);
    setFormData({
      taller: horario.taller,
      profesor: horario.profesor,
      dia_semana: horario.dia_semana.toString(),
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin,
      cupo_maximo: horario.cupo_maximo,
      activo: horario.activo,
    });
    setShowModal(true);
  };

  const handleDelete = (id: number, nombre: string) => {
    setDeletingId(id);
    setDeletingName(nombre);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`/api/horarios/${deletingId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setDeletingId(null);
      setDeletingName('');
      setSaving(false);
    }
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeletingName('');
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #ec4899', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Horarios</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{horarios.length} horarios programados</p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={talleres.length === 0 || profesores.length === 0}
          style={{
            background: talleres.length === 0 || profesores.length === 0 ? '#e5e7eb' : '#ec4899',
            color: 'white',
            border: 'none',
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: talleres.length === 0 || profesores.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(236, 72, 153, 0.3)',
          }}
        >
          <span>+</span> Nuevo Horario
        </button>
      </div>

      {talleres.length === 0 && (
        <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', marginBottom: '1.5rem', color: '#b45309', fontSize: '0.875rem' }}>
          ⚠️ Primero debes crear talleres y profesores para poder programar horarios.
        </div>
      )}

      {horarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No hay horarios registrados</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {groupedHorarios.map((dia) => (
            <div key={dia.value} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', textTransform: 'uppercase' }}>{dia.label}</h3>
              </div>
              {dia.horarios.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Sin clases</div>
              ) : (
                <div style={{ padding: '0.5rem' }}>
                  {dia.horarios.map((horario) => (
                    <div key={horario.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: '600', color: '#ec4899', minWidth: '100px' }}>
                          {horario.hora_inicio} - {horario.hora_fin}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#111827' }}>{horario.taller_nombre}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{horario.profesor_nombre}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {horario.cupo_disponible}/{horario.cupo_maximo} cupos
                        </span>
                        <button
                          onClick={() => handleEdit(horario)}
                          style={{ background: 'none', border: 'none', color: '#ec4899', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(horario.id, horario.taller_nombre)}
                          disabled={deletingId === horario.id}
                          style={{ background: 'none', border: 'none', color: deletingId === horario.id ? '#9ca3af' : '#ef4444', cursor: deletingId === horario.id ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '500' }}
                        >
                          {deletingId === horario.id ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{editingId ? 'Editar Horario' : 'Nuevo Horario'}</h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Taller</label>
                  <select
                    value={formData.taller}
                    onChange={(e) => setFormData({ ...formData, taller: e.target.value ? parseInt(e.target.value) : '' })}
                    required
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  >
                    <option value="">Seleccionar taller</option>
                    {talleres.map((t) => (<option key={t.id} value={t.id}>{t.nombre}</option>))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Profesor</label>
                  <select
                    value={formData.profesor}
                    onChange={(e) => setFormData({ ...formData, profesor: e.target.value ? parseInt(e.target.value) : '' })}
                    required
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  >
                    <option value="">Seleccionar profesor</option>
                    {profesores.map((p) => (<option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Día</label>
                  <select
                    value={formData.dia_semana}
                    onChange={(e) => setFormData({ ...formData, dia_semana: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  >
                    {DIAS_SEMANA.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Hora inicio</label>
                    <input
                      type="time"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Hora fin</label>
                    <input
                      type="time"
                      value={formData.hora_fin}
                      onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Cupo máximo</label>
                  <input
                    type="number"
                    value={formData.cupo_maximo}
                    onChange={(e) => setFormData({ ...formData, cupo_maximo: parseInt(e.target.value) || 10 })}
                    min={1}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#ec4899' }}
                  />
                  Horario activo
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.75rem', background: saving ? '#f9a8d4' : '#ec4899', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deletingId !== null}
        title="Confirmar Eliminación"
        message="¿Estás seguro de eliminar este horario?"
        itemName={deletingName}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={saving}
      />
    </div>
  );
}

export default memo(HorariosPage);
