import { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import { getApiBaseUrl } from '../utils/api';

interface Taller {
  id: number;
  ciclo: number;
  nombre: string;
  tipo: string;
  tipo_display: string;
  descripcion: string;
  activo: boolean;
}

interface TallerFormData {
  nombre: string;
  tipo: string;
  descripcion: string;
  activo: boolean;
}

const initialFormData: TallerFormData = {
  nombre: '',
  tipo: 'taller',
  descripcion: '',
  activo: true,
};

function TalleresPage() {
  const navigate = useNavigate();
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const apiBase = getApiBaseUrl();
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<TallerFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');

  const fetchTalleres = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/ciclos/${cicloActual.id}/talleres/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTalleres(data.results || data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => {
    fetchTalleres();
  }, [fetchTalleres]);

  const filteredTalleres = talleres.filter((t) => {
    const matchesSearch = t.nombre.toLowerCase().includes(search.toLowerCase());
    const matchesTipo = !filterTipo || t.tipo === filterTipo;
    return matchesSearch && matchesTipo;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = editingId
        ? `/api/talleres/${editingId}/`
        : `/api/ciclos/${cicloActual.id}/talleres/`;
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
      fetchTalleres();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (taller: Taller) => {
    setEditingId(taller.id);
    setFormData({
      nombre: taller.nombre,
      tipo: taller.tipo || 'taller',
      descripcion: taller.descripcion || '',
      activo: taller.activo,
    });
    setShowModal(true);
  };

  const handleDelete = (id: number, nombre: string) => {
    setDeletingId(id);
    setDeletingName(nombre);
  };

  const confirmDelete = async () => {
    if (!deletingId || !cicloActual) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/ciclos/${cicloActual.id}/talleres/${deletingId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errorData));
      }
      fetchTalleres();
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

  const colores = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Talleres</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{talleres.length} talleres disponibles</p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            background: '#f59e0b',
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
            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
          }}
        >
          <span>+</span> Nuevo Taller
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Buscar talleres..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            maxWidth: '400px',
            padding: '0.625rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          style={{
            padding: '0.625rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '0.875rem',
            outline: 'none',
            background: 'white',
          }}
        >
          <option value="">Todos los tipos</option>
          <option value="instrumento">Instrumento</option>
          <option value="taller">Taller</option>
        </select>
      </div>

      {filteredTalleres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            {search || filterTipo ? 'No se encontraron talleres' : 'No hay talleres registrados'}
          </p>
          {!search && !filterTipo && (
            <button onClick={openCreateModal} style={{ padding: '0.625rem 1.25rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              Crear primer taller
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {filteredTalleres.map((taller, index) => (
            <div
              key={taller.id}
              onClick={() => navigate(`/talleres/${taller.id}`)}
              style={{
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
              }}
            >
              <div style={{ height: '8px', background: taller.tipo === 'instrumento' ? '#8b5cf6' : colores[index % colores.length] }} />
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>{taller.nombre}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: '600',
                      background: taller.tipo === 'instrumento' ? '#ede9fe' : '#fef3c7',
                      color: taller.tipo === 'instrumento' ? '#7c3aed' : '#b45309',
                    }}>
                      {taller.tipo === 'instrumento' ? 'Instrumento' : 'Taller'}
                    </span>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: '600',
                      background: taller.activo ? '#d1fae5' : '#f3f4f6',
                      color: taller.activo ? '#059669' : '#6b7280',
                    }}>
                      {taller.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', lineHeight: '1.5' }}>
                  {taller.descripcion || 'Sin descripción'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/talleres/${taller.id}`); }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#e0e7ff',
                      color: '#4338ca',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Ver Detalle
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(taller); }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#fef3c7',
                      color: '#b45309',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(taller.id, taller.nombre); }}
                    disabled={deletingId === taller.id}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: deletingId === taller.id ? '#f3f4f6' : '#fef2f2',
                      color: deletingId === taller.id ? '#9ca3af' : '#ef4444',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: deletingId === taller.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deletingId === taller.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                {editingId ? 'Editar Taller' : 'Nuevo Taller'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Nombre del Taller</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                    placeholder="Ej: Piano, Guitarra, Dibujo..."
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}
                  >
                    <option value="instrumento">Instrumento</option>
                    <option value="taller">Taller</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    rows={4}
                    placeholder="Describe el contenido del taller..."
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                  />
                  Taller activo
                </label>
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
                    background: saving ? '#fcd34d' : '#f59e0b',
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
        message="¿Estás seguro de eliminar este taller?"
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

export default memo(TalleresPage);
