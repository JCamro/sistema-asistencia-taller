import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { Pagination } from '../components/ui/Pagination';
import { getHistorialPagosProfesor, getProfesores, createProfesor, updateProfesor, deleteProfesor } from '../api/endpoints';
import { formatMonto } from '../utils/formatters';
import { useWindowWidth } from '../hooks/useWindowWidth';

import type { Profesor } from '../api/endpoints';

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
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProfesorFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [historialPagos, setHistorialPagos] = useState<any[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProfesores = useCallback(async (page: number = 1, search?: string) => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const res = await getProfesores(cicloActual.id, page, search);
      setProfesores(res.data.results || res.data);
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
    fetchProfesores(1, debouncedSearch);
  }, [fetchProfesores, debouncedSearch]);

  const handlePageChange = (page: number) => {
    fetchProfesores(page, debouncedSearch);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) return;
    setSaving(true);
    try {
      const payload = { ...formData, ciclo: cicloActual.id };
      if (editingId) {
        await updateProfesor(editingId, payload);
      } else {
        await createProfesor(payload);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchProfesores(currentPage);
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
      es_gerente: profesor.es_gerente ?? false,
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
    try {
      await deleteProfesor(deletingId);
      fetchProfesores(currentPage);
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

  const handleVerHistorial = async (profesorId: number) => {
    setHistorialModalOpen(true);
    setHistorialLoading(true);
    try {
      const res = await getHistorialPagosProfesor(profesorId);
      setHistorialPagos(res.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setHistorialLoading(false);
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
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{totalCount} registrados</p>
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

        <ResponsiveTable<Profesor>
          columns={[
            {
              key: 'nombre',
              label: 'Nombre',
              render: (profesor) => (
                <div style={{ fontWeight: '600', color: '#111827' }}>{profesor.nombre} {profesor.apellido}</div>
              ),
            },
            { key: 'dni', label: 'DNI' },
            { key: 'telefono', label: 'Teléfono', render: (profesor: Profesor) => profesor.telefono || '-' },
            {
              key: 'edad',
              label: 'Edad',
              align: 'center',
              render: (profesor: Profesor) => profesor.edad !== null ? (
                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', background: '#e0e7ff', color: '#4338ca' }}>
                  {profesor.edad} años
                </span>
              ) : '-',
            },
            { key: 'email', label: 'Email', render: (profesor: Profesor) => profesor.email || '-' },
            {
              key: 'es_gerente',
              label: 'Rol',
              align: 'center',
              render: (profesor: Profesor) => (
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: profesor.es_gerente ? '#fef3c7' : '#e0e7ff', color: profesor.es_gerente ? '#b45309' : '#4338ca' }}>
                  {profesor.es_gerente ? 'Gerente' : 'Profesor'}
                </span>
              ),
            },
            {
              key: 'created_at',
              label: 'Registro',
              align: 'center',
              render: (profesor: Profesor) => profesor.created_at ? (() => {
                const d = new Date(profesor.created_at);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
              })() : '-',
            },
          ]}
          data={profesores}
          keyField="id"
          actions={(profesor) => (
            <>
              <button
                onClick={() => handleVerHistorial(profesor.id)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Ver historial
              </button>
              <button
                onClick={() => handleEdit(profesor)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(profesor.id, `${profesor.nombre} ${profesor.apellido}`)}
                disabled={deletingId === profesor.id}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: deletingId === profesor.id ? '#9ca3af' : '#ef4444', cursor: deletingId === profesor.id ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                {deletingId === profesor.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </>
          )}
          emptyMessage={debouncedSearch ? 'No se encontraron resultados' : 'No hay profesores registrados'}
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

      {/* Historial de Pagos Modal */}
      {historialModalOpen && (
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
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                Historial de Pagos
              </h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {historialLoading ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
              ) : historialPagos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No hay pagos registrados</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '500px' : 'auto' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>Fecha</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>Monto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>Descripción</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#6b7280' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPagos.map((pago: any) => (
                      <tr key={pago.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{new Date(pago.fecha).toLocaleDateString('es-PE')}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>{formatMonto(pago.monto)}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>{pago.descripcion || '-'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: pago.estado === 'pendiente' ? '#fef3c7' : '#d1fae5',
                            color: pago.estado === 'pendiente' ? '#b45309' : '#047857',
                          }}>
                            {pago.estado_display}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              <button
                onClick={() => setHistorialModalOpen(false)}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProfesoresPage);
