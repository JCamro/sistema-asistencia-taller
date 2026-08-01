import { useState, useEffect, useCallback, useRef } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import Badge from '../../components/ui/Badge';
import { getEgresos, createEgreso, updateEgreso, deleteEgreso, getResumenEgresos, getProfesores } from '../../api/endpoints';
import { EGRESO_ESTADOS } from '../../theme/colors';
import { formatMonto } from '../../utils/formatters';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import EgresoDetalle from './EgresoDetalle';

const labelStyle: React.CSSProperties = { display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#94a3b8',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' };
const inputStyle: React.CSSProperties = { width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' };
const ddItem: React.CSSProperties = { display:'block',width:'100%',padding:'0.625rem 1rem',border:'none',background:'none',fontSize:'0.8125rem',cursor:'pointer',textAlign:'left',color:'#374151' };

/**
 * EgresosPage — Gestión de egresos (gastos) del ciclo activo
 *
 * CRUD de egresos con:
 *   - Resumen visual: tarjetas de gasto taller, gasto personal y total
 *   - Filtros por tipo (gasto_taller / gasto_personal) y estado (pendiente / cancelado)
 *   - Tabla responsive con paginación server-side
 *   - Modal de creación/edición con formulario completo (tipo, monto, descripción,
 *     fecha, método de pago, categoría, beneficiario, profesor asociado)
 *
 * Flujo de datos: fetch directo con Promise.all (egresos + resumen + profesores),
 * sin React Query. Las mutaciones recargan los datos manualmente.
 */
const EgresosPage = () => {
  const { cicloActual } = useCiclo(); const toast = useToast(); const ww = useWindowWidth(); const mb = ww < 768;
  const [egresos, setEgresos] = useState<any[]>([]); const [profesores, setProfesores] = useState<any[]>([]);
  const [resumen, setResumen] = useState({ gasto_taller:0, pago_profesor:0, gasto_personal:0, total:0 });
  const [loading, setLoading] = useState(true); const [page, setPage] = useState(1); const [tp, setTp] = useState(1); const [tc, setTc] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState(''); const [filtroEstado, setFiltroEstado] = useState(''); const [filtroProfesor, setFiltroProfesor] = useState('');
  const [modalOpen, setModalOpen] = useState(false); const [egresoEditando, setEgresoEditando] = useState<any>(null);
  const [formTipo, setFormTipo] = useState('gasto_taller'); const [formMonto, setFormMonto] = useState('');
  const [formDesc, setFormDesc] = useState(''); const formToday = new Date().toISOString().split('T')[0];
  const [formFecha, setFormFecha] = useState(formToday); const [formMetodo, setFormMetodo] = useState('efectivo');
  const [formCat, setFormCat] = useState(''); const [formBenef, setFormBenef] = useState('');
  const [formProf, setFormProf] = useState<number|null>(null); const [formEst, setFormEst] = useState('pendiente');
  const [guardando, setGuardando] = useState(false);
  const [detalleEgreso, setDetalleEgreso] = useState<any>(null);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    if(!cicloActual)return; setLoading(true);
    try {
      const [er, rr, pr] = await Promise.all([getEgresos(cicloActual.id,`page=${page}`), getResumenEgresos(cicloActual.id), getProfesores(cicloActual.id)]);
      const ed = er.data as any; setEgresos(ed.results||ed||[]); setTc(ed.count||0); setTp(Math.ceil((ed.count||0)/20)||1);
      setResumen(rr.data); const pd = pr.data as any; setProfesores(pd.results||pd||[]);
    } catch { toast.showToast('Error al cargar','error') } finally { setLoading(false) }
  }, [cicloActual, page, toast]);

  useEffect(() => { if(cicloActual)loadData() }, [loadData]);

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuAbierto(null);
    };
    if (menuAbierto !== null) { document.addEventListener('click', handler); return () => document.removeEventListener('click', handler); }
  }, [menuAbierto]);

  const gastoPersonalTotal = resumen.gasto_personal + resumen.pago_profesor;

  const filteredEgresos = egresos.filter(e => {
    if(filtroTipo){
      if(filtroTipo==='gasto_personal'){ if(e.tipo!=='gasto_personal'&&e.tipo!=='pago_profesor')return false }
      else if(e.tipo!==filtroTipo) return false;
    }
    if(filtroEstado && e.estado!==filtroEstado) return false;
    if(filtroProfesor) {
      const profesorId = e.profesor?.id || e.profesor;
      if(profesorId !== Number(filtroProfesor)) return false;
    }
    return true;
  });

  const tipoBadge = (t: string) => { const ip = t==='gasto_personal'||t==='pago_profesor'; return <Badge bg={ip?'#fef2f2':'#fffbeb'} color={ip?'#dc2626':'#d97706'} label={ip?'Profesor':'Taller'} size="sm" /> };

  const resetForm = () => { setFormTipo('gasto_taller'); setFormMonto(''); setFormDesc(''); setFormFecha(formToday); setFormMetodo('efectivo'); setFormCat(''); setFormBenef(''); setFormProf(null); setFormEst('pendiente') };
  const abrirEditar = (e: any) => { setEgresoEditando(e); const tn = e.tipo==='pago_profesor'?'gasto_personal':e.tipo; setFormTipo(tn); setFormMonto(String(e.monto)); setFormDesc(e.descripcion||''); setFormFecha(e.fecha); setFormMetodo(e.metodo_pago); setFormCat(e.categoria||''); setFormBenef(e.beneficiario||''); setFormProf(e.profesor); setFormEst(e.estado); setModalOpen(true) };

  const guardar = async (e: React.FormEvent) => { e.preventDefault(); if(!cicloActual)return; setGuardando(true);
    try { const d: any = { tipo:formTipo, monto:parseFloat(formMonto), descripcion:formDesc, fecha:formFecha, metodo_pago:formMetodo, categoria:formTipo==='gasto_taller'?formCat:'', beneficiario:formBenef, estado:formEst };
      if(formTipo==='gasto_personal'){ if(formProf)d.profesor=formProf; else d.profesor=null }
      if(egresoEditando){ await updateEgreso(egresoEditando.id,d); toast.showToast('Actualizado','success') } else { await createEgreso(d,cicloActual.id); toast.showToast('Creado','success') }
      setModalOpen(false); setEgresoEditando(null); resetForm(); setPage(1);
    } catch(err:any){ toast.showToast(err.response?.data?.detail||'Error','error') } finally { setGuardando(false) }
  };

  const eliminar = async (id: number) => { if(!window.confirm('¿Eliminar?'))return; try { await deleteEgreso(id); toast.showToast('Eliminado','success'); loadData() } catch { toast.showToast('Error','error') } };

  if(!cicloActual) return null;

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    {/* Header */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.75rem',flexWrap:'wrap',gap:'0.75rem'}}>
      <div><div style={{display:'flex',alignItems:'baseline',gap:'0.75rem'}}><h1 style={{fontSize:'1.625rem',fontWeight:700,color:'#0f172a',margin:0,letterSpacing:'-0.02em'}}>Egresos</h1><span style={{fontSize:'0.75rem',fontWeight:500,color:'#b59410',background:'#fef9e7',padding:'0.2rem 0.65rem',borderRadius:'9999px'}}>{cicloActual.nombre}</span></div><div style={{height:3,width:48,background:'linear-gradient(90deg,#d4af37,#f0d878)',borderRadius:2,marginTop:'0.5rem'}}/></div>
      <button onClick={()=>{resetForm();setEgresoEditando(null);setModalOpen(true)}} style={{padding:'0.625rem 1.25rem',borderRadius:'10px',border:'none',cursor:'pointer',background:'linear-gradient(135deg,#d4af37,#c59b2e)',color:'#0a0a0a',fontWeight:600,fontSize:'0.875rem',display:'flex',alignItems:'center',gap:'0.375rem',boxShadow:'0 2px 8px rgba(212,175,55,0.25)'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Egreso</button>
    </div>

    {/* Resumen Cards */}
    <div style={{display:'grid',gridTemplateColumns:mb?'repeat(2,1fr)':'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
      <div style={{background:'#fffbeb',padding:'1.125rem',borderRadius:'12px',border:'1.5px solid #d9770633'}}><p style={{color:'#d97706',fontSize:'0.65rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.25rem'}}>Gasto Taller</p><p style={{fontSize:'1.5rem',fontWeight:700,color:'#d97706'}}>{formatMonto(resumen.gasto_taller)}</p></div>
      <div style={{background:'#fef2f2',padding:'1.125rem',borderRadius:'12px',border:'1.5px solid #dc262633'}}><p style={{color:'#dc2626',fontSize:'0.65rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.25rem'}}>Gasto Personal</p><p style={{fontSize:'1.5rem',fontWeight:700,color:'#dc2626'}}>{formatMonto(gastoPersonalTotal)}</p></div>
      <div style={{background:'#fafbfc',padding:'1.125rem',borderRadius:'12px',border:'1.5px solid #e2e8f0'}}><p style={{color:'#374151',fontSize:'0.65rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.25rem'}}>Total</p><p style={{fontSize:'1.5rem',fontWeight:700,color:'#111827'}}>{formatMonto(resumen.total)}</p></div>
    </div>

    {/* Filters */}
    <div style={{background:'white',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'0.75rem 1rem',marginBottom:'0.75rem',display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'center'}}>
      <select value={filtroTipo} onChange={e=>{setFiltroTipo(e.target.value);setFiltroProfesor('')}} style={{padding:'0.5rem 0.75rem',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'0.8125rem',background:'white',color:'#374151',minWidth:150,cursor:'pointer'}}><option value="">Todos los tipos</option><option value="gasto_taller">Gasto Taller</option><option value="gasto_personal">Gasto Personal</option></select>
      <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={{padding:'0.5rem 0.75rem',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'0.8125rem',background:'white',color:'#374151',minWidth:150,cursor:'pointer'}}><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="cancelado">Cancelado</option></select>
      {(filtroTipo === '' || filtroTipo === 'gasto_personal') && (
        <select value={filtroProfesor} onChange={e=>setFiltroProfesor(e.target.value)} style={{padding:'0.5rem 0.75rem',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'0.8125rem',background:'white',color:'#374151',minWidth:150,cursor:'pointer'}}>
          <option value="">Todos los profesores</option>
          {profesores.map(p=><option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
        </select>
      )}
    </div>

    {/* Table */}
    <div style={{background:'white',borderRadius:'12px',border:'1px solid #e2e8f0',overflowX:'auto'}}>
      <ResponsiveTable<any> columns={[
        {key:'tipo',label:'Tipo',render:(e:any)=>tipoBadge(e.tipo)},
        {key:'monto',label:'Monto',align:'right',render:(e:any)=><span style={{fontWeight:600,color:'#dc2626',fontVariantNumeric:'tabular-nums'}}>{formatMonto(e.monto)}</span>},
        {key:'descripcion',label:'Descripción',render:(e:any)=><span title={e.descripcion||''} style={{color:'#64748b',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{e.descripcion||'—'}</span>},
        {key:'beneficiario',label:'Beneficiario',render:(e:any)=>e.beneficiario||e.profesor_nombre||'—'},
        {key:'fecha',label:'Fecha',render:(e:any)=><span style={{color:'#64748b',fontSize:'0.8125rem'}}>{new Date(e.fecha).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})}</span>},
        {key:'estado',label:'Estado',align:'center',render:(e:any)=>{const es=EGRESO_ESTADOS[e.estado]||EGRESO_ESTADOS.pendiente;return <Badge bg={es.bg} color={es.color} label={es.label} description={es.description} size="sm" />}},
      ]} data={loading?[]:filteredEgresos} keyField="id"
      actions={(e: any) => (
        <div ref={menuAbierto === e.id ? menuRef : null} style={{ position: 'relative' }}>
          <button
            onClick={(ev) => { ev.stopPropagation(); setMenuAbierto(menuAbierto === e.id ? null : e.id); }}
            className="touch-target"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: menuAbierto === e.id ? '1.5px solid #d4af37' : '1.5px solid #c8ccd4',
              borderRadius: 8, background: menuAbierto === e.id ? '#f9fafb' : 'white',
              cursor: 'pointer', fontSize: '1rem', color: '#374151', padding: 0,
            }}
          >
            ⋯
          </button>
          {menuAbierto === e.id && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: 'white', borderRadius: 10,
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              border: '1px solid #e5e7eb', zIndex: 10, minWidth: 130,
            }}>
              <button onClick={() => { setDetalleEgreso(e); setMenuAbierto(null); }} style={ddItem}>Ver</button>
              <button onClick={() => { abrirEditar(e); setMenuAbierto(null); }} style={{ ...ddItem, color: '#d4af37' }}>Editar</button>
              <button onClick={() => { eliminar(e.id); setMenuAbierto(null); }} style={{ ...ddItem, color: '#ef4444' }}>Eliminar</button>
            </div>
          )}
        </div>
      )}
      emptyMessage={loading?'Cargando...':'No hay egresos'}/>
      {tp>1&&<div style={{borderTop:'1px solid #e5e7eb'}}><Pagination currentPage={page} totalPages={tp} totalCount={tc} onPageChange={p=>setPage(p)}/></div>}
    </div>

    {/* Modal */}
    {modalOpen&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}><div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'480px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}><div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#0f172a',margin:0}}>{egresoEditando?'Editar Egreso':'Nuevo Egreso'}</h2><button onClick={()=>{setModalOpen(false);setEgresoEditando(null)}} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#e5e7eb',color:'#6b7280',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div><form onSubmit={guardar} style={{padding:'1.5rem'}}>
      <div style={{marginBottom:'0.75rem'}}><label style={labelStyle}>Tipo</label><select value={formTipo} onChange={e=>setFormTipo(e.target.value)} required style={inputStyle}><option value="gasto_taller">Gasto del Taller</option><option value="gasto_personal">Gasto de Personal</option></select></div>
      <div style={{marginBottom:'0.75rem'}}><label style={labelStyle}>Monto</label><input type="number" step="0.01" value={formMonto} onChange={e=>setFormMonto(e.target.value)} required style={inputStyle}/></div>
      <div style={{marginBottom:'0.75rem'}}><label style={labelStyle}>Descripción</label><input value={formDesc} onChange={e=>setFormDesc(e.target.value)} style={inputStyle}/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}><div><label style={labelStyle}>Fecha</label><input type="date" value={formFecha} onChange={e=>setFormFecha(e.target.value)} required style={inputStyle}/></div><div><label style={labelStyle}>Método de Pago</label><select value={formMetodo} onChange={e=>setFormMetodo(e.target.value)} required style={inputStyle}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="yape">Yape</option><option value="plin">Plin</option></select></div></div>
      {formTipo==='gasto_taller'&&<div style={{marginBottom:'0.75rem'}}><label style={labelStyle}>Categoría</label><input value={formCat} onChange={e=>setFormCat(e.target.value)} placeholder="Ej: materiales, equipos" style={inputStyle}/></div>}
      {formTipo==='gasto_personal'&&<div style={{marginBottom:'0.75rem'}}><label style={labelStyle}>Profesor</label><select value={formProf??''} onChange={e=>setFormProf(e.target.value?Number(e.target.value):null)} style={inputStyle}><option value="">Sin profesor asociado</option>{profesores.map(p=><option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}</select></div>}
      {formTipo==='gasto_taller'&&<div style={{marginBottom:'0.75rem'}}><label style={labelStyle}>Beneficiario</label><input value={formBenef} onChange={e=>setFormBenef(e.target.value)} style={inputStyle}/></div>}
      <div style={{marginBottom:'1rem'}}><label style={labelStyle}>Estado</label><select value={formEst} onChange={e=>setFormEst(e.target.value)} required style={inputStyle}><option value="pendiente">Pendiente</option><option value="cancelado">Cancelado</option></select></div>
      <div style={{display:'flex',gap:'0.75rem'}}><button type="button" onClick={()=>{setModalOpen(false);setEgresoEditando(null)}} style={{flex:1,padding:'0.625rem',border:'1px solid #e5e7eb',borderRadius:'10px',background:'white',color:'#374151',fontWeight:500,cursor:'pointer',fontSize:'0.875rem'}}>Cancelar</button><button type="submit" disabled={guardando} style={{flex:1,padding:'0.625rem',border:'none',borderRadius:'10px',background:guardando?'#e5e7eb':'#d4af37',color:guardando?'#9ca3af':'#0a0a0a',fontWeight:600,cursor:guardando?'not-allowed':'pointer',fontSize:'0.875rem'}}>{guardando?'Guardando...':'Guardar'}</button></div>
    </form></div></div>)}

    {detalleEgreso && <EgresoDetalle egreso={detalleEgreso} onClose={() => setDetalleEgreso(null)} />}
  </div>);
};
export default EgresosPage;
