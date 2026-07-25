import { useState, memo } from 'react';

interface MenuOpcionesProps {
  onEditar: () => void;
  onEliminar: () => void;
}

function MenuOpciones({ onEditar, onEliminar }: MenuOpcionesProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setAbierto(!abierto); }}
        style={{ width:'32px',height:'32px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.08)',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontSize:'1.25rem',transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#d4af37'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
      >⋮</button>
      {abierto && (<>
        <div onClick={(e) => { e.stopPropagation(); setAbierto(false); }} style={{ position:'fixed',inset:0,zIndex:10 }}/>
        <div onClick={e => e.stopPropagation()} style={{ position:'absolute',right:0,top:'100%',marginTop:'4px',background:'#1c1c1c',borderRadius:'10px',boxShadow:'0 10px 30px rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.08)',minWidth:'150px',zIndex:20,overflow:'hidden' }}>
          <button onClick={() => { setAbierto(false); onEditar(); }} style={{ width:'100%',padding:'0.6rem 1rem',border:'none',background:'none',textAlign:'left',cursor:'pointer',fontSize:'0.8125rem',color:'#ccc',display:'flex',alignItems:'center',gap:'0.5rem',transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(212,175,55,0.08)'} onMouseLeave={e => e.currentTarget.style.background='none'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
          </button>
          <button onClick={() => { setAbierto(false); onEliminar(); }} style={{ width:'100%',padding:'0.6rem 1rem',border:'none',background:'none',textAlign:'left',cursor:'pointer',fontSize:'0.8125rem',color:'#ef4444',display:'flex',alignItems:'center',gap:'0.5rem',transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.08)'} onMouseLeave={e => e.currentTarget.style.background='none'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Eliminar
          </button>
        </div>
      </>)}
    </div>
  );
}

export default memo(MenuOpciones);
