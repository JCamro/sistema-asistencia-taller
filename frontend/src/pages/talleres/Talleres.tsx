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

/**
 * TalleresPage — Catálogo de talleres e instrumentos del ciclo activo
 *
 * Vista de cards con filtro por tipo (Todos / Instrumento / Taller) y
 * búsqueda por texto con debounce. Cada card muestra:
 *   - Barra de color (violeta = instrumento, ámbar = taller)
 *   - Nombre, tipo, descripción, estado (activo/inactivo)
 *   - Botones de acción: editar, eliminar
 *
 * Al hacer clic en una card, navega a /talleres/:id (TallerDetalle).
 * CRUD mediante React Query: useQuery para listado, useMutation para
 * crear/editar/eliminar con invalidación de caché.
 */
function TalleresPage() {
  const navigate = useNavigate(); const { cicloActual } = useCiclo(); const { showApiError } = useToast(); const queryClient = useQueryClient(); const ww = useWindowWidth(); const mb = ww < 768;
  const { searchText: s, setSearchText: setS, debouncedValue: ds } = useDebouncedSearch();
  const [ft, setFt] = useState(''); const [sm, setSm] = useState(false); const [eid, setEid] = useState<number|null>(null);
  const [fd, setFd] = useState(init); const [sv, setSv] = useState(false); const [did, setDid] = useState<number|null>(null); const [dn, setDn] = useState('');
  const [cp, setCp] = useState(1);

  const { data: talleresResponse, isLoading, error } = useQuery({
    queryKey: queryKeys.talleres(cicloActual?.id ?? 0, cp, ds),
    queryFn: async () => {
      if (!cicloActual) return { count: 0, results: [] };
      const response = await getTalleres(cicloActual.id, cp, ds);
      return response.data;
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
      queryClient.invalidateQueries({ queryKey: ['talleres', cicloActual?.id ?? 0] });
      setSm(false); setEid(null); setFd(init);
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTaller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talleres', cicloActual?.id ?? 0] });
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

  if(isLoading) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'1rem'}}><div style={{width:40,height:40,border:'3px solid #e2e8f0',borderTop:'3px solid var(--color-primary)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>;
  if (error) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}><p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>Error al cargar talleres.</p><Button onClick={() => queryClient.invalidateQueries({ queryKey: ['talleres', cicloActual?.id ?? 0] })}>Reintentar</Button></div>;

  return (<div style={{maxWidth:'1100px',margin:'0 auto'}}>
    <PageHeader title="Talleres" cicloNombre={cicloActual?.nombre} actionLabel="Nuevo taller" onAction={oc} extra={totalCount > 0 ? <span style={{ fontSize: '0.6875rem', color: '#94a3b8', background: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontWeight: 500 }}>{totalCount}</span> : undefined} />
    <div style={{background:'white',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
      <div style={{flex:1,minWidth:200,position:'relative'}}><svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input placeholder="Buscar talleres..." value={s} onChange={e=>{setS(e.target.value); setCp(1);}} style={{width:'100%',padding:'0.5rem 0.75rem 0.5rem 2.25rem',border:'1px solid #e5e7eb',borderRadius:'10px',fontSize:'0.875rem'}}/></div>
      <div style={{display:'flex',gap:'0.25rem',background:'#f0f2f5',borderRadius:'10px',padding:'0.2rem',border:'1px solid #e5e7eb'}}>
        {(['', 'instrumento', 'taller'] as const).map(v => (
          <button key={v} onClick={() => setFt(v)} className="touch-target"
            style={{
              padding: '0.4rem 0.75rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: ft === v ? 600 : 400,
              background: ft === v ? (v === 'instrumento' ? '#fef9e7' : v === 'taller' ? '#fefce8' : '#fff') : 'transparent',
              color: ft === v ? (v === 'instrumento' ? '#8b6914' : v === 'taller' ? '#d97706' : '#0f172a') : '#64748b',
              transition: 'all 150ms', minHeight: 36, boxShadow: ft === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {v === '' ? 'Todos' : v === 'instrumento' ? 'Instrumento' : 'Taller'}
          </button>
        ))}
      </div>
    </div>
    {ft2.length===0?(
      <div style={{textAlign:'center',padding:'3rem',background:'white',borderRadius:'14px',border:'1px dashed #e5e7eb'}}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{marginBottom:'0.75rem'}}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg><p style={{color:'var(--color-text-muted)',marginBottom:'1rem',fontSize:'0.875rem'}}>{ds||ft?'No se encontraron talleres':'No hay talleres'}</p>{!ds&&!ft&&<Button onClick={oc} size="sm">Crear primer taller</Button>}</div>
    ):(
      <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${mb?'155px':'250px'},1fr))`,gap:'0.875rem'}}>
        {ft2.map(taller=>{const esInstrumento=taller.tipo==='instrumento';const color=esInstrumento?'#8b6914':'#d97706';const bandColor=esInstrumento?'#fef9e7':'#fefce8';return(<div key={taller.id} onClick={()=>navigate(`/talleres/${taller.id}`)} style={{background:'white',borderRadius:'16px',border:'1px solid #e2e8f0',overflow:'hidden',cursor:'pointer',transition:'all 0.2s ease',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}} onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)';e.currentTarget.style.borderColor='#d4af37'}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';e.currentTarget.style.borderColor='#e2e8f0'}}><div style={{background:`linear-gradient(to right, ${bandColor}, transparent)`,borderRadius:'16px 16px 0 0',padding:'1rem 1.25rem'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.75rem'}}><h3 style={{fontSize:'1rem',fontWeight:700,color:'#0f172a',margin:0,lineHeight:1.3}}>{taller.nombre}</h3><span style={{width:8,height:8,borderRadius:'50%',background:taller.activo?'#10b981':'#94a3b8',flexShrink:0}} title={taller.activo?'Activo':'Inactivo'}/></div></div><div style={{padding:'1.25rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.375rem',marginBottom:'0.5rem'}}>{esInstrumento?(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>):(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>)}<span style={{fontSize:'0.75rem',fontWeight:500,color}}>{esInstrumento?'Instrumento':'Taller'}</span></div><p style={{fontSize:'0.8125rem',color:'#64748b',lineHeight:1.6,margin:0,marginBottom:'0.75rem',overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'} as React.CSSProperties}>{taller.descripcion||'Sin descripción'}</p><div style={{display:'flex',gap:'0.25rem',justifyContent:'flex-end',borderTop:'1px solid #f0f2f5',paddingTop:'0.625rem',marginTop:'0.5rem'}}><button onClick={e=>{e.stopPropagation();he(taller)}} className="touch-target" title="Editar" style={{width:36,height:36,borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',color:'#64748b',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 150ms'}} onMouseEnter={e=>{e.currentTarget.style.background='#fef9e7';e.currentTarget.style.borderColor='#d4af37';e.currentTarget.style.color='#8b6914'}} onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#64748b'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button onClick={e=>{e.stopPropagation();hd(taller.id,taller.nombre)}} disabled={did===taller.id} className="touch-target" title="Eliminar" style={{width:36,height:36,borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',color:'#64748b',cursor:did===taller.id?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 150ms'}} onMouseEnter={e=>{if(!did||did!==taller.id){e.currentTarget.style.background='#fef2f2';e.currentTarget.style.borderColor='#fecaca';e.currentTarget.style.color='#dc2626'}}} onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#64748b'}}>{did===taller.id?<div style={{width:14,height:14,border:'2px solid #94a3b8',borderTop:'2px solid transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>}</button></div></div></div>)})}
      </div>
    )}
    {tp>1&&<Pagination currentPage={cp} totalPages={tp} totalCount={totalCount} onPageChange={pc}/>}
    {sm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}><div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'500px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}><div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:'1.125rem',fontWeight:700,color:'var(--color-bg-dark)',margin:0}}>{eid?'Editar taller':'Nuevo taller'}</h2><button onClick={()=>setSm(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#e5e7eb',color:'#6b7280',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div><form onSubmit={hs} style={{padding:'1.5rem'}}><div style={{marginBottom:'0.75rem'}}><label style={ls}>Nombre</label><input value={fd.nombre} onChange={e=>setFd({...fd,nombre:e.target.value})} required placeholder="Ej: Piano, Guitarra..." style={is}/></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>Tipo</label><div style={{display:'flex',gap:0,background:'#f0f2f5',borderRadius:'10px',border:'1px solid #e5e7eb',overflow:'hidden'}}>{(['taller','instrumento']as const).map(tp=>(<button key={tp} type="button" onClick={()=>setFd({...fd,tipo:tp})} style={{flex:1,padding:'0.5rem',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:fd.tipo===tp?600:400,background:fd.tipo===tp?(tp==='instrumento'?'#fef9e7':'#fefce8'):'transparent',color:fd.tipo===tp?(tp==='instrumento'?'#8b6914':'#d97706'):'var(--color-text-muted)',transition:'all 0.15s'}}>{tp==='instrumento'?'Instrumento':'Taller'}</button>))}</div></div><div style={{marginBottom:'0.75rem'}}><label style={ls}>Descripción</label><textarea value={fd.descripcion} onChange={e=>setFd({...fd,descripcion:e.target.value})} rows={3} style={{...is,resize:'vertical'}}/></div><label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',color:'#475569',cursor:'pointer',marginBottom:'1.25rem'}}><input type="checkbox" checked={fd.activo} onChange={e=>setFd({...fd,activo:e.target.checked})} style={{width:16,height:16,accentColor:'var(--color-primary)'}}/> Taller activo</label><div style={{display:'flex',gap:'0.75rem'}}><button type="button" onClick={()=>setSm(false)} style={{flex:1,padding:'0.625rem',border:'1px solid #e5e7eb',borderRadius:'10px',background:'white',color:'#374151',fontWeight:500,fontSize:'0.875rem',cursor:'pointer'}}>Cancelar</button><Button type="submit" isLoading={sv||saveMutation.isPending} style={{flex:1}}>Guardar</Button></div></form></div></div>)}
    <ConfirmModal isOpen={did!==null} title="Confirmar Eliminación" message="¿Estás seguro de eliminar este taller?" itemName={dn} confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={cd} onCancel={cc} isLoading={sv||deleteMutation.isPending}/>
  </div>);
}
export default memo(TalleresPage);
