import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import { getDashboardKpis, getDashboardIngresos } from '../../api/endpoints';
import type { DashboardIngresos } from '../../api/endpoints';
import CalculadoraPrecios from '../precios/CalculadoraPrecios';

interface KpiData { alumnos_sin_asistencia_hoy: number; matriculas_por_concluir: number; matriculas_sin_recibo: number; matriculas_sin_pago_completo: number; }

const IconAlert = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconClock = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconFile = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>;
const IconDollar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;

/**
 * Dashboard — Panel de KPIs del ciclo activo
 *
 * Muestra indicadores clave: alumnos sin asistencia hoy, matrículas por concluir,
 * matrículas sin recibo, y pagos incompletos. Cada KPI es clickeable y navega
 * a la sección correspondiente.
 *
 * Sección de ingresos:
 *   - Toggle día/semana: alterna entre ingresos de hoy y de la semana
 *   - Botón mostrar/ocultar: oculta el monto real con viñetas por privacidad
 *   - Las barras decorativas son estáticas (no representan datos reales)
 *
 * También incluye la calculadora de precios empotrada y accesos rápidos
 * a las operaciones más frecuentes (matrícula, recibo, asistencia).
 */
export default function Dashboard() {
  const { cicloActual } = useCiclo(); const navigate = useNavigate(); const { showToast } = useToast();
  const [kpis, setKpis] = useState<KpiData|null>(null); const [ingresos, setIngresos] = useState<DashboardIngresos|null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const [showSemana, setShowSemana] = useState(false); const [showMonto, setShowMonto] = useState(false);

  const load = useCallback(async () => { if(!cicloActual)return; setLoading(true);setError(false); try { const[k,i]=await Promise.all([getDashboardKpis(cicloActual.id),getDashboardIngresos(cicloActual.id)]); setKpis(k.data);setIngresos(i.data); } catch{setError(true);showToast('Error al cargar dashboard','error')} finally{setLoading(false)} }, [cicloActual, showToast]);
  useEffect(()=>{if(cicloActual)load()},[cicloActual, load]);

  if(!cicloActual) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'0.75rem'}}><div style={{width:56,height:56,borderRadius:'50%',background:'#fef9e7',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><p style={{color:'#64748b',fontSize:'0.9375rem'}}>Seleccioná un ciclo para ver el dashboard</p></div>;
  if(loading) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'1rem'}}><div style={{width:44,height:44,border:'3px solid #e2e8f0',borderTop:'3px solid #d4af37',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><p style={{color:'#94a3b8',fontSize:'0.875rem'}}>Cargando...</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  if(error) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'0.75rem'}}><p style={{color:'#dc2626',fontSize:'0.9375rem'}}>Error al cargar</p><button onClick={load} style={{padding:'0.5rem 1.25rem',background:'#d4af37',color:'#0a0a0a',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer',fontSize:'0.875rem'}}>Reintentar</button></div>;

  // Ingresos: toggle entre hoy y semana. showMonto controla si se muestra el valor o viñetas.
  const ia = showSemana?ingresos?.ingresos_semana??0:ingresos?.ingresos_hoy??0;
  const pa = showSemana?ingresos?.cantidad_pagos_semana??0:ingresos?.cantidad_pagos_hoy??0;

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    <div style={{marginBottom:'2rem'}}><div style={{display:'flex',alignItems:'baseline',gap:'0.75rem'}}><h1 style={{fontSize:'1.625rem',fontWeight:700,color:'#0f172a',margin:0,letterSpacing:'-0.02em'}}>Dashboard</h1><span style={{fontSize:'0.75rem',fontWeight:500,color:'#b59410',background:'#fef9e7',padding:'0.2rem 0.65rem',borderRadius:'9999px'}}>{cicloActual.nombre}</span></div><div style={{height:3,width:48,background:'linear-gradient(90deg,#d4af37,#f0d878)',borderRadius:2,marginTop:'0.5rem'}}/></div>
    <div style={{background:'linear-gradient(135deg,#fef9e7,#fdf3d0,#fef9e7)',borderRadius:'18px',padding:'1.75rem 2rem',marginBottom:'1.75rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'1rem',border:'1px solid rgba(212,175,55,0.25)'}}>
      <div><div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.375rem'}}><span style={{fontSize:'0.6875rem',fontWeight:600,color:'#8b6914',textTransform:'uppercase',letterSpacing:'0.08em'}}>Ingresos {showSemana?'de la semana':'de hoy'}</span><button onClick={()=>setShowSemana(v=>!v)} style={{padding:'0.15rem 0.5rem',borderRadius:'9999px',border:'1px solid rgba(180,150,20,0.3)',background:'transparent',color:'#8b6914',cursor:'pointer',fontSize:'0.65rem',fontWeight:500}}>{showSemana?'Ver hoy':'Ver semana'}</button></div>
      <div style={{fontSize:'2.75rem',fontWeight:800,color:'#5c4508',letterSpacing:showMonto?'-0.02em':'0.12em',lineHeight:1.1,transition:'letter-spacing 0.2s'}}>{showMonto?`S/. ${ia.toFixed(2)}`:'••••••'}</div>
      <div style={{fontSize:'0.8125rem',color:'#8b6914',marginTop:'0.25rem'}}>{showMonto?`${pa} pago${pa!==1?'s':''} ${showSemana?'esta semana':'hoy'}`:`${pa} pago${pa!==1?'s':''}`}</div></div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'0.75rem'}}><button onClick={()=>setShowMonto(v=>!v)} title={showMonto?'Ocultar':'Mostrar'} className="touch-target" style={{padding:'0.35rem 0.65rem',border:'1px solid rgba(180,150,20,0.3)',borderRadius:'8px',background:'white',cursor:'pointer',fontSize:'0.75rem',color:'#8b6914',display:'flex',alignItems:'center',gap:'0.35rem',minHeight:'36px'}}><span style={{fontSize:'1rem',lineHeight:1}}>{showMonto?'👁':'👁‍🗨'}</span>{showMonto?'Ocultar':'Mostrar'}</button><div style={{display:'flex',alignItems:'flex-end',gap:'4px',height:'48px'}}>{[0.4,0.2,0.7,0.3,0.9,0.5,0.6].map((h,i)=><div key={i} style={{width:8,borderRadius:4,height:`${h*48}px`,background:i===4?'#d4af37':'rgba(180,150,20,0.2)'}}/>)}</div></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0.875rem',marginBottom:'1.75rem'}}>
      <KpiBox label="Sin asistencia hoy" value={kpis?.alumnos_sin_asistencia_hoy??0} icon={<IconAlert/>} color="#f59e0b" bg="#fffbeb" onClick={()=>navigate('/asistencias')} urgency={kpis&&kpis.alumnos_sin_asistencia_hoy>0?'Revisar':undefined}/>
      <KpiBox label="Por concluir" value={kpis?.matriculas_por_concluir??0} icon={<IconClock/>} color="#dc2626" bg="#fef2f2" onClick={()=>navigate('/matriculas')} urgency={kpis&&kpis.matriculas_por_concluir>0?'Urgente':undefined}/>
      <KpiBox label="Sin recibo" value={kpis?.matriculas_sin_recibo??0} icon={<IconFile/>} color="#2563eb" bg="#eff6ff" onClick={()=>navigate('/recibos')}/>
      <KpiBox label="Pago incompleto" value={kpis?.matriculas_sin_pago_completo??0} icon={<IconDollar/>} color="#059669" bg="#ecfdf5" onClick={()=>navigate('/recibos')}/>
    </div>
    <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1.75rem'}}>
      {[{label:'Nueva matrícula',path:'/matriculas'},{label:'Nuevo recibo',path:'/recibos'},{label:'Registrar asistencia',path:'/asistencias'}].map(a=>(<button key={a.label} onClick={()=>navigate(a.path)} style={{padding:'0.5rem 1rem',borderRadius:'10px',border:'1px solid #e5e7eb',background:'white',color:'#374151',cursor:'pointer',fontSize:'0.8125rem',fontWeight:500,display:'flex',alignItems:'center',gap:'0.375rem',transition:'all 0.15s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='#d4af37';e.currentTarget.style.color='#0f172a'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#374151'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>{a.label}</button>))}
    </div>
    <div style={{background:'white',borderRadius:'14px',padding:'1.5rem',border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,0.03)'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}><h2 style={{fontSize:'1rem',fontWeight:600,color:'#0f172a',margin:0}}>Calculadora de Precios</h2><button onClick={()=>navigate('/configuracion-precios')} style={{width:34,height:34,borderRadius:8,border:'1px solid #e5e7eb',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#d4af37'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg></button></div><CalculadoraPrecios/></div>
  </div>);
}

function KpiBox({label,value,icon,color,bg,onClick,urgency}:{label:string;value:number;icon:React.ReactNode;color:string;bg:string;onClick?:()=>void;urgency?:string}) {
  return <div onClick={onClick} className="touch-target" style={{background:bg,borderRadius:'14px',padding:'1.25rem 1.25rem 1rem',cursor:onClick?'pointer':'default',border:`1px solid ${color}18`,minHeight:'44px',transition:'box-shadow 0.2s,transform 0.15s',position:'relative',overflow:'hidden'}} onMouseEnter={e=>{if(!onClick)return;e.currentTarget.style.boxShadow=`0 4px 16px ${color}18`;e.currentTarget.style.transform='translateY(-2px)'}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.5rem'}}><span style={{fontSize:'0.6875rem',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',lineHeight:1.3,maxWidth:'140px'}}>{label}</span><div style={{width:38,height:38,borderRadius:10,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>{icon}</div></div><div style={{display:'flex',alignItems:'baseline',gap:'0.5rem'}}><span style={{fontSize:'2rem',fontWeight:800,color,letterSpacing:'-0.02em',lineHeight:1}}>{value}</span>{urgency&&<span style={{fontSize:'0.6rem',fontWeight:600,color,background:`${color}18`,padding:'0.15rem 0.45rem',borderRadius:'9999px',textTransform:'uppercase',letterSpacing:'0.04em'}}>{urgency}</span>}</div></div>;
}
