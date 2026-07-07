import { useState, useEffect, memo, useMemo, useRef } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { Pagination } from '../components/ui/Pagination';
import { getApiBaseUrl } from '../utils/api';
import { useWindowWidth } from '../hooks/useWindowWidth';

/** Fecha de hoy en Lima (YYYY-MM-DD) usando métodos locales del navegador */
function getLimaToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formatea un DateField string (YYYY-MM-DD) a DD/MM/YYYY sin conversión UTC */
function formatReciboDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
}

interface Matricula {
  id: number;
  alumno: number;
  alumno_nombre?: string;
  taller: number;
  taller_nombre: string;
  taller_tipo: string;
  sesiones_contratadas: number;
  precio_total: number;
  activo: boolean;
  estado_calculado?: 'activa' | 'inactiva' | 'concluida' | 'no_procesado';
}

interface Recibo {
  id: number;
  numero: string;
  alumno: number | null;
  alumno_nombre: string;
  alumnos_nombres?: string[];
  matricula_ids?: number[];
  ciclo: number;
  fecha_emision: string;
  monto_bruto: number;
  monto_total: number;
  monto_pagado: number;
  descuento: number;
  paquete_aplicado: string;
  paquete_display: string;
  precio_editado: boolean;
  saldo_pendiente: number;
  estado: string;
}

interface PrecioCalculado {
  precio_bruto: number;
  descuento: number;
  precio_sugerido: number;
  paquete_detectado: string;
  desglose: Array<{
    tipo_taller: string;
    cantidad_clases: number;
    precio: number;
  }>;
  detalles: Array<{
    matricula_id: number;
    alumno: string;
    taller: string;
    taller_tipo: string;
    cantidad_clases: number;
    precio_individual: number;
  }>;
}

interface ReciboFormData {
  fecha_emision: string;
  monto_bruto: string;
  monto_total: string;
  monto_pagado: string;
  descuento: string;
  paquete_aplicado: string;
  precio_editado: boolean;
  estado: string;
  metodo_pago: string;
  matricula_ids: number[];
}

const initialFormData: ReciboFormData = {
  fecha_emision: getLimaToday(),
  monto_bruto: '0',
  monto_total: '0',
  monto_pagado: '0',
  descuento: '0',
  paquete_aplicado: 'individual',
  precio_editado: false,
  estado: 'pendiente',
  metodo_pago: 'efectivo',
  matricula_ids: [],
};

