import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { Pagination } from '../components/ui/Pagination';
import { getAlumnos, createAlumno, updateAlumno, deleteAlumno } from '../api/endpoints';
import type { Alumno } from '../api/endpoints';

interface AlumnoFormData {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string;
  activo: boolean;
}

const initialFormData: AlumnoFormData = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  fecha_nacimiento: '',
  activo: true,
};

function AlumnosPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AlumnoFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchAlumnos = useCallback(async (page: number = 1, search?: string) => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const res = await getAlumnos(cicloActual.id, page, search);
      setAlumnos(res.data.results || res.data);
      setTotalPages(Math.ceil((res.data.count || 0) / 20) || 1);
      setTotalCount(res.data.count || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    fetchAlumnos(1, debouncedSearch);
  }, [fetchAlumnos, debouncedSearch]);

  const handlePageChange = (page: number) => {
    fetchAlumnos(page, debouncedSearch);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) {
      showToast('No hay ciclo seleccionado', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...formData, ciclo: cicloActual.id };
      if (editingId) {
        await updateAlumno(editingId, payload);
      } else {
        await createAlumno(payload);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchAlumnos(currentPage);
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (alumno: Alumno) => {
    setEditingId(alumno.id);
    setFormData({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      dni: alumno.dni,
      telefono: alumno.telefono || '',
      email: alumno.email || '',
      fecha_nacimiento: alumno.fecha_nacimiento || '',
      activo: alumno.activo,
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
    try {
      await deleteAlumno(deletingId);
      fetchAlumnos(currentPage);
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
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Alumnos</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{totalCount} registrados</p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            background: '#6366f1',
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
            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
          }}
        >
          <span>+</span> Nuevo Alumno
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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

        <ResponsiveTable<Alumno>
          columns={[
            {
              key: 'nombre',
              label: 'Nombre',
              render: (alumno) => (
                <div style={{ fontWeight: '600', color: '#111827' }}>{alumno.nombre} {alumno.apellido}</div>
              ),
            },
            { key: 'dni', label: 'DNI' },
            { key: 'telefono', label: 'Teléfono', render: (alumno: Alumno) => alumno.telefono || '-' },
            {
              key: 'edad',
              label: 'Edad',
              align: 'center',
              render: (alumno: Alumno) => alumno.edad !== null ? (
                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', background: '#e0e7ff', color: '#4338ca' }}>
                  {alumno.edad} años
                </span>
              ) : '-',
            },
            { key: 'email', label: 'Email', render: (alumno: Alumno) => alumno.email || '-' },
            {
              key: 'activo',
              label: 'Estado',
              align: 'center',
              render: (alumno: Alumno) => (
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: alumno.activo ? '#d1fae5' : '#f3f4f6', color: alumno.activo ? '#059669' : '#6b7280' }}>
                  {alumno.activo ? 'Activo' : 'Inactivo'}
                </span>
              ),
            },
            {
              key: 'created_at',
              label: 'Registro',
              align: 'center',
              render: (alumno: Alumno) => alumno.created_at ? (() => {
                const d = new Date(alumno.created_at);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
              })() : '-',
            },
          ]}
          data={alumnos}
          keyField="id"
          actions={(alumno) => (
            <>
              <button
                onClick={() => handleEdit(alumno)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(alumno.id, `${alumno.nombre} ${alumno.apellido}`)}
                disabled={deletingId === alumno.id}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: deletingId === alumno.id ? '#9ca3af' : '#ef4444', cursor: deletingId === alumno.id ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                {deletingId === alumno.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </>
          )}
          emptyMessage={debouncedSearch ? 'No se encontraron resultados' : 'No hay alumnos registrados'}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {alumnos.length === 0 && !debouncedSearch && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>+</span> Nuevo Alumno
          </button>
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
                {editingId ? 'Editar Alumno' : 'Nuevo Alumno'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
                    maxLength={15}
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                  />
                  Alumno activo
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
                    background: saving ? '#a5b4fc' : '#6366f1',
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
        message="¿Estás seguro de eliminar este alumno?"
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

export default memo(AlumnosPage);
