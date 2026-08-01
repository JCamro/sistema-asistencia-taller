import { useState, useEffect, useCallback } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import { getPrecios, createPrecio, updatePrecio, deletePrecio, getConfig, updateConfig, type PrecioPaquete } from '../../api/endpoints';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import ConfirmModal from '../../components/ui/ConfirmModal';

const formatClases = (n:number):string => n===1?'1 clase':`${n} clases`;
const TPL: Record<string,string> = {individual:'Individual',combo_musical:'Combo Musical',mixto:'Mixto',intensivo:'Intensivo'};
type FormMode = 'create'|'edit'|null;

const labelStyle: React.CSSProperties = { display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#94a3b8',marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.04em' };
const inputStyle: React.CSSProperties = { width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem',background:'white' };

/**
 * ConfiguracionPrecios — Administración de precios y paquetes promocionales
 *
 * Permite gestionar:
 * - Precios individuales por tipo (instrumento / taller) y cantidad de clases
 * - Paquetes promocionales (Combo Musical, Mixto, Intensivo)
 * - Configuración de pago a profesores (base y tope dinámicos)
 *
 * La configuración de pagos a profesores afecta el cálculo en HorasProfesores.
 * Los precios aquí definidos alimentan la CalculadoraPrecios y el motor de
 * precios del backend (matrículas y recibos).
 */
export default function ConfiguracionPrecios() {
  const { cicloActual } = useCiclo(); const toast = useToast(); const ww = useWindowWidth(); const mb = ww < 768;
  const [precios, setPrecios] = useState<PrecioPaquete[]>([]); const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null); const [editando, setEditando] = useState<PrecioPaquete|null>(null);
  const [pagoBase, setPagoBase] = useState('17.00'); const [pagoTope, setPagoTope] = useState('35.00'); const [porcentajeAdicional, setPorcentajeAdicional] = useState(50); const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [tipoTaller, setTipoTaller] = useState<'instrumento'|'taller'>('instrumento'); const [tipoPaquete, setTipoPaquete] = useState('individual');
  const [cantidadClases, setCantidadClases] = useState(12); const [cantidadClasesSecundaria, setCantidadClasesSecundaria] = useState<number|null>(null);
  const [precioTotal, setPrecioTotal] = useState(''); const [guardando, setGuardando] = useState(false);
  const [closing, setClosing] = useState(false);
  const [precioError, setPrecioError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrecioPaquete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const cargarPrecios = useCallback(async()=>{if(!cicloActual)return;setLoading(true);try{setPrecios((await getPrecios(cicloActual.id)).data)}catch{toast.showToast('Error al cargar precios','error')}finally{setLoading(false)}},[cicloActual,toast]);
  const cargarConfig = useCallback(async()=>{if(!cicloActual)return;try{const response=await getConfig(cicloActual.id);const b=response.data.pago_dinamico_base;const t=response.data.pago_dinamico_tope;const p=response.data.porcentaje_adicional;setPagoBase(b!=null?Number(b).toFixed(2):'17.00');setPagoTope(t!=null?Number(t).toFixed(2):'35.00');setPorcentajeAdicional(p!=null?Math.round(Number(p)*100):50)}catch{setPagoBase('17.00');setPagoTope('35.00');setPorcentajeAdicional(50)}},[cicloActual]);
  const guardarConfigPagos = async()=>{if(!cicloActual)return;setGuardandoConfig(true);try{await updateConfig({pago_dinamico_base:parseFloat(pagoBase),pago_dinamico_tope:parseFloat(pagoTope),porcentaje_adicional:parseFloat(porcentajeAdicional.toString())/100},cicloActual.id);toast.showToast('Configuración actualizada','success')}catch{toast.showToast('Error','error')}finally{setGuardandoConfig(false)}};
  useEffect(()=>{cargarPrecios();cargarConfig()},[cargarPrecios,cargarConfig]);

  const abrirCrear = ()=>{setEditando(null);setTipoTaller('instrumento');setTipoPaquete('individual');setCantidadClases(12);setCantidadClasesSecundaria(null);setPrecioTotal('');setServerError(null);setFormMode('create')};
  const abrirEditar = (p:PrecioPaquete)=>{setEditando(p);setTipoTaller(p.tipo_taller);setTipoPaquete(p.tipo_paquete);setCantidadClases(p.cantidad_clases);setCantidadClasesSecundaria(p.cantidad_clases_secundaria);setPrecioTotal(Number(p.precio_total).toString());setServerError(null);setFormMode('edit')};
  const cancelar = ()=>{
    setClosing(true);
    setTimeout(()=>{setFormMode(null);setEditando(null);setClosing(false);setPrecioError(false);setServerError(null)},250);
  };
  const calcSesion = ():string=>{const t=parseFloat(precioTotal)||0;const tc=cantidadClases+(cantidadClasesSecundaria||0);return tc>0?(t/tc).toFixed(2):'0.00'};
  const guardar = async()=>{
    if(!precioTotal||parseFloat(precioTotal)<=0){setPrecioError(true);return}
    setPrecioError(false);
    if(!cicloActual)return;
    setGuardando(true);
    try{const d={ciclo:cicloActual.id,tipo_taller:tipoTaller,tipo_paquete:tipoPaquete,cantidad_clases:cantidadClases,cantidad_clases_secundaria:cantidadClasesSecundaria,precio_total:parseFloat(precioTotal),precio_por_sesion:parseFloat(calcSesion()),activo:true};if(formMode==='edit'&&editando){await updatePrecio(editando.id,d);toast.showToast('Precio actualizado','success')}else{await createPrecio(d);toast.showToast('Precio creado','success')}setFormMode(null);setEditando(null);await cargarPrecios()}catch(e:unknown){const err=e as{response?:{data?:{detail?:string}}};toast.showToast(err.response?.data?.detail||'Error al guardar','error');setServerError(err.response?.data?.detail||'Error al guardar')}finally{setGuardando(false)}
  };
  const eliminar = async(precioPaquete:PrecioPaquete)=>{setDeleteTarget(precioPaquete)};
  const confirmarEliminar = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePrecio(deleteTarget.id);
      toast.showToast('Precio eliminado', 'success');
      setDeleteTarget(null);
      await cargarPrecios();
    } catch {
      toast.showToast('Error al eliminar', 'error');
    } finally {
      setDeleting(false);
    }
  };
  useEffect(()=>{
    if(!formMode)return;
    document.body.style.overflow='hidden';
    const panel=document.querySelector('[data-drawer-panel="precio"]');
    const backdrop=document.querySelector('[data-drawer-backdrop="precio"]');
    const open=()=>{panel?.classList.add('drawer-panel-open');backdrop?.classList.add('drawer-backdrop-open');};
    if(!closing){requestAnimationFrame(open);}else{panel?.classList.add('drawer-panel-closing');backdrop?.classList.add('drawer-backdrop-closing');}
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')cancelar()};
    document.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow='';document.removeEventListener('keydown',onKey);};
  },[formMode,closing]);

  if(!cicloActual)return <div style={{textAlign:'center',padding:'3rem',color:'#94a3b8'}}>Seleccioná un ciclo</div>;
  if(loading)return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div style={{width:36,height:36,border:'3px solid #e2e8f0',borderTop:'3px solid #d4af37',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>;

  const esNuevo = new URLSearchParams(window.location.search).get('nuevo') === '1';

  // Agrupar precios por tipo: individuales (instrumento/taller) y promocionales
  const pi = precios.filter(p=>p.tipo_paquete==='individual'); const pp = precios.filter(p=>p.tipo_paquete!=='individual');
  const ii = pi.filter(p=>p.tipo_taller==='instrumento').sort((a,b)=>a.cantidad_clases-b.cantidad_clases);
  const it = pi.filter(p=>p.tipo_taller==='taller').sort((a,b)=>a.cantidad_clases-b.cantidad_clases);
  const pcm = pp.filter(p=>p.tipo_paquete==='combo_musical').sort((a,b)=>a.cantidad_clases-b.cantidad_clases);
  const pmx = pp.filter(p=>p.tipo_paquete==='mixto').sort((a,b)=>a.cantidad_clases-b.cantidad_clases);
  const pin = pp.filter(p=>p.tipo_paquete==='intensivo').sort((a,b)=>a.cantidad_clases-b.cantidad_clases);

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.75rem',flexWrap:'wrap',gap:'0.75rem'}}>
      <div><div style={{display:'flex',alignItems:'baseline',gap:'0.75rem'}}><h1 style={{fontSize:'1.625rem',fontWeight:700,color:'#0f172a',margin:0,letterSpacing:'-0.02em'}}>Precios</h1><span style={{fontSize:'0.75rem',fontWeight:500,color:'#b59410',background:'#fef9e7',padding:'0.2rem 0.65rem',borderRadius:'9999px'}}>{cicloActual.nombre}</span></div><div style={{height:3,width:48,background:'linear-gradient(90deg,#d4af37,#f0d878)',borderRadius:2,marginTop:'0.5rem'}}/></div>
      <button onClick={abrirCrear} style={{padding:'0.625rem 1.25rem',borderRadius:'10px',border:'none',cursor:'pointer',background:'linear-gradient(135deg,#d4af37,#c59b2e)',color:'#0a0a0a',fontWeight:600,fontSize:'0.875rem',display:'flex',alignItems:'center',gap:'0.375rem',boxShadow:'0 2px 8px rgba(212,175,55,0.25)'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo precio</button>
    </div>
    {esNuevo && (
      <div style={{ background: 'linear-gradient(135deg, #fef9e7, #fef3c7)', borderRadius: '12px', border: '1px solid #f0d878', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b59410" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#8b6914' }}>Configurá los precios base para este ciclo antes de continuar</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#b59410' }}>Como mínimo necesitás un precio individual de 1 clase para Instrumento y otro para Taller.</p>
        </div>
      </div>
    )}
    {formMode && (
      <>
        <div
          data-drawer-backdrop="precio"
          className="drawer-backdrop"
          onClick={cancelar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 60,
          }}
        />
        <div
          data-drawer-panel="precio"
          className="drawer-panel"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxWidth: '420px',
            background: '#fff',
            zIndex: 61,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>{formMode === 'edit' ? 'Editar precio' : 'Nuevo precio'}</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#b59410', background: '#fef9e7', padding: '0.2rem 0.65rem', borderRadius: '9999px', marginTop: '0.25rem', display: 'inline-block' }}>{cicloActual.nombre}</span>
            </div>
            <button onClick={cancelar} className="touch-target" aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#e5e7eb', color: '#6b7280', cursor: 'pointer', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Tipo taller</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { setTipoTaller('instrumento'); setServerError(null); }} className="touch-target" style={{ flex: 1, padding: '0.5rem 0.75rem', minHeight: 44, borderRadius: 8, border: tipoTaller === 'instrumento' ? '2px solid #d4af37' : '1.5px solid #e5e7eb', background: tipoTaller === 'instrumento' ? '#fef9e7' : '#fff', color: tipoTaller === 'instrumento' ? '#8b6914' : '#64748b', fontWeight: tipoTaller === 'instrumento' ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 200ms ease' }}>Instrumento</button>
                <button onClick={() => { setTipoTaller('taller'); setServerError(null); }} className="touch-target" style={{ flex: 1, padding: '0.5rem 0.75rem', minHeight: 44, borderRadius: 8, border: tipoTaller === 'taller' ? '2px solid #d4af37' : '1.5px solid #e5e7eb', background: tipoTaller === 'taller' ? '#fef9e7' : '#fff', color: tipoTaller === 'taller' ? '#8b6914' : '#64748b', fontWeight: tipoTaller === 'taller' ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 200ms ease' }}>Taller</button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Tipo paquete</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(['individual', 'combo_musical', 'mixto', 'intensivo'] as const).map((p) => (
                  <button key={p} onClick={() => { setTipoPaquete(p); setServerError(null); if (p === 'combo_musical' || p === 'mixto') setCantidadClasesSecundaria(cantidadClasesSecundaria ?? 8); else setCantidadClasesSecundaria(null); }} className="touch-target" style={{ flex: 1, minWidth: 100, padding: '0.5rem 0.75rem', minHeight: 44, borderRadius: 8, border: tipoPaquete === p ? '2px solid #d4af37' : '1.5px solid #e5e7eb', background: tipoPaquete === p ? '#fef9e7' : '#fff', color: tipoPaquete === p ? '#8b6914' : '#64748b', fontWeight: tipoPaquete === p ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 200ms ease' }}>{TPL[p]}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Clases</label>
              <input type="number" min="1" value={cantidadClases} onChange={(e) => { setCantidadClases(Math.max(1, parseInt(e.target.value) || 1)); setServerError(null); }} style={{ ...inputStyle, marginBottom: '0.5rem' }} />
            </div>

            {(tipoPaquete === 'combo_musical' || tipoPaquete === 'mixto') && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Clases secundaria</label>
                <input type="number" min="1" value={cantidadClasesSecundaria ?? ''} onChange={(e) => { setCantidadClasesSecundaria(e.target.value ? Math.max(1, parseInt(e.target.value)) : null); setServerError(null); }} placeholder="Ej: 8" style={{ ...inputStyle, marginBottom: '0.5rem' }} />
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Precio total</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={precioTotal} onChange={(e) => { setPrecioTotal(e.target.value); setPrecioError(false); setServerError(null); }} style={{ ...inputStyle, fontSize: '1.125rem', fontWeight: 600, border: precioError ? '2px solid #ef4444' : '1.5px solid #e5e7eb', background: precioError ? '#fef2f2' : '#fff' }} />
              {precioError && <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', display: 'block' }}>Requerido</span>}
            </div>

            <div style={{ background: 'linear-gradient(135deg, #fef9e7, #fef3c7)', border: '1px solid #f0d878', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b59410" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="12" y2="14" />
              </svg>
              <span style={{ fontSize: '0.6875rem', color: '#8b6914', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Precio por sesión</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem', color: '#0f172a', marginLeft: 'auto' }}>S/. {calcSesion()}</span>
            </div>
            {serverError && (
              <div style={{ marginTop: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: '0.8125rem', color: '#991b1b' }}>{serverError}</span>
              </div>
            )}
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={cancelar} disabled={guardando} className="touch-target" style={{ padding: '0.625rem 1.5rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 500, fontSize: '0.875rem', cursor: guardando ? 'not-allowed' : 'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="touch-target" style={{ padding: '0.625rem 1.5rem', borderRadius: '10px', border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? '#e5e7eb' : 'linear-gradient(135deg, #d4af37, #c59b2e)', color: guardando ? '#9ca3af' : '#0f172a' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>

          <style>{`
            @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            @keyframes drawerSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
            @keyframes drawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes drawerFadeOut { from { opacity: 1; } to { opacity: 0; } }
            .drawer-panel-open { animation: drawerSlideIn 250ms ease-out forwards; }
            .drawer-panel-closing { animation: drawerSlideOut 250ms ease-out forwards; }
            .drawer-backdrop-open { animation: drawerFadeIn 250ms ease-out forwards; }
            .drawer-backdrop-closing { animation: drawerFadeOut 250ms ease-out forwards; }
            @media (prefers-reduced-motion: reduce) { .drawer-panel, .drawer-backdrop { animation: none !important; } }
          `}</style>
        </div>
      </>
    )}
<ConfirmModal
          isOpen={deleteTarget !== null}
          title="Eliminar precio"
          message="Esta acción no se puede deshacer."
          itemName={deleteTarget ? `${TPL[deleteTarget.tipo_paquete]} - ${deleteTarget.tipo_taller} - ${formatClases(deleteTarget.cantidad_clases)}` : ''}
          variant="destructive"
          onConfirm={confirmarEliminar}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleting}
        />
    <div style={{marginBottom:'2rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1rem'}}><div style={{width:6,height:20,borderRadius:3,background:'#d4af37'}}/><h2 style={{fontSize:'1rem',fontWeight:600,color:'#0f172a',margin:0}}>Precios Individuales</h2><span style={{ fontSize: '0.6875rem', color: '#94a3b8', background: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: 9999, fontWeight: 500 }}>{ii.length + it.length}</span></div><div style={{display:'grid',gridTemplateColumns:mb?'1fr':'1fr 1fr',gap:'0.875rem'}}><TablaP titulo="Instrumentos" color="#8b6914" precios={ii} onEdit={abrirEditar} onDel={eliminar}/><TablaP titulo="Talleres" color="#d97706" precios={it} onEdit={abrirEditar} onDel={eliminar}/></div></div>
    <div style={{marginBottom:'2rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1rem'}}><div style={{width:6,height:20,borderRadius:3,background:'#f59e0b'}}/><h2 style={{fontSize:'1rem',fontWeight:600,color:'#0f172a',margin:0}}>Paquetes Promocionales</h2><span style={{ fontSize: '0.6875rem', color: '#94a3b8', background: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: 9999, fontWeight: 500 }}>{pp.length}</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:'0.875rem'}}>{pcm.length>0&&<TablaPr titulo="Combo Musical" sub="2+ Instrumentos" color="#8b6914" precios={pcm} onEdit={abrirEditar} onDel={eliminar}/>}{pmx.length>0&&<TablaPr titulo="Mixto" sub="Instrumento + Taller" color="#d97706" precios={pmx} onEdit={abrirEditar} onDel={eliminar}/>}{pin.length>0&&<TablaPr titulo="Intensivo" sub="20 clases" color="#dc2626" precios={pin} onEdit={abrirEditar} onDel={eliminar}/>}{pp.length===0&&<div style={{gridColumn:'1/-1',padding:'2rem',textAlign:'center',color:'#94a3b8',background:'#fafbfc',borderRadius:'12px',border:'1px dashed #e5e7eb'}}>No hay paquetes promocionales</div>}</div></div>
    <div style={{background:'#fafbfc',borderRadius:'14px',border:'1.5px solid #c8ccd4',padding:'1.25rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1rem'}}><div style={{width:6,height:20,borderRadius:3,background:'#059669'}}/><h2 style={{fontSize:'1rem',fontWeight:600,color:'#0f172a',margin:0}}>Pago a Profesores</h2></div><p style={{color:'#64748b',fontSize:'0.8125rem',marginBottom:'1rem',lineHeight:1.5}}>El profesor recibe base fija + el porcentaje configurado del valor de sesión de cada alumno adicional, hasta el tope máximo.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'0.75rem'}}><div><label style={labelStyle}>Base (S/.)</label><input type="number" step="0.01" min="0" value={pagoBase} onChange={e=>setPagoBase(e.target.value)} style={inputStyle}/><span style={{fontSize:'0.65rem',color:'#94a3b8',marginTop:'0.25rem',display:'block'}}>1 alumno (default: 17)</span></div><div><label style={labelStyle}>Tope (S/.)</label><input type="number" step="0.01" min="0" value={pagoTope} onChange={e=>setPagoTope(e.target.value)} style={inputStyle}/><span style={{fontSize:'0.65rem',color:'#94a3b8',marginTop:'0.25rem',display:'block'}}>Máximo por clase (default: 35)</span></div><div><label style={labelStyle}>Porcentaje adicional (%)</label><input type="number" step="1" min="0" max="100" value={porcentajeAdicional} onChange={e=>setPorcentajeAdicional(parseInt(e.target.value)||0)} style={inputStyle}/><span style={{fontSize:'0.65rem',color:'#94a3b8',marginTop:'0.25rem',display:'block'}}>Por alumno adicional (default: 50%)</span></div><div style={{display:'flex',alignItems:'flex-end'}}><button onClick={guardarConfigPagos} disabled={guardandoConfig} style={{padding:'0.5rem 1.5rem',borderRadius:'10px',border:'none',fontWeight:600,fontSize:'0.875rem',cursor:guardandoConfig?'not-allowed':'pointer',background:guardandoConfig?'#e5e7eb':'#059669',color:'white'}}>{guardandoConfig?'Guardando...':'Guardar'}</button></div></div><div style={{marginTop:'1rem',padding:'0.75rem',background:'white',borderRadius:'10px',border:'1px solid #e5e7eb',fontSize:'0.75rem',color:'#64748b',lineHeight:1.6}}><strong style={{color:'#0f172a'}}>Ejemplo:</strong> base S/. {pagoBase}, tope S/. {pagoTope}<br/>1 alumno → S/. {pagoBase} · 2 alumnos → S/. {pagoBase}+S/.10=S/.{(Number(pagoBase)+10).toFixed(2)} · 3+ → hasta S/. {pagoTope}</div></div>
  </div>);
}

function TablaP({ titulo, color, precios, onEdit, onDel }: { titulo: string; color: string; precios: PrecioPaquete[]; onEdit: (p: PrecioPaquete) => void; onDel: (p: PrecioPaquete) => void }) {
  const [menuId, setMenuId] = useState<number | null>(null);
  useEffect(() => {
    if (menuId === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) setMenuId(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuId]);
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #c8ccd4', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{titulo}</span>
      </div>
      {precios.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#94a3b8' }}>Sin precios configurados</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Clases</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Sesión</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {precios.map((p, i) => (
              <tr
                key={p.id}
                style={{ borderBottom: '1px solid #f0f2f5', background: i % 2 === 0 ? 'white' : '#fafbfc' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef9e7'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafbfc'; }}
              >
                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: '#475569' }}>{formatClases(p.cantidad_clases)}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>S/. {Number(p.precio_total).toFixed(2)}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>S/. {Number(p.precio_por_sesion).toFixed(2)}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                    className="touch-target"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.125rem', color: '#94a3b8', width: 44, height: 44,
                      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  >
                    ⋯
                  </button>
                  {menuId === p.id && (
                    <div
                      data-menu
                      style={{
                        position: 'absolute', right: 0, top: '100%',
                        background: 'white', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        border: '1px solid #e5e7eb',
                        zIndex: 10, minWidth: 120, overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => { onEdit(p); setMenuId(null); }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', textAlign: 'left' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => { onDel(p); setMenuId(null); }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#dc2626', textAlign: 'left' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TablaPr({ titulo, sub, color, precios, onEdit, onDel }: { titulo: string; sub: string; color: string; precios: PrecioPaquete[]; onEdit: (p: PrecioPaquete) => void; onDel: (p: PrecioPaquete) => void }) {
  const [menuId, setMenuId] = useState<number | null>(null);
  useEffect(() => {
    if (menuId === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) setMenuId(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuId]);
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #c8ccd4', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{titulo}</span>
        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{sub}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Combinación</th>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Precio</th>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {precios.map((p, i) => (
            <tr
              key={p.id}
              style={{ borderBottom: '1px solid #f0f2f5', background: i % 2 === 0 ? 'white' : '#fafbfc' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef9e7'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafbfc'; }}
            >
              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: '#475569' }}>
                {p.cantidad_clases_secundaria ? `${p.cantidad_clases}+${p.cantidad_clases_secundaria} clases` : formatClases(p.cantidad_clases)}
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: 6 }}>({p.tipo_taller})</span>
              </td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>S/. {Number(p.precio_total).toFixed(2)}</td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', position: 'relative' }}>
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                    className="touch-target"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.125rem', color: '#94a3b8', width: 44, height: 44,
                      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  >
                    ⋯
                  </button>
                  {menuId === p.id && (
                    <div
                      data-menu
                      style={{
                        position: 'absolute', right: 0, top: '100%',
                        background: 'white', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        border: '1px solid #e5e7eb',
                        zIndex: 10, minWidth: 120, overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => { onEdit(p); setMenuId(null); }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', textAlign: 'left' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => { onDel(p); setMenuId(null); }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#dc2626', textAlign: 'left' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
