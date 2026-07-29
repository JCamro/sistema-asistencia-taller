import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Badge from '../../components/ui/Badge';
import { getAlumnoDetalle, deleteAlumno, updateAlumno } from '../../api/endpoints';
import api from '../../api/axios';
import { MATRICULA_ESTADOS, AVATAR } from '../../theme/colors';
import type { AlumnoDetalleResponse } from '../../api/endpoints';

function AlumnoDetallePage() {
  const { alumnoId } = useParams<{ alumnoId: string }>();
  const navigate = useNavigate();
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [data, setData] = useState<AlumnoDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ nombre: '', apellido: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [showConcluidas, setShowConcluidas] = useState(false);

  // useMemo debe ir antes de cualquier return condicional (Rules of Hooks)
  const matriculasAgrupadas = useMemo(() => {
    const matriculas = data?.matriculas ?? [];
    const activas = matriculas.filter(m => m.estado !== 'concluida');
    const concluidas = matriculas.filter(m => m.estado === 'concluida');
    const sortByFecha = (a: AlumnoDetalleResponse['matriculas'][0], b: AlumnoDetalleResponse['matriculas'][0]) => {
      if (!a.fecha_matricula) return 1;
      if (!b.fecha_matricula) return -1;
      return new Date(b.fecha_matricula).getTime() - new Date(a.fecha_matricula).getTime();
    };
    activas.sort(sortByFecha);
    const grupos = new Map<number, { taller: string; taller_id: number; items: typeof concluidas }>();
    for (const m of concluidas) {
      if (!grupos.has(m.taller_id)) {
        grupos.set(m.taller_id, { taller: m.taller, taller_id: m.taller_id, items: [] });
      }
      grupos.get(m.taller_id)!.items.push(m);
    }
    for (const g of grupos.values()) g.items.sort(sortByFecha);
    const gruposArray = Array.from(grupos.values()).sort((a, b) => {
      const aD = a.items[0]?.fecha_matricula;
      const bD = b.items[0]?.fecha_matricula;
      if (!aD) return 1;
      if (!bD) return -1;
      return new Date(bD).getTime() - new Date(aD).getTime();
    });
    return { activas, gruposConcluidas: gruposArray, concluidasCount: concluidas.length };
  }, [data]);

  const renderMatriculaCard = (m: AlumnoDetalleResponse['matriculas'][0]) => {
    const estado = MATRICULA_ESTADOS[m.estado] || MATRICULA_ESTADOS.inactiva;
    const progress = Math.min(100, (m.sesiones_consumidas / m.sesiones_contratadas) * 100);
    return (
      <div key={m.id} style={{ padding: '0.875rem 1rem', background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <div>
            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{m.taller}</span>
            {m.fecha_matricula && (
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: '0.5rem' }}>
                {new Date(m.fecha_matricula).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Badge bg={estado.bg} color={estado.color} label={estado.label} description={estado.description} size="sm" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>S/. {m.precio_total}</span>
            <button
              onClick={() => navigate(`/matriculas/${m.id}`)}
              style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer' }}
            >
              Ver
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ flex: 1, height: 5, background: '#d6d9de', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#ef4444' : '#d4af37', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontFamily: 'monospace' }}>{m.sesiones_consumidas}/{m.sesiones_contratadas}</span>
        </div>
      </div>
    );
  };

  const fetchData = useCallback(async () => {
    if (!cicloActual || !alumnoId) return;
    setLoading(true);
    try {
      const response = await getAlumnoDetalle(cicloActual.id, Number(alumnoId));
      setData(response.data);
    } catch (err) {
      console.error('Error fetching alumno detalle:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, alumnoId, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleDelete = async () => {
    if (!alumnoId) return;
    setDeleting(true);
    try {
      await deleteAlumno(Number(alumnoId));
      navigate('/alumnos');
    } catch (err) {
      showApiError(err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleEdit = async () => {
    setMenuOpen(false);
    if (!alumnoId || !cicloActual) return;
    try {
      const res = await api.get(`/ciclos/${cicloActual.id}/alumnos/${alumnoId}/`);
      const a = res.data;
      setEditData({ nombre: a.nombre, apellido: a.apellido, dni: a.dni, telefono: a.telefono || '', email: a.email || '', fecha_nacimiento: a.fecha_nacimiento || '', activo: a.activo });
      setShowEditModal(true);
    } catch (err) { showApiError(err); }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumnoId || !cicloActual) return;
    setSaving(true);
    try {
      await updateAlumno(Number(alumnoId), { ...editData, ciclo: cicloActual.id });
      setShowEditModal(false);
      fetchData();
    } catch (err) { showApiError(err); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', background: 'white', borderRadius: '12px', border: '1px solid #d1d5db', textAlign: 'center', color: '#6b7280' }}>
        No se encontró el alumno.
      </div>
    );
  }

  const { alumno } = data;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader title="Detalle del Alumno" cicloNombre={cicloActual?.nombre} />

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #d1d5db', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: AVATAR.bg, color: AVATAR.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
            {alumno.apellido.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{alumno.nombre_completo}</h2>
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>DNI: {alumno.dni || '—'} · {alumno.edad ? `${alumno.edad} años` : 'Edad no registrada'}</p>
          </div>
          <div style={{ marginLeft: 'auto', position: 'relative' }} ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Acciones" style={{ width: 32, height: 32, borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontSize: '1.125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              ⋯
            </button>
            {menuOpen && (
              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 10, background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 120, padding: '0.35rem 0' }}>
                <button onClick={handleEdit} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>Editar</button>
                <button onClick={() => { setMenuOpen(false); setShowDeleteModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}>Eliminar</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Teléfono</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{alumno.telefono || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{alumno.email || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Fecha de registro</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{alumno.created_at ? new Date(alumno.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: '10px', border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Estado</div>
            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: alumno.activo ? '#d1fae5' : '#e5e7eb', color: alumno.activo ? '#059669' : '#6b7280' }}>
              {alumno.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Matrículas activas</h3>
        {matriculasAgrupadas.activas.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>No hay matrículas activas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {matriculasAgrupadas.activas.map(renderMatriculaCard)}
          </div>
        )}

        {matriculasAgrupadas.concluidasCount > 0 && (
          <div>
            <button
              onClick={() => setShowConcluidas(!showConcluidas)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px',
                background: 'white', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                width: '100%', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '1rem', transition: 'transform 0.2s', transform: showConcluidas ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              {showConcluidas ? 'Ocultar historial' : `Ver historial (${matriculasAgrupadas.concluidasCount} matrículas concluidas)`}
            </button>
            {showConcluidas && (
              <div style={{ marginTop: '0.75rem' }}>
                {matriculasAgrupadas.gruposConcluidas.map(grupo => (
                  <div key={grupo.taller_id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.4rem', paddingLeft: '0.25rem' }}>
                      <div style={{ width: 3, height: 12, borderRadius: 2, background: '#9ca3af', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {grupo.taller}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>({grupo.items.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '1rem' }}>
                      {grupo.items.map(renderMatriculaCard)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      
      <ConfirmModal isOpen={showDeleteModal} title="Eliminar Alumno" message="¿Estás seguro de eliminar este alumno?" itemName={`${alumno.nombre} ${alumno.apellido}`} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} isLoading={deleting} />
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: 0 }}>Editar alumno</h2>
              <button onClick={() => setShowEditModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#e5e7eb', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Nombre</label><input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} required style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' }} /></div>
                <div><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Apellido</label><input value={editData.apellido} onChange={e => setEditData({...editData, apellido: e.target.value})} required style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' }} /></div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>DNI</label><input value={editData.dni} onChange={e => setEditData({...editData, dni: e.target.value})} required maxLength={15} style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Teléfono</label><input value={editData.telefono} onChange={e => setEditData({...editData, telefono: e.target.value})} style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' }} /></div>
                <div><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Email</label><input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' }} /></div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Fecha nac.</label><input type="date" value={editData.fecha_nacimiento} onChange={e => setEditData({...editData, fecha_nacimiento: e.target.value})} style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' }} /></div>
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize:'0.8125rem',color:'#374151' }}>Activo</label>
                <input type="checkbox" checked={editData.activo} onChange={e => setEditData({...editData, activo: e.target.checked})} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.8125rem' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '10px', background: saving ? '#e5e7eb' : '#d4af37', color: saving ? '#9ca3af' : '#0a0a0a', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AlumnoDetallePage);