function RecibosPage() {
  const apiBase = getApiBaseUrl();
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroPreset, setFiltroPreset] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ReciboFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [precioCalculado, setPrecioCalculado] = useState<PrecioCalculado | null>(null);
  const [calculandoPrecio, setCalculandoPrecio] = useState(false);
  const [precioEditadoManual, setPrecioEditadoManual] = useState(false);
  const [searchMatricula, setSearchMatricula] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDashboardAmounts, setShowDashboardAmounts] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState<Recibo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [pagado, setPagado] = useState(0);
  const [pendiente, setPendiente] = useState(0);

  const searchRef = useRef(search);
  const filtroRef = useRef(filtroEstado);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { filtroRef.current = filtroEstado; }, [filtroEstado]);

  const fetchData = async (page = 1) => {
    if (!cicloActual) return;
    setCurrentPage(page);
    const token = localStorage.getItem('access_token');
    const s = searchRef.current;
    const fe = filtroRef.current;
    try {
      const params = new URLSearchParams({ ordering: '-id', page: String(page) });
      if (fe !== 'todos') params.set('estado', fe);
      if (s) params.set('search', s);
      const [recibosRes, alumnosRes, matriculasRes] = await Promise.all([
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/recibos/?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/alumnos/?page_size=200`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/matriculas/?estado=no_procesado&page_size=200`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [recibosData, alumnosData, matriculasData] = await Promise.all([
        recibosRes.json(),
        alumnosRes.json(),
        matriculasRes.json()
      ]);
      const recibosArray = recibosData.results || recibosData;
      setRecibos(recibosArray);
      setTotalCount(recibosData.count || 0);
      setTotalPages(Math.ceil((recibosData.count || 0) / 20) || 1);
      setAlumnos((alumnosData.results || alumnosData).filter((a: Alumno) => a.activo));

      // Fetch ALL recibos for dashboard totals (unpaginated)
      const todosRes = await fetch(`${apiBase}/api/ciclos/${cicloActual.id}/recibos/?page_size=500`, { headers: { Authorization: `Bearer ${token}` } });
      const todosData = await todosRes.json();
      const todosArr = todosData.results || todosData;
      setTotal(Array.isArray(todosArr) ? todosArr.reduce((s: number, r: any) => s + Number(r.monto_total || 0), 0) : 0);
      setPagado(Array.isArray(todosArr) ? todosArr.filter((r: any) => r.estado === 'pagado').reduce((s: number, r: any) => s + Number(r.monto_pagado || 0), 0) : 0);
      setPendiente(Array.isArray(todosArr) ? todosArr.filter((r: any) => r.estado === 'pendiente').reduce((s: number, r: any) => s + Number(r.monto_total || 0), 0) : 0);

      // Matriculas ya filtradas por el servidor (?estado=no_procesado = activas sin recibo pagado/pendiente)
      setMatriculas(Array.isArray(matriculasData.results || matriculasData) ? (matriculasData.results || matriculasData) : []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); }, [cicloActual, search, filtroEstado]);

  const filteredRecibos = useMemo(() => {
    let resultado = recibos.filter((r) =>
      r.alumno_nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.numero.toLowerCase().includes(search.toLowerCase()) ||
      (r.alumnos_nombres && r.alumnos_nombres.some(n => n.toLowerCase().includes(search.toLowerCase())))
    );

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(r => r.estado === filtroEstado);
    }

    // Filtro por preset de fecha
    const hoy = new Date();
    const hoyStr = getLimaToday();
    
    if (filtroPreset === 'hoy') {
      resultado = resultado.filter(r => r.fecha_emision === hoyStr);
    } else if (filtroPreset === 'semana') {
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay());
      const inicioStr = `${inicioSemana.getFullYear()}-${String(inicioSemana.getMonth() + 1).padStart(2, '0')}-${String(inicioSemana.getDate()).padStart(2, '0')}`;
      resultado = resultado.filter(r => r.fecha_emision >= inicioStr);
    } else if (filtroPreset === 'mes') {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const inicioStr = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(inicioMes.getDate()).padStart(2, '0')}`;
      resultado = resultado.filter(r => r.fecha_emision >= inicioStr);
    }

    return resultado;
  }, [recibos, search, filtroEstado, filtroPreset]);

  const getAlumnosDisplay = (recibo: Recibo) => {
    if (recibo.alumnos_nombres && recibo.alumnos_nombres.length > 1) {
      const first = recibo.alumnos_nombres[0];
      const remaining = recibo.alumnos_nombres.length - 1;
      return `${first} +${remaining}`;
    }
    return recibo.alumno_nombre;
  };

  const handleViewRecibo = async (recibo: Recibo) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/recibos/${recibo.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRecibo(data);
      }
    } catch (err) {
      console.error('Error fetching receipt details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const calcularPrecioRecomendado = async (matriculaIds: number[]) => {
    if (matriculaIds.length === 0) {
      setPrecioCalculado(null);
      setFormData(prev => ({ ...prev, monto_bruto: '0', monto_total: '0', descuento: '0' }));
      return;
    }

    setCalculandoPrecio(true);
    const token = localStorage.getItem('access_token');
    try {
    const res = await fetch(`${apiBase}/api/recibos/calcular-precio/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matricula_ids: matriculaIds }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Precio calculado:', data);
        setPrecioCalculado(data);
        setFormData(prev => ({
          ...prev,
          monto_bruto: String(data.precio_bruto ?? '0'),
          monto_total: String(data.precio_sugerido ?? '0'),
          descuento: String(data.descuento ?? '0'),
          paquete_aplicado: data.paquete_detectado || 'individual',
        }));
        setPrecioEditadoManual(false);
      } else {
        console.error('Calcular precio error:', res.status, await res.text());
      }
    } catch (err) {
      console.error('Error calculando precio:', err);
    } finally {
      setCalculandoPrecio(false);
    }
  };

  const handleMatriculaToggle = (matriculaId: number) => {
    const newIds = formData.matricula_ids.includes(matriculaId)
      ? formData.matricula_ids.filter(id => id !== matriculaId)
      : [...formData.matricula_ids, matriculaId];

    setFormData(prev => ({ ...prev, matricula_ids: newIds }));
    calcularPrecioRecomendado(newIds);
  };

  const handlePrecioChange = (value: string) => {
    setFormData(prev => ({ ...prev, monto_total: value }));
    setPrecioEditadoManual(true);

    if (precioCalculado) {
      const nuevoDescuento = precioCalculado.precio_bruto - parseFloat(value || '0');
      setFormData(prev => ({
        ...prev,
        monto_total: value,
        descuento: nuevoDescuento.toString(),
        precio_editado: true,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Solo validar matrículas cuando es NUEVO recibo
    if (!cicloActual) return;
    if (!editingId && formData.matricula_ids.length === 0) {
      showApiError('Debe seleccionar al menos una matrícula');
      return;
    }
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = editingId ? `${apiBase}/api/recibos/${editingId}/` : `${apiBase}/api/ciclos/${cicloActual.id}/recibos/`;
      const method = editingId ? 'PATCH' : 'POST';

      const body: any = {
        fecha_emision: formData.fecha_emision,
        monto_bruto: parseFloat(formData.monto_bruto),
        monto_total: parseFloat(formData.monto_total),
        monto_pagado: parseFloat(formData.monto_pagado),
        descuento: parseFloat(formData.descuento),
        paquete_aplicado: formData.paquete_aplicado,
        precio_editado: formData.precio_editado,
        estado: formData.estado,
        metodo_pago: formData.metodo_pago,
        ciclo: cicloActual.id,
        alumno: null,
      };

      // Solo incluir matricula_ids cuando es NUEVO recibo
      if (!editingId) {
        body.matricula_ids = formData.matricula_ids;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData.error || errorData.detail || JSON.stringify(errorData);
          showApiError(errorMsg);
        } catch {
          showApiError(`Error del servidor (${res.status}): ${errorText.substring(0, 200)}`);
        }
        return;
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      setPrecioCalculado(null);
      setPrecioEditadoManual(false);
      setSearchMatricula('');
      fetchData();
    } catch (err) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (recibo: Recibo) => {
    setEditingId(recibo.id);
    setFormData({
      fecha_emision: recibo.fecha_emision,
      monto_bruto: recibo.monto_bruto.toString(),
      monto_total: recibo.monto_total.toString(),
      monto_pagado: recibo.monto_pagado.toString(),
      descuento: recibo.descuento.toString(),
      paquete_aplicado: recibo.paquete_aplicado || 'individual',
      precio_editado: recibo.precio_editado,
      estado: recibo.estado,
      metodo_pago: (recibo as any).metodo_pago || 'efectivo',
      matricula_ids: [],
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ ...initialFormData });
    setPrecioCalculado(null);
    setPrecioEditadoManual(false);
    setSearchMatricula('');
    setShowModal(true);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pagado': return { bg: '#d1fae5', color: '#059669' };
      case 'pendiente': return { bg: '#fef3c7', color: '#b45309' };
      case 'anulado': return { bg: '#f3f4f6', color: '#6b7280' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const getPaqueteLabel = (paquete: string) => {
    const labels: Record<string, string> = {
      'individual': 'Individual',
      'combo_musical_12': 'Combo Musical 12+12',
      'combo_musical_8': 'Combo Musical 8+8',
      'combo_musical_12_8': 'Combo Musical 12+8',
      'mixto_12': 'Mixto 12+12',
      'mixto_8': 'Mixto 8+8',
      'mixto_12_8': 'Mixto 12+8',
      'intensivo_instrumento': 'Intensivo Instrumento',
      'intensivo_taller': 'Intensivo Taller',
    };
    return labels[paquete] || paquete;
  };

  const getAlumnoNombre = (alumnoId: number) => {
    const alumno = alumnos.find(a => a.id === alumnoId);
    return alumno ? `${alumno.apellido}, ${alumno.nombre}` : '';
  };

  const filteredMatriculas = matriculas.filter(m => {
    const alumnoNombre = getAlumnoNombre(m.alumno).toLowerCase();
    const tallerNombre = m.taller_nombre.toLowerCase();
    const searchLower = searchMatricula.toLowerCase();
    return alumnoNombre.includes(searchLower) || tallerNombre.includes(searchLower);
  });

  const matriculasPorAlumno = filteredMatriculas.reduce((acc, m) => {
    if (!acc[m.alumno]) {
      acc[m.alumno] = [];
    }
    acc[m.alumno].push(m);
    return acc;
  }, {} as Record<number, Matricula[]>);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #14b8a6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Recibos</h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#b59410', background: '#fef9e7', padding: '0.2rem 0.65rem', borderRadius: '9999px' }}>{cicloActual?.nombre}</span>
            <button onClick={() => setShowDashboardAmounts(v => !v)} title={showDashboardAmounts ? 'Ocultar montos' : 'Mostrar montos'} style={{ padding: '0.35rem 0.65rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.75rem', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', lineHeight: 1 }}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{showDashboardAmounts ? '👁' : '👁‍🗨'}</span> {showDashboardAmounts ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <div style={{ height: 3, width: 48, background: 'linear-gradient(90deg, #d4af37, #f0d878)', borderRadius: 2, marginTop: '0.5rem' }} />
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{totalCount} recibos</p>
        </div>
        <button onClick={openCreateModal} disabled={matriculas.length === 0}
          style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: 'none', cursor: matriculas.length === 0 ? 'not-allowed' : 'pointer', background: matriculas.length === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #d4af37, #c59b2e)', color: matriculas.length === 0 ? '#9ca3af' : '#0a0a0a', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', boxShadow: matriculas.length === 0 ? 'none' : '0 2px 8px rgba(212,175,55,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Recibo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ecfdf5', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Total</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{showDashboardAmounts ? `S/. ${Number(total||0).toFixed(2)}` : '••••••'}</p>
        </div>
        <div style={{ background: '#fffbeb', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(217,119,6,0.15)' }}>
          <p style={{ color: '#d97706', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Pendiente</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>S/. {Number(pendiente||0).toFixed(2)}</p>
        </div>
        <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Pagado</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{showDashboardAmounts ? `S/. ${Number(pagado||0).toFixed(2)}` : '••••••'}</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Buscar por número o alumno..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }} />
          </div>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white', minWidth: '130px' }}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="pagado">Pagados</option>
            <option value="anulado">Anulados</option>
          </select>
          <select value={filtroPreset} onChange={(e) => setFiltroPreset(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white', minWidth: '140px' }}>
            <option value="todos">Todas las fechas</option>
            <option value="hoy">Del día</option>
            <option value="semana">De la semana</option>
            <option value="mes">Del mes</option>
          </select>
        </div>
        <ResponsiveTable<Recibo>
          columns={[
            {
              key: 'numero',
              label: 'Número',
              render: (r: Recibo) => <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#14b8a6' }}>{r.numero}</span>,
            },
            {
              key: 'alumno',
              label: 'Alumno(s)',
              render: (r: Recibo) => (
                r.alumnos_nombres && r.alumnos_nombres.length > 1 ? (
                  <div style={{ fontWeight: '600', color: '#111827' }}>{getAlumnosDisplay(r)}</div>
                ) : (
                  <div style={{ fontWeight: '600', color: '#111827' }}>{r.alumno_nombre}</div>
                )
              ),
            },
            {
              key: 'fecha',
              label: 'Fecha',
              render: (r: Recibo) => formatReciboDate(r.fecha_emision),
            },
            {
              key: 'paquete',
              label: 'Paquete',
              render: (r: Recibo) => (
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  background: r.paquete_aplicado === 'individual' ? '#f3f4f6' : '#dbeafe',
                  color: r.paquete_aplicado === 'individual' ? '#6b7280' : '#1d4ed8',
                }}>
                  {r.paquete_display || getPaqueteLabel(r.paquete_aplicado)}
                </span>
              ),
            },
            {
              key: 'monto',
              label: 'Monto',
              align: 'right',
              render: (r: Recibo) => (
                <span style={{ fontFamily: 'monospace' }}>
                  S/. {Number(r.monto_total).toFixed(2)}
                  {r.precio_editado && <span style={{ color: '#f59e0b', marginLeft: '0.25rem' }}>*</span>}
                </span>
              ),
            },
            {
              key: 'saldo',
              label: 'Saldo',
              align: 'right',
              render: (r: Recibo) => (
                <span style={{ fontFamily: 'monospace', color: Number(r.saldo_pendiente) > 0 ? '#dc2626' : '#059669' }}>
                  S/. {Number(r.saldo_pendiente).toFixed(2)}
                </span>
              ),
            },
            {
              key: 'estado',
              label: 'Estado',
              align: 'center',
              render: (r: Recibo) => {
                const colors = getEstadoColor(r.estado);
                return (
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: colors.bg, color: colors.color }}>
                    {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                  </span>
                );
              },
            },
          ]}
          data={filteredRecibos}
          keyField="id"
          actions={(r) => (
            <>
              <button
                onClick={() => handleViewRecibo(r)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: '500' }}
              >
                Ver
              </button>
              <button
                onClick={() => handleEdit(r)}
                className="touch-target"
                style={{ background: 'none', border: 'none', color: '#14b8a6', cursor: 'pointer', fontWeight: '500' }}
              >
                Editar
              </button>
            </>
          )}
          emptyMessage="No hay recibos"
        />
        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} onPageChange={(p) => fetchData(p)} />}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{editingId ? 'Editar Recibo' : 'Nuevo Recibo'}</h2>
                {editingId && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.125rem 0 0' }}>N° {recibos.find(r => r.id === editingId)?.numero || '—'}</p>}
              </div>
              <button type="button" onClick={() => { setShowModal(false); setPrecioCalculado(null); setPrecioEditadoManual(false); setSearchMatricula(''); }} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>

              {/* ── Fecha ── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha de emisión</label>
                <input type="date" value={formData.fecha_emision} onChange={e => setFormData({ ...formData, fecha_emision: e.target.value })} required style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', maxWidth: '220px' }} />
              </div>

              {/* ── Matrículas (solo nuevo) ── */}
              {!editingId && (
                <div style={{ marginBottom: '1.25rem', background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matrículas a incluir</span>
                    <span style={{ fontSize: '0.7rem', color: '#d4af37', background: '#fef9e7', padding: '0.15rem 0.6rem', borderRadius: '9999px', fontWeight: 600 }}>{formData.matricula_ids.length} seleccionadas</span>
                  </div>
                  <input type="text" placeholder="Buscar por alumno o taller..." value={searchMatricula} onChange={e => setSearchMatricula(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '0.5rem', fontSize: '0.875rem', background: 'white' }} />
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', maxHeight: '280px', overflow: 'auto', background: 'white' }}>
                    {Object.keys(matriculasPorAlumno).length === 0 ? (
                      <p style={{ padding: '1.5rem', color: '#9ca3af', textAlign: 'center' }}>No hay matrículas activas</p>
                    ) : (
                      Object.entries(matriculasPorAlumno).map(([alumnoId, mats]) => (
                        <div key={alumnoId}>
                          <div style={{ padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: '0.8125rem', color: '#334155' }}>{getAlumnoNombre(parseInt(alumnoId))}</div>
                          {mats.map(m => (
                            <label key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '0.625rem 1rem', borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: formData.matricula_ids.includes(m.id) ? '#f0fdf4' : 'transparent', transition: 'background 0.1s' }}>
                              <input type="checkbox" checked={formData.matricula_ids.includes(m.id)} onChange={() => handleMatriculaToggle(m.id)} style={{ marginRight: '0.75rem', accentColor: '#14b8a6', width: 16, height: 16 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.875rem' }}>{m.taller_nombre}</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.taller_tipo === 'instrumento' ? 'Instrumento' : 'Taller'} · {m.sesiones_contratadas} sesiones</div>
                              </div>
                              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>S/. {m.precio_total}</div>
                            </label>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Precio calculado ── */}
              {calculandoPrecio && <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>Calculando precio recomendado...</div>}
              {precioCalculado && !calculandoPrecio && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem 1.125rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#166534' }}>Precio bruto</span><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>S/. {precioCalculado.precio_bruto.toFixed(2)}</span>
                  </div>
                  {precioCalculado.descuento > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#166534' }}>{getPaqueteLabel(precioCalculado.paquete_detectado)}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#dc2626' }}>-S/. {precioCalculado.descuento.toFixed(2)}</span>
                    </div>
                  )}
                  {precioCalculado.detalles && precioCalculado.detalles.length > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #bbf7d0' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#166534', marginBottom: '0.375rem' }}>Desglose por alumno:</p>
                      {precioCalculado.detalles.map((d, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.125rem' }}>
                          <span style={{ color: '#166534' }}>{d.alumno} - {d.taller} ({d.cantidad_clases})</span>
                          <span style={{ fontFamily: 'monospace', color: '#166534' }}>S/. {d.precio_individual.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #bbf7d0', marginTop: '0.375rem' }}>
                    <span style={{ fontWeight: 600, color: '#166534', fontSize: '0.875rem' }}>Precio sugerido</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem', color: '#059669' }}>S/. {precioCalculado.precio_sugerido.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* ── Montos ── */}
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.125rem', marginBottom: '1.25rem', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.75rem' }}>Montos</span>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Bruto</span>
                    <input type="number" step="0.01" value={formData.monto_bruto} readOnly style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', fontSize: '0.875rem', color: '#6b7280' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Descuento</span>
                    <input type="number" step="0.01" value={formData.descuento} readOnly style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', fontSize: '0.875rem', color: '#dc2626', fontWeight: 500 }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Final {precioEditadoManual && <span style={{ color: '#f59e0b' }}>*</span>}</span>
                    <input type="number" step="0.01" value={formData.monto_total} onChange={e => handlePrecioChange(e.target.value)} required style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 600, border: precioEditadoManual ? '2px solid #f59e0b' : '1px solid #d1d5db', background: precioEditadoManual ? '#fffbeb' : 'white' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Pagado</span>
                    <input type="number" step="0.01" value={formData.monto_pagado} onChange={e => setFormData({ ...formData, monto_pagado: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 600, color: '#059669', border: parseFloat(formData.monto_pagado) >= parseFloat(formData.monto_total) ? '2px solid #10b981' : '1px solid #d1d5db', background: formData.estado === 'pagado' ? '#f0fdf4' : 'white' }} />
                  </div>
                </div>
                {editingId && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saldo pendiente</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9375rem', color: parseFloat(formData.monto_total) - parseFloat(formData.monto_pagado) > 0 ? '#dc2626' : '#059669' }}>S/. {(parseFloat(formData.monto_total) - parseFloat(formData.monto_pagado)).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* ── Estado y Método de Pago ── */}
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.125rem', marginBottom: '1.5rem', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.75rem' }}>Estado del pago</span>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Estado</span>
                    <select value={formData.estado} onChange={e => { const ne = e.target.value; if (ne === 'pagado') setFormData(prev => ({ ...prev, estado: ne, monto_pagado: prev.monto_total })); else setFormData({ ...formData, estado: ne }); }} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}>
                      <option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="anulado">Anulado</option>
                    </select>
                    {formData.estado === 'pagado' && <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.25rem' }}>✓ Pago completo</div>}
                    {formData.estado === 'anulado' && <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>Este recibo fue anulado</div>}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Método de pago</span>
                    <select value={formData.metodo_pago} onChange={e => setFormData({ ...formData, metodo_pago: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}>
                      <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="yape">Yape</option><option value="plin">Plin</option><option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Acciones ── */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setShowModal(false); setPrecioCalculado(null); setPrecioEditadoManual(false); setSearchMatricula(''); }} style={{ padding: '0.75rem 1.5rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem', color: '#374151' }}>Cancelar</button>
                {editingId && formData.estado === 'pendiente' && (
                  <button type="button" onClick={() => { setFormData(prev => ({ ...prev, estado: 'pagado', monto_pagado: prev.monto_total })); }} style={{ padding: '0.75rem 1.5rem', background: '#d1fae5', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', color: '#059669', fontSize: '0.875rem' }}>Marcar Pagado</button>
                )}
                {editingId && formData.estado !== 'anulado' && (
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, estado: 'anulado' }))} style={{ padding: '0.75rem 1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: 500, cursor: 'pointer', color: '#dc2626', fontSize: '0.875rem' }}>Anular</button>
                )}
                <button type="submit" disabled={saving || (!editingId && formData.matricula_ids.length === 0)} style={{ marginLeft: 'auto', padding: '0.75rem 2rem', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', color: 'white', cursor: (saving || (!editingId && formData.matricula_ids.length === 0)) ? 'not-allowed' : 'pointer', background: (saving || (!editingId && formData.matricula_ids.length === 0)) ? '#94a3b8' : 'linear-gradient(135deg, #14b8a6, #0d9488)', boxShadow: (saving || (!editingId && formData.matricula_ids.length === 0)) ? 'none' : '0 2px 8px rgba(20,184,166,0.3)' }}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear recibo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            {loadingDetail ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><div style={{ width: 40, height: 40, border: '3px solid #f1f5f9', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
            ) : selectedRecibo ? (<>
              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Recibo {selectedRecibo.numero}</h2>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600, background: getEstadoColor(selectedRecibo.estado).bg, color: getEstadoColor(selectedRecibo.estado).color }}>{selectedRecibo.estado.charAt(0).toUpperCase() + selectedRecibo.estado.slice(1)}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{formatReciboDate(selectedRecibo.fecha_emision)}</p>
                  {(selectedRecibo as any).updated_at && selectedRecibo.estado !== 'pendiente' && (
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '2px 0 0' }}>
                      {selectedRecibo.estado === 'pagado' ? 'Completado' : 'Anulado'} el {new Date((selectedRecibo as any).updated_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {(selectedRecibo as any).metodo_pago && (
                    <span style={{ display: 'inline-block', marginTop: '0.375rem', padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 500, background: '#f1f5f9', color: '#64748b' }}>
                      {(selectedRecibo as any).metodo_pago === 'efectivo' ? 'Efectivo' : (selectedRecibo as any).metodo_pago === 'transferencia' ? 'Transferencia' : (selectedRecibo as any).metodo_pago === 'tarjeta' ? 'Tarjeta' : (selectedRecibo as any).metodo_pago === 'yape' ? 'Yape' : (selectedRecibo as any).metodo_pago === 'plin' ? 'Plin' : (selectedRecibo as any).metodo_pago}
                    </span>
                  )}
                </div>
                <button onClick={() => { setShowDetailModal(false); setSelectedRecibo(null); }} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                {/* Alumnos */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: 4, height: 14, borderRadius: 2, background: '#d4af37' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alumno(s)</span>
                  </div>
                  {selectedRecibo.alumnos_nombres && selectedRecibo.alumnos_nombres.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {selectedRecibo.alumnos_nombres.map((nombre, idx) => (
                        <span key={idx} style={{ padding: '0.35rem 0.65rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 500, color: '#334155', border: '1px solid #f1f5f9' }}>{nombre}</span>
                      ))}
                    </div>
                  ) : selectedRecibo.alumno_nombre ? (
                    <span style={{ padding: '0.35rem 0.65rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 500, color: '#334155', border: '1px solid #f1f5f9' }}>{selectedRecibo.alumno_nombre}</span>
                  ) : (
                    <p style={{ color: '#cbd5e1', fontSize: '0.8125rem' }}>Sin alumno específico</p>
                  )}
                </div>

                {/* Matrículas */}
                {(selectedRecibo as any).matriculas_detalle && (selectedRecibo as any).matriculas_detalle.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: 4, height: 14, borderRadius: 2, background: '#7c3aed' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matrículas</span>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={th}>Alumno</th><th style={th}>Taller</th><th style={{ ...th, width: 60, textAlign: 'center' }}>Ses.</th><th style={{ ...th, textAlign: 'right' }}>Monto</th></tr></thead>
                        <tbody>{(selectedRecibo as any).matriculas_detalle.map((m: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ ...td, fontWeight: 500 }}>{m.alumno_nombre}</td>
                            <td style={td}>{m.taller_nombre}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{m.sesiones_contratadas}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>S/. {Number(m.monto).toFixed(2)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Montos */}
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem 1.125rem', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#64748b' }}>Monto Bruto</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#334155' }}>S/. {Number(selectedRecibo.monto_bruto || 0).toFixed(2)}</span>
                  </div>
                  {Number(selectedRecibo.descuento) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8125rem', padding: '0.25rem 0.5rem', background: '#fef2f2', borderRadius: '6px' }}>
                      <span style={{ color: '#dc2626', fontWeight: 500 }}>Descuento</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#dc2626' }}>-S/. {Number(selectedRecibo.descuento).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', marginBottom: '0.375rem', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>Total</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>S/. {Number(selectedRecibo.monto_total).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#64748b' }}>Pagado</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>S/. {Number(selectedRecibo.monto_pagado || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>Saldo Pendiente</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(selectedRecibo.saldo_pendiente) > 0 ? '#dc2626' : '#059669', fontSize: '0.9375rem' }}>S/. {Number(selectedRecibo.saldo_pendiente || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Paquete */}
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: selectedRecibo.precio_editado ? '#fef9e7' : '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.7rem', color: selectedRecibo.precio_editado ? '#8b6914' : '#94a3b8' }}>
                    Paquete: <strong style={{ color: selectedRecibo.precio_editado ? '#5c4508' : '#64748b' }}>{getPaqueteLabel(selectedRecibo.paquete_aplicado)}</strong>
                    {selectedRecibo.precio_editado && ' · Precio editado'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #f3f4f6' }}>
                <button onClick={() => { setShowDetailModal(false); setSelectedRecibo(null); }} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem' }}>Cerrar</button>
              </div>
            </>) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Error al cargar</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RecibosPage);

const th: React.CSSProperties = { padding: '0.4rem 0.65rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '0.4rem 0.65rem', fontSize: '0.8125rem', color: '#334155' };
