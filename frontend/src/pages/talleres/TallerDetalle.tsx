import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { getApiBaseUrl } from '../../utils/api';
import { useWindowWidth } from '../../hooks/useWindowWidth';

interface Taller { id: number; nombre: string; descripcion: string; activo: boolean; }
interface Profesor { id: number; nombre: string; apellido: string; activo: boolean; }
interface Horario {
  id: number; taller: number; profesor: number; profesor_nombre: string; dia_semana: number;
  hora_inicio: string; hora_fin: string; cupo_maximo: number; cupo_disponible: number;
  ocupacion: number; activo: boolean; alumnos: { id: number; nombre: string; apellido: string; edad: number | null }[];
  tipo_pago?: 'dinamico' | 'fijo'; monto_fijo?: number | null;
}
interface HorarioFormData { dia_semana: number; hora_inicio: string; profesor: number | ''; cupo_maximo: number; }

const HORAS = Array.from({ length: 14 }, (_, i) => i + 8);
const DIAS = [
  { value: 0, label: 'Lunes' }, { value: 1, label: 'Martes' }, { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' }, { value: 4, label: 'Viernes' }, { value: 5, label: 'Sábado' }, { value: 6, label: 'Domingo' },
];
const ls: React.CSSProperties = { display:'block',fontSize:'0.6875rem',fontWeight:500,color:'#94a3b8',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' };
const is: React.CSSProperties = { width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' };
const getHoraLabel = (h: number) => `${h.toString().padStart(2, '0')}:00`;
const normalizarHora = (h: string) => { const p = h.split(':'); return `${(parseInt(p[0]) || 0).toString().padStart(2, '0')}:${p[1]?.substring(0, 2) || '00'}`; };

/**
 * TallerDetalle — Vista detallada de un taller con gestión de horarios
 *
 * Muestra una grilla semanal (filas = horas, columnas = días) con las clases
 * del taller. Desde esta vista se puede:
 *   - Ver ocupación de cada horario (alumnos/cupo)
 *   - Crear un horario nuevo (clic en celda vacía)
 *   - Seleccionar un horario existente para ver/editar:
 *     * Cambiar profesor asignado
 *     * Cambiar tipo de pago (dinámico/fijo) y monto fijo
 *     * Editar cupo máximo
 *     * Ver lista de alumnos inscriptos
 *     * Eliminar horario (solo si no tiene alumnos)
 *
 * Panel lateral derecho con tres estados: vacío (placeholder), crear (formulario),
 * detalle (edición inline). Las mutaciones usan PATCH directo al backend.
 */
function TallerDetalle() {
  const navigate = useNavigate(); const { tallerId } = useParams<{ tallerId: string }>();
  const { cicloActual, isLoading: isCicloLoading } = useCiclo();
  const { showToast, showApiError } = useToast();
  const apiBase = getApiBaseUrl(); const ww = useWindowWidth(); const mb = ww < 768;

  const [taller, setTaller] = useState<Taller | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelEstado, setPanelEstado] = useState<'vacio' | 'detalle' | 'crear'>('vacio');
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<Horario | null>(null);
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<{ dia: number; hora: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editandoProfesor, setEditandoProfesor] = useState(false);
  const [nuevoProfesorId, setNuevoProfesorId] = useState<number | ''>('');
  const [guardandoProfesor, setGuardandoProfesor] = useState(false);
  const [editandoPago, setEditandoPago] = useState(false);
  const [tipoPagoSeleccionado, setTipoPagoSeleccionado] = useState<'dinamico' | 'fijo'>('dinamico');
  const [montoFijo, setMontoFijo] = useState<string>('');
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [editandoCupo, setEditandoCupo] = useState(false);
  const [cupoEditado, setCupoEditado] = useState<string>('');
  const [guardandoCupo, setGuardandoCupo] = useState(false);
  const [crearTipoPago, setCrearTipoPago] = useState<'dinamico' | 'fijo'>('dinamico');
  const [crearMontoFijo, setCrearMontoFijo] = useState('');
  const [formData, setFormData] = useState<HorarioFormData>({ dia_semana: 0, hora_inicio: '', profesor: '', cupo_maximo: 10 });

  const fetchData = useCallback(async () => {
    if (isCicloLoading || !cicloActual || !tallerId) { setLoading(false); return; }
    const token = localStorage.getItem('access_token');
    try {
      const [tr, hr, pr] = await Promise.all([
        fetch(`${apiBase}/ciclos/${cicloActual.id}/talleres/${tallerId}/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/horarios/?taller=${tallerId}&page_size=100`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/ciclos/${cicloActual.id}/profesores/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const parse = async (r: Response) => { try { return JSON.parse(await r.text()); } catch { return { error: true }; } };
      const [tD, hD, pD] = await Promise.all([parse(tr), parse(hr), parse(pr)]);
      if (!tD.error) setTaller(tD);
      if (!hD.error) setHorarios((hD.results || hD).filter((h: Horario) => h.activo));
      if (!pD.error) setProfesores((pD.results || pD).filter((p: Profesor) => p.activo));
    } catch { /* silent */ } finally { setLoading(false); }
  }, [cicloActual, tallerId, isCicloLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Grilla de horarios: clave "dia-hora" → objeto Horario para lookup O(1)
  const gridHorarios = useMemo(() => {
    const g: { [key: string]: Horario } = {};
    horarios.forEach(h => { g[`${h.dia_semana}-${normalizarHora(h.hora_inicio)}`] = h; });
    return g;
  }, [horarios]);

  // Al hacer clic en celda:
  // - Si ya existe horario → modo detalle
  // - Si está vacía → modo crear (pre-rellena día y hora)
  const handleCeldaClick = (dia: number, hora: string) => {
    const key = `${dia}-${hora}`;
    if (gridHorarios[key]) { setHorarioSeleccionado(gridHorarios[key]); setPanelEstado('detalle'); setEditandoPago(false); setCeldaSeleccionada(null); }
    else { setCeldaSeleccionada({ dia, hora }); setFormData({ dia_semana: dia, hora_inicio: hora, profesor: '', cupo_maximo: 10 }); setCrearTipoPago('dinamico'); setCrearMontoFijo(''); setPanelEstado('crear'); }
  };

  const handleCrearHorario = async (e: React.FormEvent) => {
    e.preventDefault(); if (!cicloActual || !tallerId || !formData.profesor) return; setSaving(true);
    const token = localStorage.getItem('access_token'); const hp = formData.hora_inicio.split(':');
    try {
      const payload: Record<string, unknown> = { taller: parseInt(tallerId), profesor: formData.profesor, dia_semana: formData.dia_semana, hora_inicio: formData.hora_inicio, hora_fin: `${(parseInt(hp[0]) + 1).toString().padStart(2, '0')}:${hp[1]}`, activo: true, cupo_maximo: formData.cupo_maximo, tipo_pago: crearTipoPago };
      if (crearTipoPago === 'fijo' && crearMontoFijo) payload.monto_fijo = parseFloat(crearMontoFijo);
      const response = await fetch(`${apiBase}/ciclos/${cicloActual.id}/horarios/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(JSON.stringify(await response.json()));
      await fetchData(); setPanelEstado('vacio'); setCeldaSeleccionada(null);
    } catch (err) { showApiError(err); } finally { setSaving(false); }
  };

  const handleEliminarHorario = () => {
    if (!horarioSeleccionado) return;
    if ((horarioSeleccionado.ocupacion ?? 0) > 0) { showToast('No se puede eliminar. Hay estudiantes matriculados.', 'warning'); return; }
    setShowDeleteModal(true);
  };
  const confirmDeleteHorario = async () => {
    if (!horarioSeleccionado) return;
    try { await fetch(`${apiBase}/horarios/${horarioSeleccionado.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }); await fetchData(); setPanelEstado('vacio'); setHorarioSeleccionado(null); }
    catch (err) { showApiError(err); } finally { setShowDeleteModal(false); }
  };

  const patchHorario = async (payload: Record<string, unknown>, label: string) => {
    if (!horarioSeleccionado) return;
    try {
      const response = await fetch(`${apiBase}/horarios/${horarioSeleccionado.id}/`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(JSON.stringify(await response.json()));
      showToast(`${label} actualizado`, 'success');
      setHorarioSeleccionado(prev => prev ? { ...prev, ...payload as any } : prev);
      await fetchData();
    } catch (err) { showApiError(err); }
  };

  if (isCicloLoading || loading) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'1rem'}}><div style={{width:40,height:40,border:'3px solid #e2e8f0',borderTop:'3px solid #d4af37',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><p style={{color:'#94a3b8',fontSize:'0.875rem'}}>Cargando...</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  return (<div style={{ maxWidth: '1100px', margin: '0 auto' }}>
    <button onClick={() => navigate('/talleres')} style={{ display:'flex',alignItems:'center',gap:'0.375rem',padding:'0.4rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',background:'white',color:'#64748b',fontSize:'0.8125rem',cursor:'pointer',marginBottom:'1rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Volver a Talleres</button>
    <div style={{ marginBottom:'1.5rem' }}><div style={{ display:'flex',alignItems:'baseline',gap:'0.75rem',flexWrap:'wrap' }}><h1 style={{ fontSize:'1.625rem',fontWeight:700,color:'#0f172a',margin:0,letterSpacing:'-0.02em' }}>{taller?.nombre || '—'}</h1><span style={{ fontSize:'0.7rem',fontWeight:600,padding:'0.2rem 0.55rem',borderRadius:'9999px',background:taller?.activo?'#ecfdf5':'#f3f4f6',color:taller?.activo?'#059669':'#94a3b8' }}>{taller?.activo?'Activo':'Inactivo'}</span></div>{taller?.descripcion&&<p style={{ color:'#94a3b8',fontSize:'0.8125rem',margin:'0.25rem 0 0' }}>{taller.descripcion}</p>}<div style={{ height:3,width:48,background:'linear-gradient(90deg,#d4af37,#f0d878)',borderRadius:2,marginTop:'0.5rem' }}/></div>

    <div style={{ display:'flex',gap:'1rem',flexWrap:mb?'wrap':'nowrap' }}>
      <div style={{ flex:mb?'1 1 100%':7,minWidth:0 }}>
        <div style={{ background:'white',borderRadius:'14px',border:'1.5px solid #c8ccd4',overflow:'hidden' }}>
          <div style={{ display:'grid',gridTemplateColumns:'56px repeat(7,1fr)',background:'#fafbfc',borderBottom:'1px solid #e2e8f0' }}>
            <div style={{ padding:'0.5rem',fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textAlign:'center',textTransform:'uppercase',letterSpacing:'0.04em' }}></div>
            {DIAS.map(d => <div key={d.value} style={{ padding:'0.5rem',fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textAlign:'center',textTransform:'uppercase',letterSpacing:'0.04em' }}>{d.label.slice(0,3)}</div>)}
          </div>
          {HORAS.map(hora => { const horaStr = getHoraLabel(hora); return (
            <div key={hora} style={{ display:'grid',gridTemplateColumns:'56px repeat(7,1fr)',borderBottom:'1px solid #f8fafc',minHeight:52 }}>
              <div style={{ padding:'0.35rem',fontSize:'0.65rem',color:'#cbd5e1',textAlign:'center',borderRight:'1px solid #f0f2f5',display:'flex',alignItems:'center',justifyContent:'center' }}>{horaStr}</div>
              {DIAS.map(dia => {
                const key = `${dia.value}-${horaStr}`; const h = gridHorarios[key];
                const lleno = h ? (h.ocupacion ?? 0) >= h.cupo_maximo : false;
                const esSel = !h && celdaSeleccionada?.dia === dia.value && celdaSeleccionada?.hora === horaStr;
                return (<div key={key} onClick={() => handleCeldaClick(dia.value, horaStr)} style={{ borderRight:'1px solid #f0f2f5',cursor:'pointer',padding:2,background:h?(lleno?'#fef2f2':'#f0fdf4'):esSel?'#fef9e7':'transparent',outline:esSel?'2px solid #d4af37':'none',outlineOffset:-2,transition:'background 0.1s' }}
                  onMouseEnter={e => { if (!h && !esSel) e.currentTarget.style.background = '#f0f2f5'; }}
                  onMouseLeave={e => { if (!h && !esSel) e.currentTarget.style.background = 'transparent'; }}>
                  {h && <div style={{ height:'100%',background:lleno?'#fecaca':'#bbf7d0',borderRadius:'6px',padding:'0.2rem 0.3rem',fontSize:'0.6rem' }}><div style={{ fontWeight:700,color:lleno?'#7f1d1d':'#166534',marginBottom:1 }}>{h.ocupacion ?? 0}/{h.cupo_maximo}</div><div style={{ color:lleno?'#991b1b':'#14532d',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{h.profesor_nombre}</div></div>}
                </div>);
              })}
            </div>);
          })}
        </div>
      </div>

      <div style={{ flex:mb?'1 1 100%':'3 1 280px',maxWidth:mb?'100%':'340px',marginTop:mb?'0.75rem':0 }}>
        <div style={{ background:'white',borderRadius:'14px',border:'1.5px solid #c8ccd4',padding:'1.25rem',position:'sticky',top:'1rem' }}>
          {panelEstado === 'vacio' && (
            <div style={{ textAlign:'center',padding:'2rem 1rem',color:'#cbd5e1' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ margin:'0 auto 0.75rem',display:'block' }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p style={{ fontSize:'0.8125rem',lineHeight:1.5 }}>Seleccioná un horario o hacé clic en una celda vacía para crear uno nuevo.</p>
            </div>
          )}
          {panelEstado === 'crear' && (
            <div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem' }}><span style={{ fontSize:'0.875rem',fontWeight:600,color:'#0f172a' }}>Crear horario</span><button onClick={() => { setPanelEstado('vacio'); setCeldaSeleccionada(null); }} style={{ width:28,height:28,borderRadius:'50%',border:'none',background:'#e5e7eb',color:'#6b7280',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button></div>
              <form onSubmit={handleCrearHorario}>
                <div style={{ marginBottom:'0.75rem' }}><label style={ls}>Día</label><select value={formData.dia_semana} onChange={e => setFormData({ ...formData, dia_semana: parseInt(e.target.value) })} style={is}>{DIAS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                <div style={{ marginBottom:'0.75rem' }}><label style={ls}>Hora</label><select value={formData.hora_inicio} onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })} style={is}>{HORAS.map(h => <option key={h} value={getHoraLabel(h)}>{getHoraLabel(h)}</option>)}</select></div>
                <div style={{ marginBottom:'0.75rem' }}><label style={ls}>Profesor</label><select value={formData.profesor} onChange={e => setFormData({ ...formData, profesor: e.target.value ? parseInt(e.target.value) : '' })} required style={is}><option value="">Seleccionar...</option>{profesores.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}</select></div>
                <div style={{ marginBottom:'0.75rem' }}><label style={ls}>Cupo máximo</label><input type="number" value={formData.cupo_maximo} onChange={e => setFormData({ ...formData, cupo_maximo: parseInt(e.target.value) || 10 })} min={1} style={is} /></div>
                <div style={{ marginBottom:'1rem' }}>
                  <label style={ls}>Tipo de pago</label>
                  <div style={{ display:'flex',gap:0,borderRadius:'10px',border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:crearTipoPago==='fijo'?'0.5rem':0 }}>
                    {(['dinamico','fijo'] as const).map(t => <button key={t} type="button" onClick={() => setCrearTipoPago(t)} style={{ flex:1,padding:'0.4rem',border:'none',cursor:'pointer',fontSize:'0.75rem',fontWeight:crearTipoPago===t?600:400,background:crearTipoPago===t?'#fef9e7':'white',color:crearTipoPago===t?'#8b6914':'#94a3b8' }}>{t==='dinamico'?'Dinámico':'Fijo'}</button>)}
                  </div>
                  {crearTipoPago==='fijo' && <input type="number" step="0.01" placeholder="Monto fijo (S/.)" value={crearMontoFijo} onChange={e => setCrearMontoFijo(e.target.value)} style={is} />}
                </div>
                <div style={{ display:'flex',gap:'0.5rem' }}><button type="button" onClick={() => { setPanelEstado('vacio'); setCeldaSeleccionada(null); }} style={{ flex:1,padding:'0.5rem',border:'1px solid #e5e7eb',borderRadius:'10px',background:'white',color:'#374151',fontWeight:500,cursor:'pointer',fontSize:'0.8125rem' }}>Cancelar</button><button type="submit" disabled={saving || !formData.profesor} style={{ flex:1,padding:'0.5rem',border:'none',borderRadius:'10px',background:saving?'#e5e7eb':'#d4af37',color:saving?'#9ca3af':'#0a0a0a',fontWeight:600,cursor:saving?'not-allowed':'pointer',fontSize:'0.8125rem' }}>{saving?'...':'Crear'}</button></div>
              </form>
            </div>
          )}
          {panelEstado === 'detalle' && horarioSeleccionado && (
            <div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem' }}><span style={{ fontSize:'0.875rem',fontWeight:600,color:'#0f172a' }}>Detalle</span><button onClick={() => { setPanelEstado('vacio'); setHorarioSeleccionado(null); }} style={{ width:28,height:28,borderRadius:'50%',border:'none',background:'#e5e7eb',color:'#6b7280',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button></div>
              <SideCard><span style={sc}>Día y hora</span><span style={sv}>{DIAS.find(d => d.value === horarioSeleccionado.dia_semana)?.label} · {normalizarHora(horarioSeleccionado.hora_inicio)}</span></SideCard>
              <SideCard>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}><span style={sc}>Profesor</span>{!editandoProfesor && <button onClick={() => { setEditandoProfesor(true); setNuevoProfesorId(horarioSeleccionado.profesor); }} style={linkBtn}>Cambiar</button>}</div>
                {editandoProfesor ? (<div style={{ marginTop:'0.5rem' }}><select value={nuevoProfesorId} onChange={e => setNuevoProfesorId(e.target.value ? parseInt(e.target.value) : '')} style={{ ...is,marginBottom:'0.5rem' }}>{profesores.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}</select><div style={{ display:'flex',gap:'0.375rem' }}><button onClick={() => setEditandoProfesor(false)} style={btnSm}>Cancelar</button><button onClick={async () => { setGuardandoProfesor(true); await patchHorario({ profesor: nuevoProfesorId }, 'Profesor'); setGuardandoProfesor(false); setEditandoProfesor(false); }} disabled={guardandoProfesor || nuevoProfesorId === horarioSeleccionado.profesor} style={{ ...btnSm,background:guardandoProfesor?'#e5e7eb':'#d4af37',color:guardandoProfesor?'#9ca3af':'#0a0a0a' }}>{guardandoProfesor?'...':'Guardar'}</button></div></div>) : <span style={sv}>{horarioSeleccionado.profesor_nombre}</span>}
              </SideCard>
              <SideCard>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}><span style={sc}>Tipo de pago</span>{!editandoPago && <button onClick={() => { setEditandoPago(true); setTipoPagoSeleccionado(horarioSeleccionado.tipo_pago || 'dinamico'); setMontoFijo(horarioSeleccionado.monto_fijo?.toString() || ''); }} style={linkBtn}>Cambiar</button>}</div>
                {editandoPago ? (<div style={{ marginTop:'0.5rem' }}><div style={{ display:'flex',gap:0,borderRadius:'8px',border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:'0.5rem' }}>{(['dinamico','fijo'] as const).map(t => <button key={t} type="button" onClick={() => setTipoPagoSeleccionado(t)} style={{ flex:1,padding:'0.35rem',border:'none',cursor:'pointer',fontSize:'0.7rem',fontWeight:tipoPagoSeleccionado===t?600:400,background:tipoPagoSeleccionado===t?'#fef9e7':'white',color:tipoPagoSeleccionado===t?'#8b6914':'#94a3b8' }}>{t==='dinamico'?'Dinámico':'Fijo'}</button>)}</div>{tipoPagoSeleccionado==='fijo' && <input type="number" step="0.01" placeholder="Monto fijo" value={montoFijo} onChange={e => setMontoFijo(e.target.value)} style={{ ...is,marginBottom:'0.5rem' }} />}<div style={{ display:'flex',gap:'0.375rem' }}><button onClick={() => setEditandoPago(false)} style={btnSm}>Cancelar</button><button onClick={async () => { setGuardandoPago(true); const p: Record<string,unknown> = { tipo_pago: tipoPagoSeleccionado }; if (tipoPagoSeleccionado==='fijo'&&montoFijo) p.monto_fijo = parseFloat(montoFijo); else if (tipoPagoSeleccionado==='dinamico') p.monto_fijo = null; await patchHorario(p,'Tipo de pago'); setGuardandoPago(false); setEditandoPago(false); }} disabled={guardandoPago||(tipoPagoSeleccionado==='fijo'&&!montoFijo)} style={{ ...btnSm,background:guardandoPago?'#e5e7eb':'#d4af37',color:guardandoPago?'#9ca3af':'#0a0a0a' }}>{guardandoPago?'...':'Guardar'}</button></div></div>) : <span style={sv}>{horarioSeleccionado.tipo_pago==='fijo'?`Fijo ${horarioSeleccionado.monto_fijo?`(S/. ${horarioSeleccionado.monto_fijo})`:''}`:'Dinámico'}</span>}
              </SideCard>
              <SideCard>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}><span style={sc}>Cupo</span>{!editandoCupo && <button onClick={() => { setEditandoCupo(true); setCupoEditado(horarioSeleccionado.cupo_maximo.toString()); }} style={linkBtn}>Editar</button>}</div>
                {editandoCupo ? (<div style={{ marginTop:'0.5rem' }}><input type="number" value={cupoEditado} onChange={e => setCupoEditado(e.target.value)} min={horarioSeleccionado.ocupacion ?? 1} style={{ ...is,marginBottom:'0.25rem' }} /><div style={{ fontSize:'0.65rem',color:'#94a3b8',marginBottom:'0.5rem' }}>Mín: {horarioSeleccionado.ocupacion ?? 0} alumnos</div><div style={{ display:'flex',gap:'0.375rem' }}><button onClick={() => setEditandoCupo(false)} style={btnSm}>Cancelar</button><button onClick={async () => { setGuardandoCupo(true); await patchHorario({ cupo_maximo: parseInt(cupoEditado) },'Cupo'); setGuardandoCupo(false); setEditandoCupo(false); }} disabled={guardandoCupo||!cupoEditado||parseInt(cupoEditado)<(horarioSeleccionado.ocupacion??0)} style={{ ...btnSm,background:guardandoCupo?'#e5e7eb':'#d4af37',color:guardandoCupo?'#9ca3af':'#0a0a0a' }}>{guardandoCupo?'...':'Guardar'}</button></div></div>) : (<div style={{ display:'flex',alignItems:'center',gap:'0.375rem',marginTop:2 }}><span style={{ fontSize:'1.125rem',fontWeight:700,color:((horarioSeleccionado.ocupacion??0)>=horarioSeleccionado.cupo_maximo)?'#dc2626':'#059669' }}>{horarioSeleccionado.ocupacion??0}</span><span style={{ color:'#cbd5e1' }}>/</span><span style={{ fontSize:'0.875rem',color:'#475569' }}>{horarioSeleccionado.cupo_maximo}</span><span style={{ fontSize:'0.65rem',color:'#94a3b8',marginLeft:'auto' }}>{horarioSeleccionado.cupo_disponible??horarioSeleccionado.cupo_maximo} libres</span></div>)}
              </SideCard>
              <div style={{ marginBottom:'0.75rem' }}><span style={{ fontSize:'0.65rem',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.04em',display:'block',marginBottom:'0.5rem' }}>Alumnos ({horarioSeleccionado.alumnos?.length||0})</span>{horarioSeleccionado.alumnos&&horarioSeleccionado.alumnos.length>0?<div style={{ maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.25rem' }}>{horarioSeleccionado.alumnos.map(a => <div key={a.id} style={{ padding:'0.4rem 0.5rem',background:'#fafbfc',borderRadius:'8px',fontSize:'0.8125rem',color:'#475569' }}>{a.nombre} {a.apellido}{a.edad!==null?<span style={{ color:'#94a3b8',marginLeft:6 }}>({a.edad} años)</span>:''}</div>)}</div>:<div style={{ padding:'1rem',textAlign:'center',color:'#cbd5e1',fontSize:'0.75rem',background:'#fafbfc',borderRadius:'8px' }}>Sin estudiantes</div>}</div>
              {horarioSeleccionado.ocupacion===0 && <button onClick={handleEliminarHorario} style={{ width:'100%',padding:'0.5rem',border:'1px solid #fecaca',borderRadius:'10px',background:'#fef2f2',color:'#dc2626',fontWeight:500,cursor:'pointer',fontSize:'0.8125rem' }}>Eliminar horario</button>}
            </div>
          )}
        </div>
      </div>
    </div>
    <ConfirmModal isOpen={showDeleteModal} title="Eliminar Horario" message="¿Estás seguro?" itemName={horarioSeleccionado?`${DIAS.find(d=>d.value===horarioSeleccionado.dia_semana)?.label} - ${normalizarHora(horarioSeleccionado.hora_inicio)}`:''} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={confirmDeleteHorario} onCancel={()=>setShowDeleteModal(false)} isLoading={saving}/>
  </div>);
}

function SideCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <div style={{ background:'#fafbfc',borderRadius:'10px',padding:'0.75rem',marginBottom:'0.5rem',border:'1.5px solid #c8ccd4',...style }}>{children}</div>; }
const sc: React.CSSProperties = { fontSize:'0.65rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.04em',display:'block',marginBottom:2 };
const sv: React.CSSProperties = { fontSize:'0.8125rem',fontWeight:600,color:'#0f172a',display:'block',marginTop:1 };
const linkBtn: React.CSSProperties = { background:'none',border:'none',cursor:'pointer',fontSize:'0.65rem',color:'#d4af37',fontWeight:500 };
const btnSm: React.CSSProperties = { flex:1,padding:'0.35rem 0.5rem',border:'1px solid #e5e7eb',borderRadius:'8px',background:'white',color:'#374151',fontSize:'0.7rem',fontWeight:500,cursor:'pointer' };
export default memo(TallerDetalle);
