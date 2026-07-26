import { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import { getApiBaseUrl } from '../../utils/api';
import { useWindowWidth } from '../../hooks/useWindowWidth';

interface Taller { id: number; nombre: string; tipo: string; }
interface Alumno { id: number; nombre: string; apellido: string; edad: number | null; }
interface Horario {
  id: number; taller: number; taller_nombre: string; profesor: number; profesor_nombre: string;
  dia_semana: number; dia_nombre: string; hora_inicio: string; hora_fin: string;
  cupo_maximo: number; cupo_disponible: number; activo: boolean; alumnos: Alumno[]; ocupacion: number;
}

const DIAS = [
  { value: 0, label: 'Lunes', abrev: 'LUN' }, { value: 1, label: 'Martes', abrev: 'MAR' },
  { value: 2, label: 'Miércoles', abrev: 'MIÉ' }, { value: 3, label: 'Jueves', abrev: 'JUE' },
  { value: 4, label: 'Viernes', abrev: 'VIE' }, { value: 5, label: 'Sábado', abrev: 'SÁB' }, { value: 6, label: 'Domingo', abrev: 'DOM' },
];
const HORAS = Array.from({ length: 14 }, (_, i) => i + 8);
const formatHora = (h: number) => `${h.toString().padStart(2, '0')}:00`;
const normalizarHora = (h: string) => h?.substring(0, 5) || '00:00';
const horaAIndice = (h: string) => HORAS.indexOf(parseInt(h.split(':')[0], 10));
const sc: React.CSSProperties = { fontSize:'0.65rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.04em' };
const sv: React.CSSProperties = { fontSize:'0.8125rem',fontWeight:600,color:'#0f172a' };
const btnSm: React.CSSProperties = { flex:1,padding:'0.35rem 0.5rem',border:'1px solid #e5e7eb',borderRadius:'8px',background:'white',color:'#374151',fontSize:'0.7rem',fontWeight:500,cursor:'pointer' };

function Tooltip({ horario, children }: { horario: Horario; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false); const [pos, setPos] = useState({ x: 0, y: 0 }); const ref = useRef<HTMLDivElement>(null);
  const show = useCallback(() => { if (!ref.current || !horario.alumnos?.length) return; const r = ref.current.getBoundingClientRect(); setPos({ x: r.left + r.width / 2, y: r.top }); setVisible(true); }, [horario.alumnos]);
  return (<><div ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)} style={{ height:'100%' }}>{children}</div>
    {visible && <div style={{ position:'fixed',left:pos.x,top:pos.y-8,transform:'translate(-50%,-100%)',zIndex:100,background:'#0f172a',color:'white',borderRadius:'10px',padding:'0.625rem 0.75rem',fontSize:'0.75rem',boxShadow:'0 8px 24px rgba(0,0,0,0.25)',maxWidth:260,maxHeight:280,overflowY:'auto',pointerEvents:'none' }}>
      <div style={{ fontSize:'0.65rem',fontWeight:700,color:'#d4af37',marginBottom:'0.375rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>Alumnos ({horario.alumnos.length})</div>
      {horario.alumnos.map(a => <div key={a.id} style={{ padding:'0.2rem 0',borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{a.apellido}, {a.nombre} {a.edad!==null?`(${a.edad} años)`:''}</div>)}
    </div>}</>);
}

function CeldaCalendario({ horario, estaLleno, isSelected, onClick }: { horario: Horario; estaLleno: boolean; isSelected: boolean; onClick: () => void }) {
  const bg = estaLleno?'linear-gradient(135deg,#fef2f2,#fee2e2)':'linear-gradient(135deg,#f0fdf4,#dcfce7)';
  const border = estaLleno?'#fecaca':'#bbf7d0'; const tc = estaLleno?'#991b1b':'#166534'; const sc2 = estaLleno?'#b91c1c':'#15803d';
  return (<Tooltip horario={horario}><div onClick={onClick} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onClick()}} style={{ height:'100%',borderRadius:8,padding:'0.35rem 0.45rem',background:bg,border:`1.5px solid ${isSelected?'#d4af37':border}`,cursor:'pointer',display:'flex',flexDirection:'column',justifyContent:'center',transition:'border-color 0.15s',boxShadow:isSelected?'0 0 0 2px rgba(212,175,55,0.25)':'none' }}>
    <div style={{ fontSize:'0.65rem',fontWeight:600,color:tc,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{horario.profesor_nombre}</div>
    <div style={{ fontSize:'0.6rem',color:sc2,marginTop:2 }}>{normalizarHora(horario.hora_inicio)} – {normalizarHora(horario.hora_fin)}</div>
    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:5,paddingTop:3,borderTop:`1px solid ${border}` }}>
      <span style={{ fontSize:'0.6rem',fontWeight:700,color:estaLleno?'#dc2626':'#059669' }}>{horario.ocupacion??0}/{horario.cupo_maximo}</span>
      {estaLleno&&<span style={{ fontSize:'0.5rem',fontWeight:700,background:'#dc2626',color:'white',padding:'1px 4px',borderRadius:3 }}>LLENO</span>}
    </div></div></Tooltip>);
}

function PanelLateral({ horario, estaLleno, onClose, onActualizar }: { horario: Horario; estaLleno: boolean; onClose: () => void; onActualizar: (c:number,o:number)=>void }) {
  const apiBase = getApiBaseUrl(); const diaLabel = DIAS.find(d=>d.value===horario.dia_semana)?.label??''; const { showToast } = useToast();
  const [editando, setEditando] = useState(false); const [cupoValor, setCupoValor] = useState(horario.cupo_maximo.toString()); const [g, setG] = useState(false);
  const guardar = async () => { const cupoInt=parseInt(cupoValor); const ocupacion=horario.ocupacion??0; if(cupoInt<ocupacion){showToast(`No se puede reducir por debajo de ${ocupacion} alumno(s)`,'warning');return} setG(true);
    try { const response=await fetch(`${apiBase}/api/horarios/${horario.id}/`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('access_token')}`},body:JSON.stringify({cupo_maximo:cupoInt})}); if(!response.ok)throw new Error(JSON.stringify(await response.json())); showToast('Cupo actualizado','success');setEditando(false);onActualizar(cupoInt,ocupacion); } catch{showToast('Error','error')} finally{setG(false)} };
  return (<div style={{ background:'white',borderRadius:'14px',border:'1px solid #f1f5f9',padding:'1.25rem',position:'sticky',top:'1rem' }}>
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem' }}><span style={{ fontSize:'0.875rem',fontWeight:600,color:'#0f172a' }}>Detalle de clase</span><button onClick={onClose} style={{ width:28,height:28,borderRadius:'50%',border:'none',background:'#f3f4f6',color:'#6b7280',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button></div>
    <div style={{ display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'1rem' }}>
      <div style={{ background:'#f8fafc',borderRadius:'10px',padding:'0.75rem',border:'1px solid #f1f5f9' }}><span style={sc}>Día y hora</span><span style={{ ...sv,display:'block',marginTop:1 }}>{diaLabel} · {normalizarHora(horario.hora_inicio)} – {normalizarHora(horario.hora_fin)}</span></div>
      <div style={{ background:'#f8fafc',borderRadius:'10px',padding:'0.75rem',border:'1px solid #f1f5f9' }}><span style={sc}>Profesor</span><span style={{ ...sv,display:'block',marginTop:1 }}>{horario.profesor_nombre}</span></div>
      <div style={{ background:estaLleno?'#fef2f2':'#f0fdf4',borderRadius:'10px',padding:'0.75rem',border:estaLleno?'1px solid #fecaca':'1px solid #bbf7d0' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}><span style={{ ...sc,color:estaLleno?'#b91c1c':'#15803d' }}>Cupo</span>{!editando&&<button onClick={()=>setEditando(true)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.65rem',color:'#d4af37',fontWeight:500 }}>Editar</button>}</div>
        {editando?<div style={{ marginTop:'0.5rem' }}><input type="number" value={cupoValor} onChange={e=>setCupoValor(e.target.value)} min={horario.ocupacion??1} style={{ width:'100%',padding:'0.5rem',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'0.8125rem',marginBottom:'0.25rem' }}/><div style={{ fontSize:'0.65rem',color:'#94a3b8',marginBottom:'0.5rem' }}>Mín: {horario.ocupacion??0} alumnos</div><div style={{ display:'flex',gap:'0.375rem' }}><button onClick={()=>setEditando(false)} style={btnSm}>Cancelar</button><button onClick={guardar} disabled={g||!cupoValor||parseInt(cupoValor)<(horario.ocupacion??0)} style={{ ...btnSm,background:g?'#e5e7eb':'#d4af37',color:g?'#9ca3af':'#0a0a0a' }}>{g?'...':'Guardar'}</button></div></div>:<div style={{ display:'flex',alignItems:'baseline',gap:'0.25rem',marginTop:2 }}><span style={{ fontSize:'1.25rem',fontWeight:800,color:estaLleno?'#dc2626':'#059669' }}>{horario.ocupacion??0}</span><span style={{ fontSize:'0.8125rem',color:'#94a3b8' }}>/ {horario.cupo_maximo}</span>{estaLleno&&<span style={{ marginLeft:'auto',fontSize:'0.6rem',fontWeight:700,background:'#dc2626',color:'white',padding:'0.125rem 0.45rem',borderRadius:4 }}>LLENO</span>}</div>}
      </div>
    </div>
    <div><span style={{ fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.04em',display:'block',marginBottom:'0.5rem' }}>Alumnos ({horario.alumnos.length})</span>
      {horario.alumnos.length>0?<div style={{ maxHeight:280,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:'10px' }}>{horario.alumnos.map((a,i)=>                  <div key={a.id} style={{ padding:'0.4rem 0.65rem',fontSize:'0.8125rem',color:'#475569',borderBottom:i<horario.alumnos.length-1?'1px solid #f8fafc':'none',display:'flex',alignItems:'center',gap:'0.5rem' }}><span style={{ width:20,height:20,borderRadius:'50%',background:'#fef9e7',color:'#8b6914',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,flexShrink:0 }}>{i+1}</span><span style={{ fontWeight:500 }}>{a.apellido}, {a.nombre}</span></div>)}</div>:<div style={{ padding:'1.5rem',textAlign:'center',background:'#f8fafc',borderRadius:'10px',color:'#cbd5e1',fontSize:'0.8125rem' }}>Sin alumnos</div>}
    </div>
  </div>);
}

/**
 * HorariosPage — Calendario semanal de clases (vista grid)
 *
 * Muestra una grilla de horarios donde:
 *   - Filas = horas del día (8:00 a 21:00)
 *   - Columnas = días de la semana (Lun a Dom)
 *
 * Requiere seleccionar un taller del dropdown para cargar sus horarios.
 * Cada celda ocupada muestra profesor, horario y ocupación (cupo).
 * Al hacer clic en una celda se abre un panel lateral con:
 *   - Detalle del horario (día, hora, profesor, alumnos)
 *   - Edición inline de cupo máximo
 *
 * La grilla se construye con useMemo: `gridHorarios` es un diccionario
 * indexado por `"dia_semana-horaInicio"` para acceso O(1) en cada celda.
 */
function HorariosPage() {
  const { cicloActual, isLoading: isCicloLoading } = useCiclo(); const { showApiError } = useToast();
  const apiBase = getApiBaseUrl(); const ww = useWindowWidth(); const mb = ww < 768;
  const [talleres, setTalleres] = useState<Taller[]>([]); const [ts, setTs] = useState<number|null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]); const [lt, setLt] = useState(true); const [lh, setLh] = useState(false);
  const [hs, setHs] = useState<Horario|null>(null);

  const actualizarCupo = useCallback((id:number,c:number,o:number)=>{setHs(p=>p?.id===id?{...p,cupo_maximo:c,ocupacion:o}:p);setHorarios(p=>p.map(h=>h.id===id?{...h,cupo_maximo:c,ocupacion:o}:h))},[]);
  const cargarTalleres = useCallback(async()=>{if(isCicloLoading||!cicloActual)return;try{const response=await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/talleres/`,{headers:{Authorization:`Bearer ${localStorage.getItem('access_token')}`}});setTalleres(((await response.json()).results))}catch(err){showApiError(err)}finally{setLt(false)}},[cicloActual,isCicloLoading,showApiError]);
  const cargarHorarios = useCallback(async(tId:number)=>{if(!cicloActual)return;setLh(true);    try{const response=await fetch(`${apiBase}/api/horarios/?taller=${tId}&page_size=100`,{headers:{Authorization:`Bearer ${localStorage.getItem('access_token')}`}});const jsonData=await response.json();setHorarios(jsonData.results||jsonData||[])}catch(err){showApiError(err)}finally{setLh(false)}},[cicloActual,showApiError]);
  useEffect(()=>{cargarTalleres()},[cargarTalleres]);
  useEffect(()=>{if(ts){cargarHorarios(ts);setHs(null)}else{setHorarios([]);setHs(null)}},[ts,cargarHorarios]);

  const tallerActual = useMemo(()=>talleres.find(t=>t.id===ts)||null,[talleres,ts]);
  // Construir grilla: clave "dia-hora" → objeto Horario para lookup O(1) por celda
  const gridHorarios = useMemo(()=>{const grid:Record<string,Horario>={};horarios.forEach(h=>{const i=horaAIndice(h.hora_inicio);if(i!==-1)grid[`${h.dia_semana}-${HORAS[i]}`]=h});return grid},[horarios]);

  if(isCicloLoading||lt) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'1rem'}}><div style={{width:40,height:40,border:'3px solid #f1f5f9',borderTop:'3px solid #d4af37',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><p style={{color:'#94a3b8',fontSize:'0.875rem'}}>Cargando...</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.75rem',flexWrap:'wrap',gap:'1rem'}}>
      <div><div style={{display:'flex',alignItems:'baseline',gap:'0.75rem'}}><h1 style={{fontSize:'1.625rem',fontWeight:700,color:'#0f172a',margin:0,letterSpacing:'-0.02em'}}>Horarios</h1><span style={{fontSize:'0.75rem',fontWeight:500,color:'#b59410',background:'#fef9e7',padding:'0.2rem 0.65rem',borderRadius:'9999px'}}>{cicloActual?.nombre}</span></div><div style={{height:3,width:48,background:'linear-gradient(90deg,#d4af37,#f0d878)',borderRadius:2,marginTop:'0.5rem'}}/></div>
      <div style={{minWidth:240}}><span style={{fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.25rem'}}>Taller / Instrumento</span><select value={ts??''} onChange={e=>setTs(e.target.value?parseInt(e.target.value):null)} style={{width:'100%',padding:'0.5rem 0.75rem',border:ts?'1px solid #e5e7eb':'2px solid #d4af37',borderRadius:'10px',fontSize:'0.875rem',fontWeight:500,color:'#0f172a',background:'white'}}><option value="">Seleccionar taller...</option>{talleres.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
    </div>
    {!ts&&(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4rem 2rem',background:'white',borderRadius:'14px',border:'1px dashed #e5e7eb'}}><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" style={{marginBottom:'1rem'}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#475569',marginBottom:'0.5rem'}}>Seleccioná un taller</h2><p style={{color:'#94a3b8',fontSize:'0.875rem',textAlign:'center',maxWidth:360}}>Elegí un taller del selector para ver su distribución semanal de clases.</p></div>)}
    {ts&&(<div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
      <div style={{flex:mb?'1 1 100%':hs?7:1,minWidth:0,width:mb?'100%':undefined}}>
        <div style={{background:'white',borderRadius:'14px',border:'1px solid #f1f5f9',overflow:'hidden'}}>
          <div style={{padding:'0.75rem 1.25rem',background:'#fef9e7',borderBottom:'1px solid #fdf3d0',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'0.9375rem',fontWeight:700,color:'#5c4508',margin:0}}>{tallerActual?.nombre}</h2><span style={{padding:'0.15rem 0.6rem',borderRadius:'9999px',fontSize:'0.7rem',fontWeight:600,background:'#fdf3d0',color:'#8b6914'}}>{horarios.length} clase{horarios.length!==1?'s':''}</span></div>
          {lh?<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div style={{width:32,height:32,border:'3px solid #f1f5f9',borderTop:'3px solid #d4af37',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>
          :horarios.length===0?<div style={{padding:'3rem',textAlign:'center',color:'#cbd5e1'}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{marginBottom:'0.75rem'}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p style={{fontSize:'0.875rem'}}>Este taller no tiene clases programadas.</p></div>
          :<div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <div style={{display:'grid',gridTemplateColumns:'48px repeat(7,1fr)',background:'#f8fafc',borderBottom:'1px solid #f1f5f9'}}><div style={{padding:'0.5rem',fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textAlign:'center',textTransform:'uppercase',letterSpacing:'0.04em'}}></div>{DIAS.map(d=><div key={d.value} style={{padding:'0.5rem 0.25rem',fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textAlign:'center',letterSpacing:'0.04em'}}>{d.abrev}</div>)}</div>
            {HORAS.map(hora=>(<div key={hora} style={{display:'grid',gridTemplateColumns:'48px repeat(7,1fr)',borderBottom:'1px solid #f8fafc',minHeight:56}}><div style={{padding:'0.35rem',fontSize:'0.65rem',color:'#cbd5e1',textAlign:'center',borderRight:'1px solid #f8fafc',display:'flex',alignItems:'center',justifyContent:'center'}}>{formatHora(hora)}</div>
              {DIAS.map(dia=>{const key=`${dia.value}-${hora}`;const horario=gridHorarios[key];const lleno=horario?(horario.ocupacion??0)>=horario.cupo_maximo:false;
                return(<div key={key} style={{borderLeft:'1px solid #f8fafc',padding:2}}>{horario&&<CeldaCalendario horario={horario} estaLleno={lleno} isSelected={hs?.id===horario.id} onClick={()=>setHs(hs?.id===horario.id?null:horario)}/>}</div>);})}
            </div>))}
          </div>}
        </div>
      </div>
      {hs&&(<div style={{flex:mb?'1 1 100%':'3 1 280px',maxWidth:mb?'100%':340,width:'100%'}}><PanelLateral horario={hs} estaLleno={(hs.ocupacion??0)>=hs.cupo_maximo} onClose={()=>setHs(null)} onActualizar={(c,o)=>actualizarCupo(hs.id,c,o)}/></div>)}
    </div>)}
  </div>);
}
export default memo(HorariosPage);
