import { useState, useEffect, useMemo } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { useToast } from '../../contexts/ToastContext';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { getApiBaseUrl } from '../../utils/api';
import { formatMonto } from '../../utils/formatters';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import {
  createHoraTrabajada, updateHoraTrabajada,
  deleteHoraTrabajada,
} from '../../api/endpoints';

const TABS = [
  { key: 'horas', label: 'Horas Trabajadas' },
  { key: 'calcular', label: 'Calcular Pago' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ── types ──
interface ResultadoPago {
  profesor_id: number;
  profesor: string;
  pago_id: number;
  clases_dictadas: number;
  total_alumnos_asistencias: number;
  monto_profesor: number;
  ganancia_taller: number;
}
interface DetalleClase {
  id: number; horario: number; horario_info: string; fecha: string;
  profesor_id?: number; profesor_nombre?: string;
  num_alumnos: number;
  valor_generado: number; monto_base: number; monto_adicional: number;
  monto_profesor: number; ganancia_taller: number;
}

const fmt = (v: number) => v.toFixed(2);

function HorasProfesoresPage() {
  const apiBase = getApiBaseUrl();
  const { cicloActual } = useCiclo();
  const { showToast } = useToast();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [activeTab, setActiveTab] = useState<TabKey>('horas');

  // ═══ Horas Trabajadas state ═══
  const [horas, setHoras] = useState<any[]>([]);
  const [hTalleres, setHTalleres] = useState<any[]>([]);
  const [hProfesores, setHProfesores] = useState<any[]>([]);
  const [hLoading, setHLoading] = useState(true);
  const [hPage, setHPage] = useState(1);
  const [hTotalPages, setHTotalPages] = useState(1);
  const [hTallerId, setHTallerId] = useState<number | string>('');
  const getLimaToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [hDesde, setHDesde] = useState(() => getLimaToday());
  const [hHasta, setHHasta] = useState(() => getLimaToday());
  const [hModal, setHModal] = useState(false);
  const [hEditando, setHEditando] = useState<any>(null);

  // Form state
  const [formTallerId, setFormTallerId] = useState<number | string>('');
  const [formHorarios, setFormHorarios] = useState<any[]>([]);
  const [hFormHorario, setHFormHorario] = useState<number | null>(null);
  const [hFormProf, setHFormProf] = useState<number | null>(null);
  const [hFormFecha, setHFormFecha] = useState(() => getLimaToday());
  const [hFormMonto, setHFormMonto] = useState('');
  const [hGuardando, setHGuardando] = useState(false);

  const groupedHorarios = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const h of formHorarios) {
      const dia = h.dia_nombre || `Día ${h.dia_semana}`;
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia)!.push(h);
    }
    return Array.from(map.entries());
  }, [formHorarios]);

  // ═══ Calcular Pago state ═══
  const [resultados, setResultados] = useState<ResultadoPago[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [selectedPago, setSelectedPago] = useState<ResultadoPago | null>(null);
  const [detalles, setDetalles] = useState<DetalleClase[]>([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [detallesCompletos, setDetallesCompletos] = useState<Record<string, any>>({});
  const [loadingAlumnos, setLoadingAlumnos] = useState<Set<string>>(new Set());
  const [cFechaInicio, setCFechaInicio] = useState('');
  const [cFechaFin, setCFechaFin] = useState('');
  const [orden, setOrden] = useState('az');

  // ── Horas Trabajadas: data ──
  const fetchHoras = async (pageNum = 1, desde?: string, hasta?: string) => {
    if (!cicloActual) return;
    setHLoading(true);
    const token = localStorage.getItem('access_token');
    const params = [`page=${pageNum}`];
    if (hTallerId) params.push(`horario__taller=${hTallerId}`);
    const d = desde ?? hDesde;
    const h = hasta ?? hHasta;
    if (d) params.push(`fecha__gte=${d}`);
    if (h) params.push(`fecha__lte=${h}`);
    const url = `${apiBase}/api/ciclos/${cicloActual.id}/horas-trabajadas/?${params.join('&')}`;
    try {
      const [horasRes, talleresRes, profesoresRes] = await Promise.all([
        fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/talleres/?page=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/ciclos/${cicloActual.id}/profesores/?page=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const hData = await horasRes.json();
      const results = hData.results ?? hData;
      setHoras(results);
      setHTotalPages(Math.ceil((hData.count ?? 0) / 20) || 1);
      const tData = await talleresRes.json();
      setHTalleres(tData.results ?? tData ?? []);
      const pData = await profesoresRes.json();
      setHProfesores(pData.results ?? pData ?? []);
    } catch { showToast('Error al cargar horas', 'error'); }
    setHLoading(false);
  };

  useEffect(() => { setHPage(1); fetchHoras(1); }, [hTallerId]); // auto-fetch solo al cambiar taller
  useEffect(() => { if (cicloActual) fetchHoras(hPage); }, [cicloActual, hPage]);

  // ── Load horarios when taller changes in form ──
  useEffect(() => {
    if (!formTallerId || !cicloActual) {
      setFormHorarios([]);
      setHFormHorario(null);
      setHFormProf(null);
      return;
    }
    const token = localStorage.getItem('access_token');
    fetch(`${apiBase}/api/ciclos/${cicloActual.id}/horarios/?taller=${formTallerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const list = data.results ?? data ?? [];
        setFormHorarios(list);
        // Auto-select first horario and set profesor
        if (list.length > 0) {
          setHFormHorario(list[0].id);
          setHFormProf(list[0].profesor ?? null);
        } else {
          setHFormHorario(null);
          setHFormProf(null);
        }
      })
      .catch(() => showToast('Error al cargar horarios', 'error'));
  }, [formTallerId, cicloActual, apiBase, showToast]);

  // ── Update profesor name when horario changes ──
  useEffect(() => {
    if (!hFormHorario) {
      setHFormProf(null);
      return;
    }
    const selected = formHorarios.find((h: any) => h.id === hFormHorario);
    if (selected) {
      setHFormProf(selected.profesor ?? null);
    }
  }, [hFormHorario, formHorarios]);

  // ── Horas Trabajadas: actions ──
  const hResetForm = () => {
    setFormTallerId('');
    setHFormHorario(null);
    setHFormProf(null);
    setHFormFecha(getLimaToday());
    setHFormMonto('');
  };
  const handleHCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setHGuardando(true);
    try {
      await createHoraTrabajada({
        ciclo: cicloActual!.id,
        profesor: hFormProf!,
        horario: hFormHorario!,
        fecha: hFormFecha,
        horas_trabajadas: 1,
        monto_profesor: parseFloat(hFormMonto),
      });
      showToast('Hora creada', 'success'); setHModal(false); hResetForm(); fetchHoras(hPage);
    } catch (err: any) { showToast(err?.response?.data?.detail || 'Error', 'error'); }
    setHGuardando(false);
  };
  const handleHEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    setHGuardando(true);
    try {
      await updateHoraTrabajada(hEditando.id, {
        profesor: hFormProf!,
        horario: hFormHorario!,
        fecha: hFormFecha,
        horas_trabajadas: 1,
        monto_profesor: parseFloat(hFormMonto),
      });
      showToast('Hora actualizada', 'success'); setHModal(false); setHEditando(null); hResetForm(); fetchHoras(hPage);
    } catch (err: any) { showToast(err?.response?.data?.detail || 'Error', 'error'); }
    setHGuardando(false);
  };
  const handleHEliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar esta hora?')) return;
    try { await deleteHoraTrabajada(id); showToast('Eliminada', 'success'); fetchHoras(hPage); }
    catch { showToast('Error', 'error'); }
  };
  const abrirEditarHora = async (h: any) => {
    setHEditando(h);
    // Load the horario's taller to set the filter
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/horarios/${h.horario}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const horarioData = await res.json();
      setFormTallerId(horarioData.taller);
    } catch { /* use fallback */ }
    setHFormHorario(h.horario);
    setHFormProf(h.profesor ?? null);
    setHFormFecha(h.fecha);
    setHFormMonto(String(h.monto_profesor ?? ''));
    setHModal(true);
  };

  // ── Calcular Pago: actions ──
  const handleCalcular = async () => {
    if (!cFechaInicio || !cFechaFin) { showToast('Seleccioná fechas', 'error'); return; }
    setCalculando(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/pagos-profesores/calcular-periodo/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ciclo_id: cicloActual!.id, fecha_inicio: cFechaInicio, fecha_fin: cFechaFin, regenerar_horas: 'true' }),
      });
      const data = await res.json();
      setResultados((data.resultados ?? []).map((r: any) => ({
        profesor_id: r.profesor_id, profesor: r.profesor, pago_id: r.pago_id,
        clases_dictadas: r.clases_dictadas, total_alumnos_asistencias: r.total_alumnos_asistencias,
        monto_profesor: r.monto_profesor, ganancia_taller: r.ganancia_taller,
        fecha_inicio: cFechaInicio, fecha_fin: cFechaFin,
      })));
      showToast('Cálculo completado', 'success');
    } catch { showToast('Error al calcular', 'error'); }
    setCalculando(false);
  };
  const handleVerDetalle = async (r: ResultadoPago) => {
    setSelectedPago(r); setLoadingDetalles(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBase}/api/pagos-profesores/${r.pago_id}/detalles/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDetalles(Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : (data.detalles || [])));
    } catch { showToast('Error al cargar detalle', 'error'); }
    setLoadingDetalles(false);
  };

  const toggleRowExpansion = async (detalle: DetalleClase) => {
    const key = `${detalle.horario}-${detalle.fecha}`;
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) { newExpanded.delete(key); }
    else {
      newExpanded.add(key);
      if (!detallesCompletos[key]) {
        setLoadingAlumnos(prev => new Set(prev).add(key));
        const token = localStorage.getItem('access_token');
        const profParam = detalle.profesor_id ? `&profesor_id=${detalle.profesor_id}` : '';
        try {
          const res = await fetch(`${apiBase}/api/pagos-profesores/detalle-clase/?horario_id=${detalle.horario}&fecha=${detalle.fecha}${profParam}`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          setDetallesCompletos(prev => ({ ...prev, [key]: data }));
        } catch { }
        setLoadingAlumnos(prev => { const n = new Set(prev); n.delete(key); return n; });
      }
    }
    setExpandedRows(newExpanded);
  };

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DetalleClase[]>();
    for (const d of detalles) {
      const list = map.get(d.fecha) || [];
      list.push(d);
      map.set(d.fecha, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [detalles]);

  const formatDateElegant = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // orden
  const resultadosSorted = useMemo(() => {
    const arr = [...resultados];
    if (orden === 'az') arr.sort((a, b) => a.profesor.localeCompare(b.profesor));
    else if (orden === 'za') arr.sort((a, b) => b.profesor.localeCompare(a.profesor));
    else if (orden === 'mas_clases') arr.sort((a, b) => b.clases_dictadas - a.clases_dictadas);
    else arr.sort((a, b) => a.clases_dictadas - b.clases_dictadas);
    return arr;
  }, [resultados, orden]);

  const totalMonto = resultados.reduce((s, r) => s + r.monto_profesor, 0);
  const totalGanancia = resultados.reduce((s, r) => s + r.ganancia_taller, 0);
  const totalClases = resultados.reduce((s, r) => s + r.clases_dictadas, 0);

  // ── render ──
  return (
    <div style={{maxWidth:'1100px',margin:'0 auto'}}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Horas Profesores</h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#b59410', background: '#fef9e7', padding: '0.2rem 0.65rem', borderRadius: '9999px' }}>{cicloActual?.nombre}</span>
          </div>
          <div style={{ height: 3, width: 48, background: 'linear-gradient(90deg, #d4af37, #f0d878)', borderRadius: 2, marginTop: '0.5rem' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.75rem', borderBottom: '1.5px solid #e5e7eb' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className="touch-target"
            style={{ padding: '0.625rem 1.125rem', minHeight: '44px', background: 'none', border: 'none', borderBottom: activeTab === t.key ? '2px solid #d4af37' : '2px solid transparent', color: activeTab === t.key ? '#0f172a' : '#6b7280', fontWeight: activeTab === t.key ? 600 : 400, fontSize: '0.875rem', cursor: 'pointer', marginBottom: '-1.5px', transition: 'color 0.15s, border-color 0.15s' }}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════ TAB: Horas Trabajadas ═══════════ */}
      {activeTab === 'horas' && (
        <>
          {/* Filters */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={hTallerId} onChange={e => setHTallerId(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', minWidth: '140px', background: 'white' }}>
              <option value="">Todos los talleres</option>
              {hTalleres.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <input type="date" value={hDesde} onChange={e => setHDesde(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }} />
            <span style={{ color: '#94a3b8' }}>—</span>
            <input type="date" value={hHasta} onChange={e => setHHasta(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem' }} />
            <button onClick={() => { setHPage(1); fetchHoras(1); }} style={{ padding: '0.5rem 0.75rem', background: '#d4af37', color: '#0a0a0a', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>Buscar</button>
            <button onClick={() => { const hoy = getLimaToday(); setHDesde(hoy); setHHasta(hoy); setHPage(1); fetchHoras(1, hoy, hoy); }} style={{ padding: '0.5rem 0.75rem', background: 'white', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '10px', fontWeight: 500, fontSize: '0.8125rem', cursor: 'pointer' }}>Limpiar</button>
            <button onClick={() => { hResetForm(); setHEditando(null); setHModal(true); }} style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg,#d4af37,#c59b2e)', color: '#0a0a0a', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Hora</button>
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <ResponsiveTable
              columns={[
                { key: 'profesor_nombre', label: 'Profesor', render: (h: any) => <span style={{ fontWeight: 600, color:'#0f172a' }}>{h.profesor_nombre ?? '-'}</span> },
                { key: 'horario_info', label: 'Horario', render: (h: any) => <span style={{ fontSize: '0.8125rem', color:'#64748b' }}>{h.horario_info ?? '-'}</span> },
                { key: 'fecha', label: 'Fecha', render: (h: any) => h.fecha.split('-').reverse().join('/') },
                { key: 'num_alumnos', label: 'Alumnos', align: 'center', render: (h: any) => h.num_alumnos ?? 0 },
                { key: 'monto_profesor', label: 'Monto', align: 'right', render: (h: any) => <span style={{ fontWeight: 600 }}>{formatMonto(h.monto_profesor ?? 0)}</span> },
              ]}
              data={hLoading ? [] : horas}
              keyField="id"
              actions={(h) => {
                const isAuto = h.created_from === 'asistencia_auto';
                if (isAuto) return null;
                return (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => abrirEditarHora(h)} style={{ padding: '0.25rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', fontSize: '0.75rem', cursor: 'pointer', color: '#d4af37' }}>Editar</button>
                    <button onClick={() => handleHEliminar(h.id)} style={{ padding: '0.25rem 0.5rem', border: '1px solid #ef4444', borderRadius: '6px', background: 'white', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}>Eliminar</button>
                  </div>
                );
              }}
              emptyMessage={hLoading ? 'Cargando...' : 'No hay horas trabajadas'}
            />
          </div>
          {/* Horas pagination */}
          {hTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
              <button disabled={hPage <= 1} onClick={() => setHPage(p => p - 1)} className="touch-target" style={{ padding: '0.4rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151' }}>← Anterior</button>
              <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Pág. {hPage} de {hTotalPages}</span>
              <button disabled={hPage >= hTotalPages} onClick={() => setHPage(p => p + 1)} className="touch-target" style={{ padding: '0.4rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151' }}>Siguiente →</button>
            </div>
          )}
        </>
      )}

      {/* ═══════════ TAB: Calcular Pago ═══════════ */}
      {activeTab === 'calcular' && (
        <>
          {/* Filter card */}
          <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '1.125rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.2rem' }}>Fecha Inicio</span>
              <input type="date" value={cFechaInicio} onChange={e => setCFechaInicio(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.2rem' }}>Fecha Fin</span>
              <input type="date" value={cFechaFin} onChange={e => setCFechaFin(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white' }} />
            </div>
            <button onClick={handleCalcular} disabled={calculando || !cicloActual} style={{ padding: '0.5rem 1rem', background: calculando ? '#e5e7eb' : '#d4af37', color: calculando ? '#9ca3af' : '#0a0a0a', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', cursor: (calculando || !cicloActual) ? 'not-allowed' : 'pointer' }}>{calculando ? 'Calculando...' : 'Calcular Pagos'}</button>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.2rem' }}>Ordenar</span>
              <select value={orden} onChange={e => setOrden(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', background: 'white' }}>
                <option value="az">Profesor (A-Z)</option>
                <option value="za">Profesor (Z-A)</option>
                <option value="mas_clases">Más clases</option>
                <option value="menos_clases">Menos clases</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          {resultados.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#f5f3ff', padding: '1rem 1.125rem', borderRadius: '14px', border: '1px solid #ede9fe' }}>
                <p style={{ color: '#7c3aed', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>Clases Dictadas</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#5b21b6', lineHeight: 1.2 }}>{totalClases}</p>
              </div>
              <div style={{ background: '#ecfdf5', padding: '1rem 1.125rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.15)' }}>
                <p style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>Total a Pagar</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>S/. {fmt(totalMonto)}</p>
              </div>
              <div style={{ background: '#fef9e7', padding: '1rem 1.125rem', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.2)' }}>
                <p style={{ color: '#8b6914', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>Ganancia Taller</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>S/. {fmt(totalGanancia)}</p>
              </div>
            </div>
          )}

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <ResponsiveTable<ResultadoPago>
              columns={[
                { key: 'profesor', label: 'Profesor', render: r => <span style={{ fontWeight: 600, color: '#111827' }}>{r.profesor}</span> },
                { key: 'clases_dictadas', label: 'Clases', align: 'center', render: r => <span style={{ background: '#eef2ff', color: '#4338ca', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>{r.clases_dictadas}</span> },
                { key: 'monto_profesor', label: 'Monto', align: 'right', render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>S/. {fmt(r.monto_profesor)}</span> },
                { key: 'ganancia_taller', label: 'Ganancia', align: 'right', render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#d97706' }}>S/. {fmt(r.ganancia_taller)}</span> },
              ]}
              data={resultadosSorted}
              keyField="pago_id"
              actions={r => (
                <button onClick={() => handleVerDetalle(r)} className="touch-target" style={{ background: '#d4af37', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#0a0a0a', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Ver Detalle</button>
              )}
              emptyMessage="No hay pagos calculados. Seleccioná fechas y clic en Calcular Pagos"
            />
          </div>

          {/* Detail modal */}
          {selectedPago && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ background: 'white', borderRadius: '12px', margin: '0 auto', maxWidth: '950px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: 0 }}>{selectedPago.profesor}</h2>
                    <p style={{ fontSize: '0.8125rem', color: '#a5b4fc', margin: '0.125rem 0 0' }}>Clases del período</p>
                  </div>
                  <button onClick={() => { setSelectedPago(null); setExpandedRows(new Set()); setDetallesCompletos({}); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: 'white', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
                </div>
                {/* Summary */}
                <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '0.75rem' }}>
                  {[{l:'Clases',v:selectedPago.clases_dictadas,c:'#4338ca'},{l:'Asistencias',v:selectedPago.total_alumnos_asistencias,c:'#a855f7'},{l:'Total Profesor',v:`S/. ${fmt(selectedPago.monto_profesor)}`,c:'#059669'},{l:'Ganancia Taller',v:`S/. ${fmt(selectedPago.ganancia_taller)}`,c:'#d97706'}].map(s => (
                    <div key={s.l} style={{ textAlign: 'center', padding: '0.5rem', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {/* Class list — grouped by date */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                  {loadingDetalles ? <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando...</div>
                  : detalles.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Sin detalles</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {groupedByDate.map(([fecha, clases]) => {
                      const dateKey = fecha;
                      const isDateExpanded = expandedRows.has(dateKey);
                      const dayTotal = clases.reduce((s, c) => s + Number(c.monto_profesor), 0);
                      const dayAlumnos = clases.reduce((s, c) => s + c.num_alumnos, 0);
                      const dayClases = clases.length;
                      return (
                        <div key={fecha} style={{ border: isDateExpanded ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                          {/* Date header */}
                          <div onClick={() => {
                            const n = new Set(expandedRows);
                            n.has(dateKey) ? n.delete(dateKey) : n.add(dateKey);
                            setExpandedRows(n);
                          }} style={{ padding: '0.625rem 1rem', cursor: 'pointer', display: 'grid', gridTemplateColumns: '100px 1fr 60px 90px 30px', gap: '0.5rem', alignItems: 'center', background: isDateExpanded ? '#f5f3ff' : '#f8fafc', fontSize: '0.8125rem' }}>
                            <span style={{ fontWeight: 700, color: '#111827' }}>{formatDateElegant(fecha)}</span>
                            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{dayClases} clase{dayClases !== 1 ? 's' : ''}</span>
                            <span style={{ textAlign: 'center' }}><span style={{ background: '#fdf4ff', color: '#a855f7', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>{dayAlumnos} alum.</span></span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669', fontSize: '0.85rem' }}>S/. {fmt(dayTotal)}</span>
                            <span style={{ textAlign: 'center', color: '#6366f1' }}>{isDateExpanded ? '▲' : '▼'}</span>
                          </div>
                          {/* Expanded: individual classes within date */}
                          {isDateExpanded && (
                            <div style={{ borderTop: '1px solid #e5e7eb' }}>
                              {clases.map(d => {
                                const key = `${d.horario}-${d.fecha}`;
                                const isExpanded = expandedRows.has(key);
                                const dc = detallesCompletos[key];
                                return (
                                  <div key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <div onClick={() => toggleRowExpansion(d)} style={{ padding: '0.5rem 1rem 0.5rem 2rem', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 80px 30px', gap: '0.5rem', alignItems: 'center', background: isExpanded ? '#f5f3ff' : 'white', fontSize: '0.8125rem' }}>
                                      <span style={{ color: '#6b7280' }}>{d.horario_info}</span>
                                      <span style={{ textAlign: 'center' }}><span style={{ background: '#eef2ff', color: '#4338ca', padding: '0.15rem 0.4rem', borderRadius: '9999px', fontSize: '0.75rem' }}>{d.num_alumnos}</span></span>
                                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>S/. {fmt(Number(d.monto_base))}</span>
                                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>+S/. {fmt(Number(d.monto_adicional))}</span>
                                      <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>S/. {fmt(Number(d.monto_profesor))}</span>
                                      <span style={{ textAlign: 'center', color: '#6366f1' }}>{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                    {isExpanded && (
                                      <div style={{ padding: '0.75rem 1rem 0.75rem 2rem', background: '#fafafa' }}>
                                        {loadingAlumnos.has(key) ? <div style={{ textAlign: 'center', color: '#6b7280', padding: '0.5rem' }}>Cargando...</div>
                                        : dc ? (
                                          <>
                                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap' }}>
                                              <span>Total: <strong style={{ color: '#111827' }}>S/. {fmt(dc.resumen?.valor_total_generado ?? 0)}</strong></span>
                                              <span>Base: <strong style={{ color: '#111827' }}>S/. {fmt(dc.resumen?.monto_base ?? 0)}</strong></span>
                                              <span>Adicional: <strong style={{ color: '#111827' }}>S/. {fmt(dc.resumen?.monto_adicional ?? 0)}</strong></span>
                                              <span>Ganancia: <strong style={{ color: '#d97706' }}>S/. {fmt(dc.resumen?.ganancia_taller ?? 0)}</strong></span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                                              {(dc.alumnos ?? []).map((a: any, i: number) => (
                                                <div key={a.alumno_id ?? i} style={{ background: 'white', borderRadius: '8px', padding: '0.625rem', border: '2px solid', borderColor: a.es_adicional ? '#fcd34d' : '#86efac' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                                                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{a.alumno_nombre}</span>
                                                    {a.es_adicional && <span style={{ fontSize: '0.6rem', background: '#fef3c7', color: '#b45309', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>+50%</span>}
                                                  </div>
                                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.7rem' }}>
                                                    <div>Sesión: <span style={{ fontFamily: 'monospace' }}>S/. {fmt(a.precio_sesion ?? 0)}</span></div>
                                                    <div>A profe: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>S/. {fmt(a.aporte_profesor ?? 0)}</span></div>
                                                    <div>Taller: <span style={{ fontFamily: 'monospace', color: '#d97706' }}>S/. {fmt((a.aporte_generado ?? 0) - (a.aporte_profesor ?? 0))}</span></div>
                                                    <div>Generado: <span style={{ fontFamily: 'monospace' }}>S/. {fmt(a.aporte_generado ?? 0)}</span></div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </>
                                        ) : <div style={{ textAlign: 'center', color: '#9ca3af', padding: '0.5rem' }}>Sin datos de alumnos</div>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Horas modal (create/edit) ── */}
      {hModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', margin: '0 auto', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>{hEditando ? 'Editar Hora' : 'Nueva Hora Trabajada'}</h2>
            <form onSubmit={hEditando ? handleHEditar : handleHCrear} style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Taller</label>
                <select value={formTallerId} onChange={e => setFormTallerId(e.target.value ? Number(e.target.value) : '')} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                  <option value="">Seleccionar taller</option>
                  {hTalleres.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Horario</label>
                <select value={hFormHorario ?? ''} onChange={e => setHFormHorario(e.target.value ? Number(e.target.value) : null)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                  <option value="">Seleccionar horario</option>
                  {groupedHorarios.map(([dia, horarios]) => (
                    <optgroup key={dia} label={dia}>
                      {horarios.map((h: any) => (
                        <option key={h.id} value={h.id}>
                          {h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Profesor</label>
                <select value={hFormProf ?? ''} onChange={e => setHFormProf(e.target.value ? Number(e.target.value) : null)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                  <option value="">Seleccionar profesor</option>
                  {hProfesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Fecha</label>
                <input type="date" value={hFormFecha} onChange={e => setHFormFecha(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Monto</label>
                <input type="number" step="0.01" min="0.01" value={hFormMonto} onChange={e => setHFormMonto(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" disabled={hGuardando} style={{ flex: 1, padding: '0.625rem', background: hGuardando ? '#e5e7eb' : '#d4af37', color: hGuardando ? '#9ca3af' : '#0a0a0a', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: hGuardando ? 'not-allowed' : 'pointer' }}>{hGuardando ? 'Guardando...' : 'Guardar'}</button>
                <button type="button" onClick={() => { setHModal(false); setHEditando(null); }} style={{ flex: 1, padding: '0.625rem', background: 'white', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HorasProfesoresPage;
