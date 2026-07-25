import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageHeader from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { getTalleres, createTaller, updateTaller, deleteTaller } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import type { Taller } from '../../api/endpoints';
import { useWindowWidth } from '../../hooks/useWindowWidth';

interface TallerFormData { nombre: string; tipo: string; descripcion: string; activo: boolean; }
const init: TallerFormData = { nombre: '', tipo: 'taller', descripcion: '', activo: true };
const ls: React.CSSProperties = { display:'block',fontSize:'0.6875rem',fontWeight:500,color:'var(--color-text-muted)',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.04em' };
const is: React.CSSProperties = { width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem' };

function TalleresPage() {
  const n = useNavigate(); const { cicloActual } = useCiclo(); const { showApiError } = useToast(); const queryClient = useQueryClient(); const ww = useWindowWidth(); const mb = ww < 768;
  const { searchText: s, setSearchText: setS, debouncedValue: ds } = useDebouncedSearch();
  const [ft, setFt] = useState(''); const [sm, setSm] = useState(false); const [eid, setEid] = useState<number|null>(null);
  const [fd, setFd] = useState(init); const [sv, setSv] = useState(false); const [did, setDid] = useState<number|null>(null); const [dn, setDn] = useState('');
  const [cp, setCp] = useState(1);

  const { data: talleresResponse, isLoading, error } = useQuery({
    queryKey: queryKeys.talleres(cicloActual?.id ?? 0, cp, ds),
    queryFn: async () => {
      if (!cicloActual) return { count: 0, results: [] };
      const r = await getTalleres(cicloActual.id, cp, ds);
      return r.data;
    },
    enabled: !!cicloActual,
    staleTime: 30_000,
  });

  const talleres = talleresResponse?.results || [];
  const totalCount = talleresResponse?.count || 0;
  const tp = Math.ceil(totalCount / 20) || 1;
  const ft2 = talleres.filter(x=>!ft||x.tipo===ft);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Taller>) => {
      if (eid) return updateTaller(eid, payload);
      return createTaller(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talleres(cicloActual?.id ?? 0) });
      setSm(false); setEid(null); setFd(init);
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTaller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talleres(cicloActual?.id ?? 0) });
      setDid(null); setDn('');
    },
    onError: (err) => showApiError(err),
  });

  const pc = (pg:number) => setCp(pg);
  const hs = async (e:React.FormEvent) => { e.preventDefault(); if(!cicloActual)return; setSv(true); try { await saveMutation.mutateAsync({...fd,ciclo:cicloActual.id}); } finally { setSv(false) } };
  const he = (tl:Taller) => { setEid(tl.id); setFd({nombre:tl.nombre,tipo:tl.tipo||'taller',descripcion:tl.descripcion||'',activo:tl.activo}); setSm(true) };
  const hd = (id:number,nm:string) => { setDid(id); setDn(nm) };
  const cd = async () => { if(!did)return; setSv(true); try { await deleteMutation.mutateAsync(did); } finally { setSv(false) } };
  const cc = () => { setDid(null); setDn('') };
  const oc = () => { setEid(null); setFd(init); setSm(true) };

  if(isLoading) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'1rem'}}><div style={{width:40,height:40,border:'3px solid #f1f5f9',borderTop:'3px solid var(--color-primary)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>;
  if (error) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}><p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>Error al cargar talleres.</p><Button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.talleres(cicloActual?.id ?? 0) })}>Reintentar</Button></div>;

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    <PageHeader title="Talleres" cicloNombre={cicloActual?.nombre} actionLabel="Nuevo taller" onAction={oc} />
    <div style={{background:'white',borderRadius:'12px',border:'1px solid #f1f5f9',padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
      <div style={{flex:1,minWidth:200,position:'relative'}}><svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input placeholder="Buscar talleres..." value={s} onChange={e=>{setS(e.target.value); setCp(1);}} style={{width:'100%',padding:'0.5rem 0.75rem 0.5rem 2.25rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem'}}/></div>
      <select value={ft} onChange={e=>setFt(e.target.value)} style={{padding:'0.5rem 0.75rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem',background:'white',minWidth:160}}><option value="">Todos</option><option value="instrumento">Instrumento</option><option value="taller">Taller</option></select>
    </div>
    {ft2.length===0?(
      <div style={{textAlign:'center',padding:'3rem',background:'white',borderRadius:'14px',border:'1px dashed #e5e7eb'}}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{marginBottom:'0.75rem'}}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg><p style={{color:'var(--color-text-muted)',marginBottom:'1rem',fontSize:'0.875rem'}}>{ds||ft?'No se encontraron talleres':'No hay talleres'}</p>{!ds&&!ft&&<Button onClick={oc} size="sm">Crear primer taller</Button>}</div>
    ):(
      <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${mb?'155px':'250px'},1fr))`,gap:'0.875rem'}}>
        {ft2.map(tl=>{const ii=tl.tipo==='instrumento';const c=ii?'#7c3aed':'#d97706';return(<div key={tl.id} onClick={()=>n(`/talleres/${tl.id}`)} style={{background:'white',borderRadius:'14px',border:'1px solid #f1f5f9',overflow:'hidden',cursor:'pointer',transition:'box-shadow 0.2s,transform 0.15s'}} onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-3px)'}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}><div style={{height:6,background:c}}/><div style={{padding:'1.125rem 1.25rem 1rem'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.5rem',gap:'0.5rem'}}><h3 style={{fontSize:'1rem',fontWeight:600,color:'var(--color-bg-dark)',margin:0,lineHeight:1.3}}>{tl.nombre}</h3><span style={{padding:'0.15rem 0.5rem',borderRadius:'9999px',fontSize:'0.6rem',fontWeight:600,background:tl.activo?'#ecfdf5':'#f3f4f6',color:tl.activo?'var(--color-success)':'var(--color-text-muted)',whiteSpace:'nowrap',flexShrink:0}}>{tl.activo?'Activo':'Inactivo'}</span></div><span style={{display:'inline-block',padding:'0.15rem 0.5rem',borderRadius:'5px',fontSize:'0.65rem',fontWeight:500,background:ii?'#f5f3ff':'#fefce8',color:c,marginBottom:'0.5rem'}}>{ii?'Instrumento':'Taller'}</span><p style={{fontSize:'0.8125rem',color:'var(--color-text-muted)',lineHeight:1.5,marginBottom:'0.75rem',overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'} as React.CSSProperties}>{tl.descripcion||'Sin descripción'}</p><div style={{display:'flex',gap:'0.375rem'}}><button onClick={e=>{e.stopPropagation();n(`/talleres/${tl.id}`)}} className="touch-target" style={{flex:1,padding:'0.4rem',borderRadius:'8px',border:'none',background:'#f1f5f9',color:'#475569',fontSize:'0.75rem',fontWeight:500,cursor:'pointer'}}>Ver</button><button onClick={e=>{e.stopPropagation();he(tl)}} className="touch-target" style={{flex:1,padding:'0.4rem',borderRadius:'8px',border:'none',background:'#f1f5f9',color:'var(--color-primary)',fontSize:'0.75rem',fontWeight:500,cursor:'pointer'}}>Editar</button><button onClick={e=>{e.stopPropagation();hd(tl.id,tl.nombre)}} disabled={did===tl.id} className="touch-target" style={{flex:1,padding:'0.4rem',borderRadius:'8px',border:'none',background:'#f1f5f9',color:did===tl.id?'var(--color-text-muted)':'var(--color-error)',fontSize:'0.75rem',fontWeight:500,cursor:did===tl.id?'not-allowed':'pointer'}}>{did===tl.id?'...':'Eliminar'}</button></div></div></div>)})}
      </div>
    )}
    {tp>1&&<Pagination currentPage={cp} totalPages={tp} totalCount={totalCount} onPageChange={pc}/>}
    {sm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}><div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'500px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}><div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'1.125rem',fontWeight:700,color:'var(--color-bg-dark)',margin:0}}>{eid?'Editar taller':'Nuevo taller'}</h2><button onClick={()=>setSm(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#f3f4f6',color:'#6b7280',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div><form onSubmit={hs} style={{padding:'1.5rem'}}><div style={{marginBottom:'0.75rem'}}><label style={ls}>Nombre</label><input value={fd.nombre} onChange={e=>setFd({...fd,nombre:e.target.value})} required placeholder="Ej: Piano, Guitarra..." style={is}/></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>Tipo</label><div style={{display:'flex',gap:0,background:'#f8fafc',borderRadius:'10px',border:'1px solid #e5e7eb',overflow:'hidden'}}>{(['taller','instrumento']as const).map(tp=>(<button key={tp} type="button" onClick={()=>setFd({...fd,tipo:tp})} style={{flex:1,padding:'0.5rem',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:fd.tipo===tp?600:400,background:fd.tipo===tp?(tp==='instrumento'?'#f5f3ff':'#fefce8'):'transparent',color:fd.tipo===tp?(tp==='instrumento'?'#7c3aed':'#d97706'):'var(--color-text-muted)',transition:'all 0.15s'}}>{tp==='instrumento'?'Instrumento':'Taller'}</button>))}</div></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>Descripción</label><textarea value={fd.descripcion} onChange={e=>setFd({...fd,descripcion:e.target.value})} rows={3} style={{...is,resize:'vertical'}}/></div><label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',color:'#475569',cursor:'pointer',marginBottom:'1.25rem'}}><input type="checkbox" checked={fd.activo} onChange={e=>setFd({...fd,activo:e.target.checked})} style={{width:16,height:16,accentColor:'var(--color-primary)'}}/> Taller activo</label><div style={{display:'flex',gap:'0.75rem'}}><Button type="button" variant="secondary" onClick={()=>setSm(false)} style={{flex:1}}>Cancelar</Button><Button type="submit" isLoading={sv||saveMutation.isPending} style={{flex:1}}>Guardar</Button></div></form></div></div>)}
    <ConfirmModal isOpen={did!==null} title="Confirmar Eliminación" message="¿Estás seguro de eliminar este taller?" itemName={dn} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={cd} onCancel={cc} isLoading={sv||deleteMutation.isPending}/>
  </div>);
}
export default memo(TalleresPage);
