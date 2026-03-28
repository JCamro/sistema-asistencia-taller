import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';

interface Profesor {
  id: number;
  ciclo: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string | null;
  edad: number | null;
  activo: boolean;
  es_gerente: boolean;
  observaciones: string;
}

interface ProfesorFormData {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string;
  activo: boolean;
  es_gerente: boolean;
  observaciones: string;
}

const initialFormData: ProfesorFormData = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  fecha_nacimiento: '',
  activo: true,
  es_gerente: false,
  observaciones: '',
};

function ProfesoresPage() {
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProfesorFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');

  const fetchProfesores = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/ciclos/${cicloActual.id}/profesores/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProfesores(data.results || data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => {
    fetchProfesores();
  }, [fetchProfesores]);

  const filteredProfesores = profesores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.apellido.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = editingId
        ? `/api/profesores/${editingId}/`
        : `/api/ciclos/${cicloActual.id}/profesores/`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, ciclo: cicloActual.id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchProfesores();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (profesor: Profesor) => {
    setEditingId(profesor.id);
    setFormData({
      nombre: profesor.nombre,
      apellido: profesor.apellido,
      dni: profesor.dni,
      telefono: profesor.telefono || '',
      email: profesor.email || '',
      fecha_nacimiento: profesor.fecha_nacimiento || '',
      activo: profesor.activo,
      es_gerente: profesor.es_gerente,
      observaciones: profesor.observaciones || '',
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
      await fetch(`/api/profesores/${deletingId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProfesores();
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
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Profesores</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{profesores.length} registrados</p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
          }}
        >
          <span>+</span> Nuevo Profesor
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Nombre</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>DNI</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Teléfono</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Edad</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Email</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Rol</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfesores.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  {search ? 'No se encontraron resultados' : 'No hay profesores registrados'}
                </td>
              </tr>
            ) : (
              filteredProfesores.map((profesor) => (
                <tr key={profesor.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{profesor.nombre} {profesor.apellido}</div>
                  </td>
                  <td style={{ padding: '1rem', color: '#374151', fontFamily: 'monospace' }}>{profesor.dni}</td>
                  <td style={{ padding: '1rem', color: '#374151' }}>{profesor.telefono || '-'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {profesor.edad !== null ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: '#e0e7ff',
                        color: '#4338ca',
                      }}>
                        {profesor.edad} años
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: '#374151' }}>{profesor.email || '-'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: profesor.es_gerente ? '#fef3c7' : '#e0e7ff',
                      color: profesor.es_gerente ? '#b45309' : '#4338ca',
                    }}>
                      {profesor.es_gerente ? 'Gerente' : 'Profesor'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleEdit(profesor)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        marginRight: '1rem',
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(profesor.id, `${profesor.nombre} ${profesor.apellido}`)}
                      disabled={deletingId === profesor.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: deletingId === profesor.id ? '#9ca3af' : '#ef4444',
                        cursor: deletingId === profesor.id ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                      }}
                    >
                      {deletingId === profesor.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                {editingId ? 'Editar Profesor' : 'Nuevo Profesor'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Nombre</label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Apellido</label>
                    <input
                      type="text"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>DNI</label>
                  <input
                    type="text"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    required
                    maxLength={8}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Observaciones</label>
                  <textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                    />
                    Activo
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={formData.es_gerente}
                      onChange={(e) => setFormData({ ...formData, es_gerente: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                    />
                    Es gerente
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: saving ? '#6ee7b7' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
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
        message="¿Estás seguro de eliminar este profesor?"
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

export default memo(ProfesoresPage);
