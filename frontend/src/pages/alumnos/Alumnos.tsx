import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { getAlumnos, createAlumno, updateAlumno, deleteAlumno } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AVATAR } from '../../theme/colors';
import type { Alumno } from '../../api/endpoints';

interface AlumnoFormData { nombre: string; apellido: string; dni: string; telefono: string; email: string; fecha_nacimiento: string; activo: boolean; }
const initialFormData: AlumnoFormData = { nombre: '', apellido: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', activo: true };

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' };

/**
 * AlumnosPage — Gestión de alumnos del ciclo activo
 *
 * CRUD completo con búsqueda por texto (nombre, apellido, DNI), paginación server-side
 * y ordenamiento (más recientes, más antiguos, alfabético).
 *
 * Flujo de datos:
 *   1. useQuery obtiene alumnos paginados del backend (React Query cachea 30s)
 *   2. La búsqueda usa debounce (useDebouncedSearch) para evitar requests excesivos
 *   3. Mutations (create/update/delete) invalidan la caché al completar
 *   4. El modal de creación/edición comparte estado con editingId para modo dual
 */
function AlumnosPage() {
  const { cicloActual } = useCiclo();
  const { showToast, showApiError } = useToast();
  const queryClient = useQueryClient();
  const { searchText, setSearchText, debouncedValue: debouncedSearch } = useDebouncedSearch();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AlumnoFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'alpha'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const getOrderingParam = (o: string) => { switch (o) { case 'oldest': return 'created_at'; case 'alpha': return 'apellido,nombre'; default: return '-created_at'; } };

  const ordering = getOrderingParam(sortOrder);

  const { data: alumnosResponse, isLoading, error } = useQuery({
    queryKey: queryKeys.alumnos(cicloActual?.id ?? 0, currentPage, debouncedSearch, ordering),
    queryFn: async () => {
      if (!cicloActual) return { count: 0, results: [] };
      const response = await getAlumnos(cicloActual.id, currentPage, debouncedSearch, ordering);
      return response.data;
    },
    enabled: !!cicloActual,
    staleTime: 30_000,
  });

  const alumnos = alumnosResponse?.results || [];
  const totalCount = alumnosResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / 20) || 1;

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Alumno>) => {
      if (editingId) return updateAlumno(editingId, payload);
      return createAlumno(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alumnos(cicloActual?.id ?? 0) });
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlumno,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alumnos(cicloActual?.id ?? 0) });
      setDeletingId(null);
      setDeletingName('');
    },
    onError: (err) => showApiError(err),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) { showToast('No hay ciclo seleccionado', 'error'); return; }
    setSaving(true);
    try { await saveMutation.mutateAsync({ ...formData, ciclo: cicloActual.id }); }
    finally { setSaving(false); }
  };
  const handleEdit = (a: Alumno) => { setEditingId(a.id); setFormData({ nombre: a.nombre, apellido: a.apellido, dni: a.dni, telefono: a.telefono || '', email: a.email || '', fecha_nacimiento: a.fecha_nacimiento || '', activo: a.activo }); setShowModal(true); };
  const handleDelete = (id: number, nombre: string) => { setDeletingId(id); setDeletingName(nombre); };
  const confirmDelete = async () => { if (!deletingId) return; setSaving(true); try { await deleteMutation.mutateAsync(deletingId); } finally { setSaving(false); } };
  const cancelDelete = () => { setDeletingId(null); setDeletingName(''); };
  const openCreateModal = () => { setEditingId(null); setFormData(initialFormData); setShowModal(true); };
  const handlePageChange = (p: number) => setCurrentPage(p);

  if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}><div style={{ width: 40, height: 40, border: '3px solid #f1f5f9', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Cargando alumnos...</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  if (error) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}><p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>Error al cargar alumnos.</p><Button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.alumnos(cicloActual?.id ?? 0) })}>Reintentar</Button></div>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <PageHeader title="Alumnos" cicloNombre={cicloActual?.nombre} actionLabel="Nuevo alumno" onAction={openCreateModal} />
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar por nombre, apellido o DNI..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }} />
        </div>
        <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as any); setCurrentPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white', minWidth: 160 }}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="alpha">Orden alfabético</option></select>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <ResponsiveTable<Alumno> columns={[
          { key: 'nombre', label: 'Nombre', render: a => <span style={{ fontWeight: 600, color: 'var(--color-bg-dark)' }}>{a.nombre} {a.apellido}</span> },
          { key: 'dni', label: 'DNI' }, { key: 'telefono', label: 'Teléfono', render: a => a.telefono || <span style={{ color: 'var(--color-text-muted)' }}>—</span> },
          { key: 'edad', label: 'Edad', align: 'center', render: a => a.edad !== null ? <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: AVATAR.bg, color: AVATAR.color }}>{a.edad} años</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span> },
          { key: 'email', label: 'Email', render: a => a.email || <span style={{ color: 'var(--color-text-muted)' }}>—</span> },
          { key: 'activo', label: 'Estado', align: 'center', render: a => <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: a.activo ? '#ecfdf5' : '#f3f4f6', color: a.activo ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{a.activo ? 'Activo' : 'Inactivo'}</span> },
          { key: 'created_at', label: 'Registro', align: 'center', render: a => a.created_at ? (() => { const [y,m,d] = a.created_at.split('T')[0].split('-'); return `${d}/${m}/${y}`; })() : '—' },
        ]} data={alumnos} keyField="id"
        actions={a => (<><button onClick={() => handleEdit(a)} className="touch-target" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, padding: '0.35rem 0.5rem' }}>Editar</button><button onClick={() => handleDelete(a.id, `${a.nombre} ${a.apellido}`)} disabled={deletingId === a.id} className="touch-target" style={{ background: 'none', border: 'none', color: deletingId === a.id ? 'var(--color-text-muted)' : 'var(--color-error)', cursor: deletingId === a.id ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 500, padding: '0.35rem 0.5rem' }}>{deletingId === a.id ? '...' : 'Eliminar'}</button></>)}
        emptyMessage={debouncedSearch ? 'No se encontraron resultados' : 'No hay alumnos registrados'} />
        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} onPageChange={handlePageChange} />}
      </div>
      {showModal && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}><div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}><div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-bg-dark)', margin: 0 }}>{editingId ? 'Editar alumno' : 'Nuevo alumno'}</h2><button onClick={() => setShowModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button></div><form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}><div><label style={labelStyle}>Nombre</label><input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required style={inputStyle} /></div><div><label style={labelStyle}>Apellido</label><input value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} required style={inputStyle} /></div></div><div style={{ marginBottom: '0.75rem' }}><label style={labelStyle}>DNI</label><input value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} required maxLength={15} style={inputStyle} /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}><div><label style={labelStyle}>Teléfono</label><input value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Email</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} /></div></div><div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Fecha de nacimiento</label><input type="date" value={formData.fecha_nacimiento} onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })} style={inputStyle} /></div><label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#475569', cursor: 'pointer', marginBottom: '1.25rem' }}><input type="checkbox" checked={formData.activo} onChange={e => setFormData({ ...formData, activo: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} /> Alumno activo</label><div style={{ display: 'flex', gap: '0.75rem' }}><Button type="button" variant="secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</Button><Button type="submit" isLoading={saving || saveMutation.isPending} style={{ flex: 1 }}>Guardar</Button></div></form></div></div>)}
      <ConfirmModal isOpen={deletingId !== null} title="Confirmar Eliminación" message="¿Estás seguro de eliminar este alumno?" itemName={deletingName} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={confirmDelete} onCancel={cancelDelete} isLoading={saving || deleteMutation.isPending} />
    </div>
  );
}
export default memo(AlumnosPage);
