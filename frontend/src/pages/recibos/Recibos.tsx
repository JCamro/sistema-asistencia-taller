import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import { getApiBaseUrl } from '../../utils/api';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import RecibosFilterBar from './RecibosFilterBar';
import ReciboFormModal from './ReciboFormModal';
import ReciboDetailModal from './ReciboDetailModal';

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
  metodo_pago?: string;
  updated_at?: string;
  matriculas_detalle?: Array<{
    alumno_nombre: string;
    taller_nombre: string;
    sesiones_contratadas: number;
    monto: number;
  }>;
}

function getLimaToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatReciboDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'pagado': return { bg: '#d1fae5', color: '#059669' };
    case 'pendiente': return { bg: '#fef3c7', color: '#b45309' };
    case 'anulado': return { bg: '#f3f4f6', color: '#6b7280' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
}

function getPaqueteLabel(paquete: string) {
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
  const apiBase = getApiBaseUrl();
  const { cicloActual } = useCiclo();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroPreset, setFiltroPreset] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  // Ref para que fetchData use valores actuales sin recrearse en cada render
  const searchRef = useRef(search);
  const filtroRef = useRef(filtroEstado);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { filtroRef.current = filtroEstado; }, [filtroEstado]);

  const fetchData = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setCurrentPage(page);
    const token = localStorage.getItem('access_token');
    const searchText = searchRef.current;
    const fe = filtroRef.current;
    try {
      const params = new URLSearchParams({ ordering: '-id', page: String(page) });
      if (fe !== 'todos') params.set('estado', fe);
      if (searchText) params.set('search', searchText);
      const [recibosResponse, matriculasResponse] = await Promise.all([
        fetch(`${apiBase}/ciclos/${cicloActual.id}/recibos/?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/ciclos/${cicloActual.id}/matriculas/?estado=no_procesado&page_size=200`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [recibosJsonData, matriculasJsonData] = await Promise.all([recibosResponse.json(), matriculasResponse.json()]);
      const recibosArray = recibosJsonData.results || recibosJsonData;
      setRecibos(recibosArray);
      setTotalCount(recibosJsonData.count || 0);
      setTotalPages(Math.ceil((recibosJsonData.count || 0) / 20) || 1);
      const todosResponse = await fetch(`${apiBase}/ciclos/${cicloActual.id}/recibos/?page_size=500`, { headers: { Authorization: `Bearer ${token}` } });
      const todosJsonData = await todosResponse.json();
      const todosArr = todosJsonData.results || todosJsonData;
      setTotal(Array.isArray(todosArr) ? todosArr.reduce((s: number, r: any) => s + Number(r.monto_total || 0), 0) : 0);
      setPagado(Array.isArray(todosArr) ? todosArr.filter((r: any) => r.estado === 'pagado').reduce((s: number, r: any) => s + Number(r.monto_pagado || 0), 0) : 0);
      setPendiente(Array.isArray(todosArr) ? todosArr.filter((r: any) => r.estado === 'pendiente').reduce((s: number, r: any) => s + Number(r.monto_total || 0), 0) : 0);
      setMatriculas(Array.isArray(matriculasJsonData.results || matriculasJsonData) ? (matriculasJsonData.results || matriculasJsonData) : []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual, apiBase]);

  useEffect(() => { fetchData(1); }, [cicloActual, search, filtroEstado, fetchData]);

  const filteredRecibos = useMemo(() => {
    let resultado = recibos.filter((r) =>
      r.alumno_nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.numero.toLowerCase().includes(search.toLowerCase()) ||
      (r.alumnos_nombres && r.alumnos_nombres.some((n) => n.toLowerCase().includes(search.toLowerCase())))
    );
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter((r) => r.estado === filtroEstado);
    }
    const hoy = new Date();
    const hoyStr = getLimaToday();
    if (filtroPreset === 'hoy') {
      resultado = resultado.filter((r) => r.fecha_emision === hoyStr);
    } else if (filtroPreset === 'semana') {
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay());
      const inicioStr = `${inicioSemana.getFullYear()}-${String(inicioSemana.getMonth() + 1).padStart(2, '0')}-${String(inicioSemana.getDate()).padStart(2, '0')}`;
      resultado = resultado.filter((r) => r.fecha_emision >= inicioStr);
    } else if (filtroPreset === 'mes') {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const inicioStr = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(inicioMes.getDate()).padStart(2, '0')}`;
      resultado = resultado.filter((r) => r.fecha_emision >= inicioStr);
    }
    return resultado;
  }, [recibos, search, filtroEstado, filtroPreset]);

  const getAlumnosDisplay = (recibo: Recibo) => {
    if (recibo.alumnos_nombres && recibo.alumnos_nombres.length > 1) {
      return `${recibo.alumnos_nombres[0]} +${recibo.alumnos_nombres.length - 1}`;
    }
    return recibo.alumno_nombre;
  };

  const handleViewRecibo = async (recibo: Recibo) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${apiBase}/recibos/${recibo.id}/`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const jsonData = await response.json();
        setSelectedRecibo(jsonData);
      }
    } catch (err) {
      console.error('Error fetching receipt details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleEdit = (recibo: Recibo) => {
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

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
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
            {
              key: 'numero',
              label: 'Número',
              render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#8b6914' }}>{r.numero}</span>,
            },
            {
              key: 'alumno',
              label: 'Alumno(s)',
              render: (r) => (
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
              render: (r) => formatReciboDate(r.fecha_emision),
            },
            {
              key: 'paquete',
              label: 'Paquete',
              render: (r) => (
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  background: r.paquete_aplicado === 'individual' ? '#f3f4f6' : '#dbeafe',
                  color: r.paquete_aplicado === 'individual' ? '#6b7280' : '#1d4ed8',
                }}>
                  {r.paquete_display || getPaqueteLabel(r.paquete_aplicado || 'individual')}
                </span>
              ),
            },
            {
              key: 'monto',
              label: 'Monto',
              align: 'right',
              render: (r) => (
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
              render: (r) => (
                <span style={{ fontFamily: 'monospace', color: Number(r.saldo_pendiente) > 0 ? '#dc2626' : '#059669' }}>
                  S/. {Number(r.saldo_pendiente).toFixed(2)}
                </span>
              ),
            },
            {
              key: 'estado',
              label: 'Estado',
              align: 'center',
              render: (r) => {
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
              <button onClick={() => handleViewRecibo(r)} className="touch-target" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: '500' }}>Ver</button>
              <button onClick={() => handleEdit(r)} className="touch-target" style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontWeight: '500' }}>Editar</button>
            </>
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

      {showDetailModal && (
        <ReciboDetailModal
          recibo={selectedRecibo}
          loading={loadingDetail}
          onClose={() => { setShowDetailModal(false); setSelectedRecibo(null); }}
        />
      )}
    </div>
  );
}

export default memo(RecibosPage);
