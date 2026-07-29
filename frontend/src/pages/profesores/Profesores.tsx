import { useState, memo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { getHistorialPagosProfesor, getProfesores, createProfesor, updateProfesor, deleteProfesor } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { formatMonto } from '../../utils/formatters';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import type { Profesor } from '../../api/endpoints';

interface ProfesorFormData { nombre: string; apellido: string; dni: string; telefono: string; email: string; fecha_nacimiento: string; activo: boolean; es_gerente: boolean; observaciones: string; }
const init: ProfesorFormData = { nombre:'',apellido:'',dni:'',telefono:'',email:'',fecha_nacimiento:'',activo:true,es_gerente:false,observaciones:'' };
const ls: React.CSSProperties = { display:'block',fontSize:'0.6875rem',fontWeight:500,color:'var(--color-text-muted)',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' };
const is: React.CSSProperties = { width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' };

const ProfesoresFilterBar = memo(function ProfesoresFilterBar({
  onSearchChange,
}: {
  onSearchChange: (v: string) => void;
}) {
  const { searchText, setSearchText, debouncedValue } = useDebouncedSearch();

  useEffect(() => {
    onSearchChange(debouncedValue);
  }, [debouncedValue, onSearchChange]);

  return (
    <div style={{background:'white',borderRadius:'12px',border:'1.5px solid #c8ccd4',padding:'0.75rem 1rem',marginBottom:'0.75rem'}}>
      <div style={{position:'relative'}}>
        <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{width:'100%',padding:'0.5rem 0.75rem 0.5rem 2.25rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem'}}/>
      </div>
    </div>
  );
});

/**
 * ProfesoresPage — CRUD de profesores con historial de pagos
 *
 * Permite crear, editar y eliminar profesores. Incluye búsqueda con debounce,
 * paginación, y un modal de historial de pagos que muestra montos por período.
 * Usa React Query para cache y mutaciones optimistas.
 */
function ProfesoresPage() {
  const navigate = useNavigate(); const location = useLocation(); const { cicloActual } = useCiclo(); const { showApiError } = useToast(); const queryClient = useQueryClient(); const ww = useWindowWidth(); const mb = ww < 768;
  // ponytail: abre modal en primer render si viene de ProfesorDetalle
  const locState = location.state as { editProfesor?: { id: number; nombre: string; apellido: string; dni: string; telefono: string; email: string; fecha_nacimiento: string | null; activo: boolean; es_gerente: boolean; observaciones: string; } } | null;
  const ep = locState?.editProfesor;
  const [ds, setDs] = useState('');
  const [sm, setSm] = useState(!!ep); const [eid, setEid] = useState<number|null>(ep?.id ?? null); const [fd, setFd] = useState(ep ? { nombre: ep.nombre, apellido: ep.apellido, dni: ep.dni, telefono: ep.telefono||'', email: ep.email||'', fecha_nacimiento: ep.fecha_nacimiento||'', activo: ep.activo, es_gerente: ep.es_gerente??false, observaciones: ep.observaciones||'' } : init);
  const [sv, setSv] = useState(false); const [did, setDid] = useState<number|null>(null); const [dn, setDn] = useState('');
  const [ho, setHo] = useState(false); const [hp, setHp] = useState<any[]>([]); const [hl, setHl] = useState(false);
  const [cp, setCp] = useState(1);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const menuRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (menuOpen === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const el = menuRefs.current.get(menuOpen);
      if (el && el.contains(e.target as Node)) return;
      setMenuOpen(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);
  const handleSearchChange = useCallback((value: string) => { setDs(value); setCp(1); }, []);

  const { data: profesoresResponse, isPending, error } = useQuery({
    queryKey: queryKeys.profesores(cicloActual?.id ?? 0, cp, ds),
    queryFn: async () => {
      if (!cicloActual) return { count: 0, results: [] };
      const response = await getProfesores(cicloActual.id, cp, ds);
      return response.data;
    },
    enabled: !!cicloActual,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const profesores = profesoresResponse?.results || [];
  const totalCount = profesoresResponse?.count || 0;
  const tp = Math.ceil(totalCount / 20) || 1;

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Profesor>) => {
      if (eid) return updateProfesor(eid, payload);
      return createProfesor(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profesores(cicloActual?.id ?? 0) });
      setSm(false); setEid(null); setFd(init);
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfesor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profesores(cicloActual?.id ?? 0) });
      setDid(null); setDn('');
    },
    onError: (err) => showApiError(err),
  });

  const hs = async (e:React.FormEvent) => { e.preventDefault(); if(!cicloActual)return; setSv(true); try { await saveMutation.mutateAsync({...fd,ciclo:cicloActual.id}); } finally { setSv(false) } };
  const he = (pr:Profesor) => { setEid(pr.id); setFd({nombre:pr.nombre,apellido:pr.apellido,dni:pr.dni,telefono:pr.telefono||'',email:pr.email||'',fecha_nacimiento:pr.fecha_nacimiento||'',activo:pr.activo,es_gerente:pr.es_gerente??false,observaciones:pr.observaciones||''}); setSm(true) };
  // ponytail: limpia el state de navegación post-mount
  useEffect(() => {
    if (ep) navigate(location.pathname, { replace: true, state: undefined });
  }, []);
  const hd = (id:number,n:string) => { setDid(id); setDn(n) };
  const cd = async () => { if(!did)return; setSv(true); try { await deleteMutation.mutateAsync(did); } finally { setSv(false) } };
  const cc = () => { setDid(null); setDn('') };
  const oc = () => { setEid(null); setFd(init); setSm(true) };
  const vh = async (pid:number) => { setHo(true); setHl(true); try { setHp((await getHistorialPagosProfesor(pid)).data) } catch{} finally{setHl(false)} };
  const pc = (pg:number) => setCp(pg);

  if (isPending && !profesoresResponse && !sm) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'1rem'}}><div style={{width:40,height:40,border:'3px solid #e2e8f0',borderTop:'3px solid var(--color-primary)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>;
  if (error) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}><p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>Error al cargar profesores.</p><Button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.profesores(cicloActual?.id ?? 0) })}>Reintentar</Button></div>;

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    <PageHeader title="Profesores" cicloNombre={cicloActual?.nombre} actionLabel="Nuevo profesor" onAction={oc} />
    <ProfesoresFilterBar onSearchChange={handleSearchChange} />
    <div style={{background:'white',borderRadius:'12px',border:'1.5px solid #c8ccd4',overflow:'visible'}}>
      <ResponsiveTable<Profesor> columns={[
        {key:'nombre',label:'Nombre',render:pr=><span style={{fontWeight:600,color:'var(--color-bg-dark)'}}>{pr.nombre} {pr.apellido}</span>},{key:'dni',label:'DNI'},{key:'telefono',label:'Teléfono',render:pr=>pr.telefono||<span style={{color:'var(--color-text-muted)'}}>—</span>},
        {key:'edad',label:'Edad',align:'center',render:pr=>pr.edad!==null?<span style={{fontSize:'0.8125rem',color:'#374151'}}>{pr.edad}</span>:<span style={{color:'var(--color-text-muted)'}}>—</span>},
        {key:'created_at',label:'Registro',align:'center',render:pr=>pr.created_at?(():string=>{const[y,m,d]=pr.created_at.split('T')[0].split('-');return`${d}/${m}/${y}`})():'—'},
      ]} data={profesores} keyField="id"
      actions={pr => (
        <div style={{ position: 'relative' }} ref={el => { if (el) menuRefs.current.set(pr.id, el); else menuRefs.current.delete(pr.id); }}>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === pr.id ? null : pr.id); }} aria-label="Acciones" style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            ⋯
          </button>
            {menuOpen === pr.id && (
              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 120, padding: '0.35rem 0' }}>
              <button onClick={() => { setMenuOpen(null); navigate(`/profesores/${pr.id}`); }} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>Ver</button>
              <button onClick={() => { setMenuOpen(null); vh(pr.id); }} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>Historial</button>
              <button onClick={() => { setMenuOpen(null); he(pr); }} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#374151' }}>Editar</button>
              <button onClick={() => { setMenuOpen(null); hd(pr.id, `${pr.nombre} ${pr.apellido}`); }} style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}>Eliminar</button>
            </div>
          )}
        </div>
      )}
      emptyMessage={ds?'No se encontraron resultados':'No hay profesores registrados'}/>
      {tp>1&&<Pagination currentPage={cp} totalPages={tp} totalCount={totalCount} onPageChange={pc}/>}
    </div>
    {sm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}><div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'540px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}><div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'1.125rem',fontWeight:700,color:'var(--color-bg-dark)',margin:0}}>{eid?'Editar profesor':'Nuevo profesor'}</h2><button onClick={()=>setSm(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#e5e7eb',color:'#6b7280',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div><form onSubmit={hs} style={{padding:'1.5rem'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}><div><label style={ls}>Nombre</label><input value={fd.nombre} onChange={e=>setFd({...fd,nombre:e.target.value})} required style={is}/></div><div><label style={ls}>Apellido</label><input value={fd.apellido} onChange={e=>setFd({...fd,apellido:e.target.value})} required style={is}/></div></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>DNI</label><input value={fd.dni} onChange={e=>setFd({...fd,dni:e.target.value})} required maxLength={15} style={is}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}><div><label style={ls}>Teléfono</label><input value={fd.telefono} onChange={e=>setFd({...fd,telefono:e.target.value})} style={is}/></div><div><label style={ls}>Email</label><input type="email" value={fd.email} onChange={e=>setFd({...fd,email:e.target.value})} style={is}/></div></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>Fecha nac.</label><input type="date" value={fd.fecha_nacimiento} onChange={e=>setFd({...fd,fecha_nacimiento:e.target.value})} style={is}/></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>Observaciones</label><textarea value={fd.observaciones} onChange={e=>setFd({...fd,observaciones:e.target.value})} rows={2} style={{...is,resize:'vertical'}}/></div><div style={{display:'flex',gap:'1.25rem',marginBottom:'1.25rem'}}><label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',color:'#475569',cursor:'pointer'}}><input type="checkbox" checked={fd.activo} onChange={e=>setFd({...fd,activo:e.target.checked})} style={{width:16,height:16,accentColor:'var(--color-primary)'}}/> Activo</label><label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',color:'#475569',cursor:'pointer'}}><input type="checkbox" checked={fd.es_gerente} onChange={e=>setFd({...fd,es_gerente:e.target.checked})} style={{width:16,height:16,accentColor:'var(--color-primary)'}}/> Es gerente</label></div><div style={{display:'flex',gap:'0.75rem'}}><button type="button" onClick={()=>setSm(false)} style={{flex:1,padding:'0.625rem 1.25rem',borderRadius:'10px',border:'1px solid #e5e7eb',background:'white',color:'#374151',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>Cancelar</button><Button type="submit" isLoading={sv||saveMutation.isPending} style={{flex:1}}>Guardar</Button></div></form></div></div>)}
    <ConfirmModal isOpen={did!==null} title="Confirmar Eliminación" message="¿Estás seguro?" itemName={dn} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={cd} onCancel={cc} isLoading={sv||deleteMutation.isPending}/>
    {ho&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}><div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'600px',maxHeight:'80vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}><div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'1.125rem',fontWeight:700,color:'var(--color-bg-dark)',margin:0}}>Historial de Pagos</h2><button onClick={()=>setHo(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#e5e7eb',color:'#6b7280',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div><div style={{padding:'1.5rem'}}>{hl?<p style={{textAlign:'center',color:'var(--color-text-muted)',padding:'2rem'}}>Cargando...</p>:hp.length===0?<p style={{textAlign:'center',color:'var(--color-text-muted)',padding:'2rem'}}>No hay pagos</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:mb?450:'auto'}}><thead><tr style={{background:'#fafbfc',borderBottom:'1.5px solid #e2e8f0'}}><th style={{padding:'0.5rem 0.75rem',textAlign:'left',fontSize:'0.65rem',fontWeight:600,color:'var(--color-text-muted)',textTransform:'uppercase'}}>Fecha</th><th style={{padding:'0.5rem 0.75rem',textAlign:'right',fontSize:'0.65rem',fontWeight:600,color:'var(--color-text-muted)',textTransform:'uppercase'}}>Monto</th><th style={{padding:'0.5rem 0.75rem',textAlign:'left',fontSize:'0.65rem',fontWeight:600,color:'var(--color-text-muted)',textTransform:'uppercase'}}>Descripción</th><th style={{padding:'0.5rem 0.75rem',textAlign:'center',fontSize:'0.65rem',fontWeight:600,color:'var(--color-text-muted)',textTransform:'uppercase'}}>Estado</th></tr></thead><tbody>{hp.map((pg:any)=>(<tr key={pg.id} style={{borderBottom:'1px solid #f0f2f5'}}><td style={{padding:'0.5rem 0.75rem',fontSize:'0.8125rem'}}>{new Date(pg.fecha).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})}</td><td style={{padding:'0.5rem 0.75rem',textAlign:'right',fontWeight:600,fontFamily:'monospace'}}>{formatMonto(pg.monto)}</td><td style={{padding:'0.5rem 0.75rem',fontSize:'0.8125rem',color:'#64748b'}}>{pg.descripcion||'—'}</td><td style={{padding:'0.5rem 0.75rem',textAlign:'center'}}><span style={{padding:'0.15rem 0.5rem',borderRadius:'9999px',fontSize:'0.7rem',fontWeight:600,background:pg.estado==='pendiente'?'#fef3c7':'#ecfdf5',color:pg.estado==='pendiente'?'#d97706':'var(--color-success)'}}>{pg.estado_display}</span></td></tr>))}</tbody></table></div>}<Button type="button" variant="secondary" onClick={()=>setHo(false)} style={{width:'100%',marginTop:'1rem'}}>Cerrar</Button></div></div></div>)}
  </div>);
}
export default memo(ProfesoresPage);
