import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import api from '../../api/axios';
import type { Recibo } from '../../api/endpoints';
import RecibosFilterBar from './RecibosFilterBar';
import ReciboFormModal from './ReciboFormModal';
import ReciboDetailModal from './ReciboDetailModal';
import Badge from '../../components/ui/Badge';
import { formatMonto } from '../../utils/formatters';

function getLimaToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'pagado': return { bg: '#d1fae5', color: '#059669' };
    case 'pendiente': return { bg: '#fef3c7', color: '#b45309' };
    case 'anulado': return { bg: '#f3f4f6', color: '#6b7280' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
}

/**
 * RecibosPage — Pantalla de gestión de recibos de pago
 *
 * Dashboard con KPIs (total, pendiente, pagado) y tabla con filtros por estado
 * y presets de fecha (hoy, semana, mes). Soporta multi-alumno (varios nombres
 * en un mismo recibo). Flujo: PageHeader + KPIs → FilterBar → Tabla → Modales.
 *
 * Sub-componentes: RecibosFilterBar, ReciboFormModal, ReciboDetailModal
 */
function RecibosPage() {
  const { cicloActual } = useCiclo();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroPreset, setFiltroPreset] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDashboardAmounts, setShowDashboardAmounts] = useState(false);
  const [detalleRecibo, setDetalleRecibo] = useState<any>(null);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [pagado, setPagado] = useState(0);
  const [pendiente, setPendiente] = useState(0);

  // Task 7: 300ms debounce en search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(null);
      }
    };
    if (menuAbierto !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuAbierto]);

  // Refs para que fetchData use valores actuales sin recrearse en cada render
  const searchRef = useRef(debouncedSearch);
  const filtroEstadoRef = useRef(filtroEstado);
  const filtroPresetRef = useRef(filtroPreset);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);
  useEffect(() => { filtroEstadoRef.current = filtroEstado; }, [filtroEstado]);
  useEffect(() => { filtroPresetRef.current = filtroPreset; }, [filtroPreset]);

  // Task 8: fetchTotals — solo KPIs, endpoint dedicado
  const fetchTotals = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const response = await api.get(`/ciclos/${cicloActual.id}/recibos/totals/`);
      const data = response.data;
      setTotal(data.total || 0);
      setPagado(data.pagado || 0);
      setPendiente(data.pendiente || 0);
    } catch (err) {
      console.error('Error fetching totals:', err);
    }
  }, [cicloActual]);

  useEffect(() => { fetchTotals(); }, [fetchTotals]);

  // Task 9: fetchMatriculas — solo al montar, independiente de filtros
  const fetchMatriculas = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const response = await api.get(`/ciclos/${cicloActual.id}/matriculas/?estado=no_procesado&page_size=200`);
      const data = response.data;
      setMatriculas(Array.isArray(data.results || data) ? (data.results || data) : []);
    } catch (err) {
      console.error('Error fetching matriculas:', err);
    }
  }, [cicloActual]);

  useEffect(() => { fetchMatriculas(); }, [fetchMatriculas]);

  // Task 7+8+9+10+12: fetchData con axios, date params server-side, sin totals/matriculas
  const fetchData = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setCurrentPage(page);
    const searchText = searchRef.current;
    const fe = filtroEstadoRef.current;
    const fp = filtroPresetRef.current;
    try {
      const params = new URLSearchParams({ ordering: '-id', page: String(page) });
      if (fe !== 'todos') params.set('estado', fe);
      if (searchText) params.set('search', searchText);

      // Task 10: filtroPreset se envía como query params al server
      const today = new Date();
      if (fp === 'hoy') {
        params.set('fecha', getLimaToday());
      } else if (fp === 'semana') {
        const inicioSemana = new Date(today);
        inicioSemana.setDate(today.getDate() - today.getDay());
        const y = inicioSemana.getFullYear();
        const m = String(inicioSemana.getMonth() + 1).padStart(2, '0');
        const d = String(inicioSemana.getDate()).padStart(2, '0');
        params.set('fecha_desde', `${y}-${m}-${d}`);
      } else if (fp === 'mes') {
        params.set('fecha_desde', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
      }

      const response = await api.get(`/ciclos/${cicloActual.id}/recibos/?${params}`);
      const jsonData = response.data;
      const recibosArray = jsonData.results || jsonData;
      setRecibos(recibosArray);
      setTotalCount(jsonData.count || 0);
      setTotalPages(Math.ceil((jsonData.count || 0) / 20) || 1);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  // Task 7: trigger con debouncedSearch en vez de search; incluye filtroPreset
  useEffect(() => { fetchData(1); }, [cicloActual, debouncedSearch, filtroEstado, filtroPreset, fetchData]);

  // Task 10+11: filtrado client-side mínimo — server ya aplica search, estado y fecha
  const filteredRecibos = useMemo(() => {
    let resultado = recibos;
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter((r) => r.estado === filtroEstado);
    }
    return resultado;
  }, [recibos, filtroEstado]);

  const abrirEdicion = (recibo: Recibo) => {
    setEditingId(recibo.id);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSuccess = () => {
    fetchData(currentPage);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Recibos"
        cicloNombre={cicloActual?.nombre}
        actionLabel="Nuevo Recibo"
        onAction={openCreateModal}
        actionDisabled={matriculas.length === 0}
        extra={
          <button
            onClick={() => setShowDashboardAmounts((v) => !v)}
            title={showDashboardAmounts ? 'Ocultar montos' : 'Mostrar montos'}
            style={{ padding: '0.35rem 0.65rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.75rem', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', lineHeight: 1 }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{showDashboardAmounts ? '👁' : '👁‍🗨'}</span> {showDashboardAmounts ? 'Ocultar' : 'Mostrar'}
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ecfdf5', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Total</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{showDashboardAmounts ? `S/. ${Number(total || 0).toFixed(2)}` : '••••••'}</p>
        </div>
        <div style={{ background: '#fffbeb', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(217,119,6,0.15)' }}>
          <p style={{ color: '#d97706', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Pendiente</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>S/. {Number(pendiente || 0).toFixed(2)}</p>
        </div>
        <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Pagado</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{showDashboardAmounts ? `S/. ${Number(pagado || 0).toFixed(2)}` : '••••••'}</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #c8ccd4', overflowX: 'auto' }}>
        <RecibosFilterBar
          search={search}
          onSearchChange={setSearch}
          estado={filtroEstado}
          onEstadoChange={setFiltroEstado}
          preset={filtroPreset}
          onPresetChange={setFiltroPreset}
        />
        <ResponsiveTable<Recibo>
          columns={[
            { key: 'numero', label: 'N°', render: (r: Recibo) => <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.numero}</span> },
            {
              key: 'alumnos',
              label: 'Alumno(s)',
              render: (r: Recibo) => {
                const main = r.alumno_nombre || r.alumnos_nombres?.[0] || '—';
                const extras = r.alumnos_nombres ? r.alumnos_nombres.length - 1 : 0;
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>{main}</span>
                    {extras > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.4rem', borderRadius: '9999px', background: '#f3f4f6', fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280' }}>+{extras}</span>
                    )}
                  </span>
                );
              },
            },
            { key: 'fecha', label: 'Fecha', render: (r: Recibo) => <span style={{ whiteSpace: 'nowrap' }}>{new Date(r.fecha_emision + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</span> },
            { key: 'paquete', label: 'Paquete', render: (r: Recibo) => <span title={r.paquete_aplicado || ''} style={{ display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{r.paquete_aplicado || '—'}</span> },
            { key: 'monto', label: 'Monto', align: 'right', render: (r: Recibo) => <span style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }} title={r.precio_editado ? 'Precio editado' : ''}>{formatMonto(r.monto_total)}{r.precio_editado && ' *'}</span> },
            { key: 'saldo', label: 'Saldo', align: 'right', render: (r: Recibo) => <span style={{ color: '#ef4444', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMonto(r.saldo_pendiente)}</span> },
            {
              key: 'estado',
              label: 'Estado',
              align: 'center',
              render: (r: Recibo) => {
                const colors = getEstadoColor(r.estado);
                return <Badge bg={colors.bg} color={colors.color} label={r.estado.charAt(0).toUpperCase() + r.estado.slice(1)} />;
              },
            },
          ]}
          data={filteredRecibos}
          keyField="id"
          actions={(r: Recibo) => (
            <div ref={menuAbierto === r.id ? menuRef : null} style={{ position: 'relative' }}>
              <button
                onClick={(ev) => { ev.stopPropagation(); setMenuAbierto(menuAbierto === r.id ? null : r.id); }}
                className="touch-target"
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: menuAbierto === r.id ? '1.5px solid #d4af37' : '1.5px solid #c8ccd4',
                  borderRadius: 8, background: menuAbierto === r.id ? '#f9fafb' : 'white',
                  cursor: 'pointer', fontSize: '1rem', color: '#374151', padding: 0,
                }}
              >⋯</button>
              {menuAbierto === r.id && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  background: 'white', borderRadius: 10,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  border: '1px solid #e5e7eb', zIndex: 10, minWidth: 130,
                }}>
                  <button onClick={() => { setDetalleRecibo(r); setMenuAbierto(null); }}
                    style={{ display: 'block', width: '100%', padding: '0.625rem 1rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >Ver</button>
                  <button onClick={() => { abrirEdicion(r); setMenuAbierto(null); }}
                    style={{ display: 'block', width: '100%', padding: '0.625rem 1rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8125rem', color: '#d4af37', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >Editar</button>
                </div>
              )}
            </div>
          )}
          emptyMessage="No hay recibos"
        />
        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} onPageChange={(p) => fetchData(p)} />}
      </div>

      <ReciboFormModal
        isOpen={showModal}
        onClose={closeModal}
        onSuccess={handleSuccess}
        recibo={editingId ? recibos.find((r) => r.id === editingId) || null : null}
        cicloId={cicloActual?.id}
      />

      {detalleRecibo && (
        <ReciboDetailModal
          recibo={detalleRecibo}
          loading={false}
          onClose={() => setDetalleRecibo(null)}
        />
      )}
    </div>
  );
}

export default memo(RecibosPage);
