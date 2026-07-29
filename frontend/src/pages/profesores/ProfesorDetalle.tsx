import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { getProfesorDetalle, getHistorialPagosProfesor, deleteProfesor, updateProfesor } from '../../api/endpoints';
import { AVATAR } from '../../theme/colors';
import { formatMonto } from '../../utils/formatters';
import type { ProfesorDetalleResponse, Egreso } from '../../api/endpoints';

function ProfesorDetallePage() {
  const { profesorId } = useParams<{ profesorId: string }>();
  const navigate = useNavigate();
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [data, setData] = useState<ProfesorDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [egresosLoading, setEgresosLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ nombre: '', apellido: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', activo: true, es_gerente: false, observaciones: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!cicloActual || !profesorId) return;
    setLoading(true);
    try {
      const response = await getProfesorDetalle(cicloActual.id, Number(profesorId));
      setData(response.data);
    } catch (err) {
      console.error('Error fetching profesor detalle:', err);
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, profesorId, showApiError]);

  const fetchEgresos = useCallback(async () => {
    if (!cicloActual || !profesorId) return;
    setEgresosLoading(true);
    try {
      const hace12Meses = new Date();
      hace12Meses.setMonth(hace12Meses.getMonth() - 12);
      const fechaDesde = hace12Meses.toISOString().split('T')[0];
      const response = await getHistorialPagosProfesor(Number(profesorId), cicloActual.id, fechaDesde);
      setEgresos(response.data);
    } catch (err) {
      console.error('Error fetching egresos del profesor:', err);
      showApiError(err);
    } finally {
      setEgresosLoading(false);
    }
  }, [cicloActual, profesorId, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchEgresos();
  }, [fetchEgresos]);

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
    if (!profesorId) return;
    setDeleting(true);
    try {
      await deleteProfesor(Number(profesorId));
      navigate('/profesores');
    } catch (err) {
      showApiError(err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleEdit = () => {
    setMenuOpen(false);
    if (!data) return;
    setEditData({ nombre: profesor.nombre, apellido: profesor.apellido, dni: profesor.dni, telefono: profesor.telefono || '', email: profesor.email || '', fecha_nacimiento: profesor.fecha_nacimiento || '', activo: profesor.activo, es_gerente: profesor.es_gerente, observaciones: profesor.observaciones || '' });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profesorId || !cicloActual) return;
    setSaving(true);
    try {
      await updateProfesor(Number(profesorId), { ...editData, ciclo: cicloActual.id });
      setShowEditModal(false);
      fetchData();
    } catch (err) { showApiError(err); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', background: 'white', borderRadius: 12, border: '1px solid #d1d5db', textAlign: 'center', color: '#6b7280' }}>
        No se encontró el profesor.
      </div>
    );
  }

  const { profesor } = data;
  const totalHorarios = profesor.horarios.length;
  const totalPagado = egresos.reduce((sum, e) => sum + Number(e.monto), 0);

  // ponytail: reduce barato, no necesita useMemo
  const porTaller = new Map<number, { taller: string; porDia: Map<string, typeof profesor.horarios> }>();
  for (const h of profesor.horarios) {
    if (!porTaller.has(h.taller_id)) {
      porTaller.set(h.taller_id, { taller: h.taller, porDia: new Map() });
    }
    const grupo = porTaller.get(h.taller_id)!;
    if (!grupo.porDia.has(h.dia)) {
      grupo.porDia.set(h.dia, []);
    }
    grupo.porDia.get(h.dia)!.push(h);
  }
  for (const grupo of porTaller.values()) {
    for (const horarios of grupo.porDia.values()) {
      horarios.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    }
  }
  const horariosAgrupados = Array.from(porTaller.entries()).map(([tallerId, grupo]) => ({
    tallerId,
    taller: grupo.taller,
    dias: Array.from(grupo.porDia.entries()).map(([dia, horarios]) => ({ dia, horarios }))
  }));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader title="Detalle del Profesor" cicloNombre={cicloActual?.nombre} />

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #d1d5db', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: AVATAR.bg, color: AVATAR.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
            {profesor.apellido.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{profesor.nombre_completo}</h2>
              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: profesor.activo ? '#d1fae5' : '#e5e7eb', color: profesor.activo ? '#059669' : '#6b7280' }}>
                {profesor.activo ? 'Activo' : 'Inactivo'}
              </span>
              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: profesor.es_gerente ? '#fef9e7' : AVATAR.bg, color: profesor.es_gerente ? '#8b6914' : AVATAR.color }}>
                {profesor.es_gerente ? 'Gerente' : 'Profesor'}
              </span>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>DNI: {profesor.dni || '—'} · {profesor.edad ? `${profesor.edad} años` : 'Edad no registrada'}</p>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: 10, border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Teléfono</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{profesor.telefono || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: 10, border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</div>
            <div style={{ fontWeight: 600, color: '#111827', wordBreak: 'break-all' }}>{profesor.email || '—'}</div>
          </div>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: 10, border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Horarios</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#d4af37' }}>{totalHorarios}</div>
          </div>
          <div style={{ padding: '1rem', background: '#fafbfc', borderRadius: 10, border: '1.5px solid #c8ccd4' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Pagos (12m)</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#059669' }}>{formatMonto(totalPagado)}</div>
          </div>
        </div>

        {profesor.observaciones && (
          <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: 10, marginBottom: '1.5rem', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.75rem', color: '#8b6914', marginBottom: '0.25rem' }}>Observaciones</div>
            <div style={{ color: '#78350f', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{profesor.observaciones}</div>
          </div>
        )}

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Horarios</h3>
        {profesor.horarios.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>No tiene horarios asignados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {horariosAgrupados.map(grupo => (
              <div key={grupo.tallerId} style={{ border: '1px solid #d1d5db', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', background: '#e8eaed', borderBottom: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{grupo.taller}</span>
                  <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: '#e0e7ff', color: '#4338ca' }}>
                    {grupo.dias.reduce((sum, d) => sum + d.horarios.length, 0)} horarios
                  </span>
                </div>
                <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {grupo.dias.map(({ dia, horarios }) => (
                    <div key={dia}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{dia}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {horarios.map(h => (
                          <div key={h.id} style={{ padding: '0.5rem 0.75rem', background: 'white', borderRadius: 8, border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 500, color: '#374151', fontSize: '0.875rem' }}>
                              {h.hora_inicio.slice(0, 5)} – {h.hora_fin.slice(0, 5)}
                            </div>
                            <button
                              onClick={() => navigate(`/talleres/${h.taller_id}`)}
                              style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer' }}
                            >
                              Ver taller
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Pagos (últimos 12 meses)</h3>
        {egresosLoading ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Cargando pagos...</div>
        ) : egresos.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>No hay pagos registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {egresos.map(e => (
              <div key={e.id} style={{ padding: '0.75rem 1rem', background: '#fafbfc', borderRadius: 10, border: '1.5px solid #c8ccd4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                    {e.fecha ? new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-PE') : 'Sin fecha'}
                  </span>
                  <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.875rem' }}>{formatMonto(Number(e.monto))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span>{e.descripcion || e.tipo_display || 'Pago'}</span>
                  <span style={{ padding: '0.1rem 0.45rem', borderRadius: 4, background: e.estado === 'cancelado' ? '#d1fae5' : '#fef3c7', color: e.estado === 'cancelado' ? '#059669' : '#d97706', fontSize: '0.65rem', fontWeight: 600 }}>{e.estado_display}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => navigate('/profesores')}
          style={{ padding: '0.625rem 1.25rem', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Volver
        </button>
      </div>
      <ConfirmModal isOpen={showDeleteModal} title="Eliminar Profesor" message="¿Estás seguro de eliminar este profesor?" itemName={`${profesor.nombre} ${profesor.apellido}`} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} isLoading={deleting} />
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: 0 }}>Editar profesor</h2>
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
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={editData.es_gerente} onChange={e => setEditData({...editData, es_gerente: e.target.checked})} id="es_gerente" />
                <label htmlFor="es_gerente" style={{ fontSize:'0.8125rem',color:'#374151' }}>Es gerente</label>
              </div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#6b7280',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Observaciones</label><textarea value={editData.observaciones} onChange={e => setEditData({...editData, observaciones: e.target.value})} rows={2} style={{ width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem',resize:'vertical' }} /></div>
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

export default memo(ProfesorDetallePage);
