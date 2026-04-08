import { useState, useEffect, useMemo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { 
  getEgresos, createEgreso, updateEgreso, deleteEgreso, 
  getResumenEgresos, getProfesores 
} from '../api/endpoints';

const EgresosPage = () => {
  const { cicloActual } = useCiclo();
  const toast = useToast();
  const [egresos, setEgresos] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [resumen, setResumen] = useState<{gasto_taller: number; pago_profesor: number; gasto_personal: number; total: number}>({ gasto_taller: 0, pago_profesor: 0, gasto_personal: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenarPor, setOrdenarPor] = useState('fecha');
  const [ordenDireccion, setOrdenDireccion] = useState<'asc' | 'desc'>('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [egresoEditando, setEgresoEditando] = useState<any>(null);

  // Form state
  const [formTipo, setFormTipo] = useState('gasto_taller');
  const [formMonto, setFormMonto] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formMetodoPago, setFormMetodoPago] = useState('efectivo');
  const [formCategoria, setFormCategoria] = useState('');
  const [formBeneficiario, setFormBeneficiario] = useState('');
  const [formProfesor, setFormProfesor] = useState<number | null>(null);
  const [formEstado, setFormEstado] = useState('pendiente');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (cicloActual) {
      loadData();
    }
  }, [cicloActual]);

  const loadData = async () => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const [egresosRes, resumenRes, profesoresRes] = await Promise.all([
        getEgresos(cicloActual.id),
        getResumenEgresos(cicloActual.id),
        getProfesores(cicloActual.id)
      ]);
      setEgresos(egresosRes.data);
      setResumen(resumenRes.data);
      // DRF pagination: data.results contains the actual array (cast to any to handle paginated vs array)
      const profesData = profesoresRes.data as any;
      setProfesores(profesData.results || profesData || []);
    } catch (error) {
      console.error('Error:', error);
      toast.showToast('Error al cargar egresos', 'error');
    }
    setLoading(false);
  };

  const filteredEgresos = useMemo(() => {
    let result = egresos.filter(e => {
      if (filtroTipo && e.tipo !== filtroTipo) return false;
      if (filtroEstado && e.estado !== filtroEstado) return false;
      return true;
    });
    
    // Ordenar
    result.sort((a, b) => {
      let valA = a[ordenarPor];
      let valB = b[ordenarPor];
      
      if (ordenarPor === 'fecha') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      
      if (valA < valB) return ordenDireccion === 'asc' ? -1 : 1;
      if (valA > valB) return ordenDireccion === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [egresos, filtroTipo, filtroEstado, ordenarPor, ordenDireccion]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual) return;
    setGuardando(true);
    try {
      const data: any = {
        tipo: formTipo,
        monto: parseFloat(formMonto),
        descripcion: formDescripcion,
        fecha: formFecha,
        metodo_pago: formMetodoPago,
        categoria: formCategoria,
        beneficiario: formBeneficiario,
        estado: formEstado
      };
      // Agregar profesor para pago a profesor
      if (formTipo === 'pago_profesor' && formProfesor) {
        data.profesor = formProfesor;
      }
      await createEgreso(data, cicloActual.id);
      toast.showToast('Egreso creado exitosamente', 'success');
      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.showToast(error.response?.data?.detail || 'Error al crear egreso', 'error');
    }
    setGuardando(false);
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!egresoEditando) return;
    setGuardando(true);
    try {
      const data: any = {
        tipo: formTipo,
        monto: parseFloat(formMonto),
        descripcion: formDescripcion,
        fecha: formFecha,
        metodo_pago: formMetodoPago,
        categoria: formCategoria,
        beneficiario: formBeneficiario,
        estado: formEstado
      };
      if (formTipo === 'pago_profesor' && formProfesor) {
        data.profesor = formProfesor;
      }
      await updateEgreso(egresoEditando.id, data);
      toast.showToast('Egreso actualizado exitosamente', 'success');
      setModalOpen(false);
      setEgresoEditando(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.showToast(error.response?.data?.detail || 'Error al actualizar egreso', 'error');
    }
    setGuardando(false);
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este egreso?')) return;
    try {
      await deleteEgreso(id);
      toast.showToast('Egreso eliminado', 'success');
      loadData();
    } catch (error) {
      console.error('Error:', error);
      toast.showToast('Error al eliminar egreso', 'error');
    }
  };

  const abrirEditar = (egreso: any) => {
    setEgresoEditando(egreso);
    setFormTipo(egreso.tipo);
    setFormMonto(String(egreso.monto));
    setFormDescripcion(egreso.descripcion || '');
    setFormFecha(egreso.fecha);
    setFormMetodoPago(egreso.metodo_pago);
    setFormCategoria(egreso.categoria || '');
    setFormBeneficiario(egreso.beneficiario || '');
    setFormProfesor(egreso.profesor);
    setFormEstado(egreso.estado);
    setModalOpen(true);
  };

  const resetForm = () => {
    setFormTipo('gasto_taller');
    setFormMonto('');
    setFormDescripcion('');
    setFormFecha(new Date().toISOString().split('T')[0]);
    setFormMetodoPago('efectivo');
    setFormCategoria('');
    setFormBeneficiario('');
    setFormProfesor(null);
    setFormEstado('pendiente');
  };

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto);
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      gasto_taller: 'Gasto Taller',
      pago_profesor: 'Pago Profesor',
      gasto_personal: 'Gasto Personal'
    };
    return labels[tipo] || tipo;
  };

  const getEstadoLabel = (estado: string) => {
    return estado === 'pendiente' ? 'Pendiente' : 'Cancelado';
  };

  const getEstadoColor = (estado: string) => {
    return estado === 'pendiente' ? '#f59e0b' : '#10b981';
  };

  if (!cicloActual) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Egresos</h1>
          <p style={{ color: '#6b7280' }}>Gestiona los egresos del ciclo {cicloActual.nombre}</p>
        </div>
        <button 
          onClick={() => { resetForm(); setEgresoEditando(null); setModalOpen(true); }}
          style={{ padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)' }}
        >
          + Nuevo Egreso
        </button>
      </div>

      {/* Resumen Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
          <p style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gasto Taller</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#92400e' }}>{formatMonto(resumen.gasto_taller)}</p>
        </div>
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(196, 30, 58, 0.2)' }}>
          <p style={{ fontSize: '0.75rem', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pago Profesor</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>{formatMonto(resumen.pago_profesor)}</p>
        </div>
        <div style={{ background: '#e0e7ff', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
          <p style={{ fontSize: '0.75rem', color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gasto Personal</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3730a3' }}>{formatMonto(resumen.gasto_personal)}</p>
        </div>
        <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(31, 41, 55, 0.3)' }}>
          <p style={{ fontSize: '0.75rem', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d4af37' }}>{formatMonto(resumen.total)}</p>
        </div>
      </div>

      {/* Filtros y Ordenamiento */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select 
          value={filtroTipo} 
          onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', minWidth: '150px' }}
        >
          <option value="">Todos los tipos</option>
          <option value="gasto_taller">Gasto Taller</option>
          <option value="pago_profesor">Pago Profesor</option>
          <option value="gasto_personal">Gasto Personal</option>
        </select>
        <select 
          value={filtroEstado} 
          onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', minWidth: '150px' }}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select 
          value={ordenarPor} 
          onChange={e => setOrdenarPor(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', minWidth: '120px' }}
        >
          <option value="fecha">Ordenar por Fecha</option>
          <option value="monto">Ordenar por Monto</option>
          <option value="descripcion">Ordenar por Descripción</option>
        </select>
        <button 
          onClick={() => setOrdenDireccion(ordenDireccion === 'asc' ? 'desc' : 'asc')}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          {ordenDireccion === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <ResponsiveTable<any>
          columns={[
            { key: 'tipo', label: 'Tipo', render: (e) => getTipoLabel(e.tipo) },
            { key: 'monto', label: 'Monto', align: 'right', render: (e) => <span style={{ fontWeight: 600 }}>{formatMonto(e.monto)}</span> },
            { key: 'descripcion', label: 'Descripción', render: (e) => e.descripcion || '-' },
            { key: 'categoria', label: 'Categoría', render: (e) => e.categoria || '-' },
            { key: 'beneficiario', label: 'Beneficiario', render: (e) => e.beneficiario || e.profesor_nombre || '-' },
            { key: 'fecha', label: 'Fecha', render: (e) => new Date(e.fecha).toLocaleDateString('es-PE') },
            { 
              key: 'estado', 
              label: 'Estado', 
              align: 'center',
              render: (e: any) => (
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: `${getEstadoColor(e.estado)}20`, color: getEstadoColor(e.estado) }}>
                  {getEstadoLabel(e.estado)}
                </span>
              ),
            },
          ]}
          data={loading ? [] : filteredEgresos}
          keyField="id"
          actions={(e) => (
            <>
              <button
                onClick={() => abrirEditar(e)}
                className="touch-target"
                style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Editar
              </button>
              <button
                onClick={() => handleEliminar(e.id)}
                className="touch-target"
                style={{ padding: '0.25rem 0.5rem', border: '1px solid #ef4444', borderRadius: '6px', background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Eliminar
              </button>
            </>
          )}
          emptyMessage={loading ? 'Cargando...' : 'No hay egresos'}
        />
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>{egresoEditando ? 'Editar Egreso' : 'Nuevo Egreso'}</h2>
            <form onSubmit={egresoEditando ? handleEditar : handleCrear}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Tipo</label>
                  <select value={formTipo} onChange={e => setFormTipo(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                    <option value="gasto_taller">Gasto del Taller</option>
                    <option value="pago_profesor">Pago a Profesor</option>
                    <option value="gasto_personal">Gasto de Personal</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Monto</label>
                  <input type="number" step="0.01" value={formMonto} onChange={e => setFormMonto(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Descripción</label>
                  <input type="text" value={formDescripcion} onChange={e => setFormDescripcion(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Fecha</label>
                  <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Método de Pago</label>
                  <select value={formMetodoPago} onChange={e => setFormMetodoPago(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="yape">Yape</option>
                    <option value="plin">Plin</option>
                  </select>
                </div>
                {formTipo === 'gasto_taller' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Categoría</label>
                    <input type="text" value={formCategoria} onChange={e => setFormCategoria(e.target.value)} placeholder="Ej: materiales, equipos, local" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                )}
                {formTipo !== 'pago_profesor' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Beneficiario</label>
                    <input type="text" value={formBeneficiario} onChange={e => setFormBeneficiario(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                )}
                {formTipo === 'pago_profesor' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Profesor</label>
                    <select value={formProfesor || ''} onChange={e => setFormProfesor(e.target.value ? Number(e.target.value) : null)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                      <option value="">Seleccionar profesor</option>
                      {profesores.map(p => (
                        <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Estado</label>
                  <select value={formEstado} onChange={e => setFormEstado(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" disabled={guardando} style={{ flex: 1, padding: '0.625rem', background: '#d4af37', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setModalOpen(false); setEgresoEditando(null); }} style={{ flex: 1, padding: '0.625rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EgresosPage;
