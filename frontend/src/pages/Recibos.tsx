import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';

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
  numero: string;
  fecha_emision: string;
  monto_bruto: string;
  monto_total: string;
  monto_pagado: string;
  descuento: string;
  paquete_aplicado: string;
  precio_editado: boolean;
  estado: string;
  matricula_ids: number[];
}

const initialFormData: ReciboFormData = {
  numero: '',
  fecha_emision: new Date().toISOString().split('T')[0],
  monto_bruto: '0',
  monto_total: '0',
  monto_pagado: '0',
  descuento: '0',
  paquete_aplicado: 'individual',
  precio_editado: false,
  estado: 'pendiente',
  matricula_ids: [],
};

function RecibosPage() {
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ReciboFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [precioCalculado, setPrecioCalculado] = useState<PrecioCalculado | null>(null);
  const [calculandoPrecio, setCalculandoPrecio] = useState(false);
  const [precioEditadoManual, setPrecioEditadoManual] = useState(false);
  const [searchMatricula, setSearchMatricula] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState<Recibo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [recibosRes, alumnosRes, matriculasRes] = await Promise.all([
        fetch(`/api/ciclos/${cicloActual.id}/recibos/?ordering=-id`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/ciclos/${cicloActual.id}/alumnos/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/ciclos/${cicloActual.id}/matriculas/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [recibosData, alumnosData, matriculasData] = await Promise.all([
        recibosRes.json(),
        alumnosRes.json(),
        matriculasRes.json()
      ]);
      const recibosArray = recibosData.results || recibosData;
      setRecibos(recibosArray);
      setAlumnos((alumnosData.results || alumnosData).filter((a: Alumno) => a.activo));

      // Obtener IDs de matrículas que ya tienen un recibo pagado o pendiente
      const matriculasConRecibo = new Set<number>();
      for (const recibo of recibosArray) {
        if (recibo.estado === 'pagado' || recibo.estado === 'pendiente') {
          if (recibo.matricula_ids) {
            for (const mid of recibo.matricula_ids) {
              matriculasConRecibo.add(mid);
            }
          }
        }
      }

      // Filtrar matrículas activas que NO tienen recibo pagado/pendiente
      setMatriculas((matriculasData.results || matriculasData).filter(
        (m: Matricula) => m.activo && !matriculasConRecibo.has(m.id)
      ));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRecibos = recibos.filter((r) =>
    r.alumno_nombre.toLowerCase().includes(search.toLowerCase()) ||
    r.numero.toLowerCase().includes(search.toLowerCase()) ||
    (r.alumnos_nombres && r.alumnos_nombres.some(n => n.toLowerCase().includes(search.toLowerCase())))
  );

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
      const res = await fetch(`/api/recibos/${recibo.id}/`, {
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
      return;
    }

    setCalculandoPrecio(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch('/api/recibos/calcular_precio/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matricula_ids: matriculaIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setPrecioCalculado(data);
        setFormData(prev => ({
          ...prev,
          monto_bruto: data.precio_bruto.toString(),
          monto_total: data.precio_sugerido.toString(),
          descuento: data.descuento.toString(),
          paquete_aplicado: data.paquete_detectado,
        }));
        setPrecioEditadoManual(false);
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
      const url = editingId ? `/api/recibos/${editingId}/` : `/api/ciclos/${cicloActual.id}/recibos/`;
      const method = editingId ? 'PATCH' : 'POST';

      const body: any = {
        numero: formData.numero,
        fecha_emision: formData.fecha_emision,
        monto_bruto: parseFloat(formData.monto_bruto),
        monto_total: parseFloat(formData.monto_total),
        monto_pagado: parseFloat(formData.monto_pagado),
        descuento: parseFloat(formData.descuento),
        paquete_aplicado: formData.paquete_aplicado,
        precio_editado: formData.precio_editado,
        estado: formData.estado,
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
      numero: recibo.numero,
      fecha_emision: recibo.fecha_emision,
      monto_bruto: recibo.monto_bruto.toString(),
      monto_total: recibo.monto_total.toString(),
      monto_pagado: recibo.monto_pagado.toString(),
      descuento: recibo.descuento.toString(),
      paquete_aplicado: recibo.paquete_aplicado,
      precio_editado: recibo.precio_editado,
      estado: recibo.estado,
      matricula_ids: [],
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    const num = `R-${Date.now().toString().slice(-6)}`;
    setEditingId(null);
    setFormData({ ...initialFormData, numero: num });
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

  const total = filteredRecibos.reduce((sum, r) => sum + Number(r.monto_total), 0);
  const pendiente = filteredRecibos.filter((r) => r.estado === 'pendiente').reduce((sum, r) => sum + Number(r.saldo_pendiente), 0);
  const pagado = filteredRecibos.filter((r) => r.estado === 'pagado').reduce((sum, r) => sum + Number(r.monto_pagado), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Recibos</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{recibos.length} recibos emitidos</p>
        </div>
        <button onClick={openCreateModal} disabled={matriculas.length === 0} style={{ background: matriculas.length === 0 ? '#e5e7eb' : '#14b8a6', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: matriculas.length === 0 ? 'not-allowed' : 'pointer' }}>
          <span>+</span> Nuevo Recibo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Total</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>S/. {total.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Pendiente</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>S/. {pendiente.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Pagado</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>S/. {pagado.toFixed(2)}</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <input type="text" placeholder="Buscar por número o alumno..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', maxWidth: '400px', padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Número</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Alumno(s)</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Fecha</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Paquete</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Monto</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Saldo</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecibos.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay recibos</td></tr>
            ) : (
              filteredRecibos.map((r) => {
                const colors = getEstadoColor(r.estado);
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}><span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#14b8a6' }}>{r.numero}</span></td>
                    <td style={{ padding: '1rem' }}>
                      {r.alumnos_nombres && r.alumnos_nombres.length > 1 ? (
                        <div style={{ fontWeight: '600', color: '#111827' }}>{getAlumnosDisplay(r)}</div>
                      ) : (
                        <div style={{ fontWeight: '600', color: '#111827' }}>{r.alumno_nombre}</div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151' }}>{new Date(r.fecha_emision).toLocaleDateString('es-PE')}</td>
                    <td style={{ padding: '1rem' }}>
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
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      S/. {Number(r.monto_total).toFixed(2)}
                      {r.precio_editado && <span style={{ color: '#f59e0b', marginLeft: '0.25rem' }}>*</span>}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: Number(r.saldo_pendiente) > 0 ? '#dc2626' : '#059669' }}>S/. {Number(r.saldo_pendiente).toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: colors.bg, color: colors.color }}>
                        {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button onClick={() => handleViewRecibo(r)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: '500', marginRight: '0.75rem' }}>Ver</button>
                      <button onClick={() => handleEdit(r)} style={{ background: 'none', border: 'none', color: '#14b8a6', cursor: 'pointer', fontWeight: '500' }}>Editar</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{editingId ? 'Editar Recibo' : 'Nuevo Recibo'}</h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Número</label>
                    <input type="text" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Fecha</label>
                    <input type="date" value={formData.fecha_emision} onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                </div>

                {!editingId && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Matrículas a incluir</label>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formData.matricula_ids.length} seleccionadas</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar por alumno o taller..."
                      value={searchMatricula}
                      onChange={(e) => setSearchMatricula(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.875rem' }}
                    />
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', maxHeight: '300px', overflow: 'auto' }}>
                      {Object.keys(matriculasPorAlumno).length === 0 ? (
                        <p style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No hay matrículas activas</p>
                      ) : (
                        Object.entries(matriculasPorAlumno).map(([alumnoId, mats]) => (
                          <div key={alumnoId}>
                            <div style={{ padding: '0.5rem 1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                              {getAlumnoNombre(parseInt(alumnoId))}
                            </div>
                            {mats.map((m) => (
                              <label
                                key={m.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0.75rem 1rem',
                                  borderBottom: '1px solid #f3f4f6',
                                  cursor: 'pointer',
                                  background: formData.matricula_ids.includes(m.id) ? '#f0fdf4' : 'transparent',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.matricula_ids.includes(m.id)}
                                  onChange={() => handleMatriculaToggle(m.id)}
                                  style={{ marginRight: '0.75rem', accentColor: '#14b8a6' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '500', color: '#111827' }}>{m.taller_nombre}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {m.taller_tipo === 'instrumento' ? 'Instrumento' : 'Taller'} - {m.sesiones_contratadas} sesiones
                                  </div>
                                </div>
                                <div style={{ fontFamily: 'monospace', fontWeight: '600', color: '#111827' }}>
                                  S/. {m.precio_total}
                                </div>
                              </label>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {calculandoPrecio && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                    Calculando precio recomendado...
                  </div>
                )}

                {precioCalculado && !calculandoPrecio && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#166534', fontWeight: '500' }}>Precio bruto:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>S/. {precioCalculado.precio_bruto.toFixed(2)}</span>
                    </div>
                    {precioCalculado.descuento > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: '#166534', fontWeight: '500' }}>Paquete detectado:</span>
                          <span style={{ fontWeight: '600', color: '#166534' }}>{getPaqueteLabel(precioCalculado.paquete_detectado)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: '#166534', fontWeight: '500' }}>Descuento:</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#dc2626' }}>-S/. {precioCalculado.descuento.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {precioCalculado.detalles && precioCalculado.detalles.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #86efac' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>Desglose por alumno:</p>
                        {precioCalculado.detalles.map((d, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#166534' }}>{d.alumno} - {d.taller} ({d.cantidad_clases})</span>
                            <span style={{ fontFamily: 'monospace', color: '#166534' }}>S/. {d.precio_individual.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #86efac', marginTop: '0.5rem' }}>
                      <span style={{ color: '#166534', fontWeight: '600' }}>Precio sugerido:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1.125rem' }}>S/. {precioCalculado.precio_sugerido.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Monto Bruto (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monto_bruto}
                      readOnly
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                      Monto Final (S/.)
                      {precioEditadoManual && <span style={{ color: '#f59e0b', marginLeft: '0.25rem' }}>*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monto_total}
                      onChange={(e) => handlePrecioChange(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        border: precioEditadoManual ? '2px solid #f59e0b' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: precioEditadoManual ? '#fffbeb' : 'white',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Descuento (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.descuento}
                      readOnly
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb', color: '#dc2626' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Pagado (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monto_pagado}
                      onChange={(e) => setFormData({ ...formData, monto_pagado: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        border: parseFloat(formData.monto_pagado) >= parseFloat(formData.monto_total) ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: formData.estado === 'pagado' ? '#f0fdf4' : 'white'
                      }}
                    />
                    {formData.estado === 'pagado' && (
                      <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>
                        Pago completo
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => {
                        const newEstado = e.target.value;
                        if (newEstado === 'pagado') {
                          setFormData(prev => ({
                            ...prev,
                            estado: newEstado,
                            monto_pagado: prev.monto_total
                          }));
                        } else {
                          setFormData({ ...formData, estado: newEstado });
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: formData.estado === 'pagado' ? '#f0fdf4' : formData.estado === 'anulado' ? '#fef2f2' : 'white'
                      }}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="pagado">Pagado</option>
                      <option value="anulado">Anulado</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setShowModal(false); setPrecioCalculado(null); setPrecioEditadoManual(false); setSearchMatricula(''); }} style={{ flex: 1, minWidth: '100px', padding: '0.75rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                
                {editingId && formData.estado === 'pendiente' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        estado: 'pagado',
                        monto_pagado: prev.monto_total
                      }));
                    }}
                    style={{ flex: 1, minWidth: '120px', padding: '0.75rem', background: '#d1fae5', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', color: '#059669' }}
                  >
                    Marcar Pagado
                  </button>
                )}
                
                {editingId && formData.estado !== 'anulado' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        estado: 'anulado'
                      }));
                    }}
                    style={{ flex: 1, minWidth: '100px', padding: '0.75rem', background: '#fee2e2', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', color: '#dc2626' }}
                  >
                    Anular
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={saving || (!editingId && formData.matricula_ids.length === 0)}
                  style={{
                    flex: 1,
                    minWidth: '100px',
                    padding: '0.75rem',
                    background: saving || (!editingId && formData.matricula_ids.length === 0) ? '#5eead4' : '#14b8a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: saving || (!editingId && formData.matricula_ids.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            {loadingDetail ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #14b8a6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            ) : selectedRecibo ? (
              <>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Recibo {selectedRecibo.numero}</h2>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{new Date(selectedRecibo.fecha_emision).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span style={{ padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: getEstadoColor(selectedRecibo.estado).bg, color: getEstadoColor(selectedRecibo.estado).color }}>
                    {selectedRecibo.estado.charAt(0).toUpperCase() + selectedRecibo.estado.slice(1)}
                  </span>
                </div>

                <div style={{ padding: '1.5rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Alumno(s)</h3>
                    {selectedRecibo.alumnos_nombres && selectedRecibo.alumnos_nombres.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedRecibo.alumnos_nombres.map((nombre, idx) => (
                          <div key={idx} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '6px', fontWeight: '500', color: '#111827' }}>
                            {nombre}
                          </div>
                        ))}
                      </div>
                    ) : selectedRecibo.alumno_nombre ? (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '6px', fontWeight: '500', color: '#111827' }}>
                        {selectedRecibo.alumno_nombre}
                      </div>
                    ) : (
                      <p style={{ color: '#6b7280' }}>Sin alumno específico</p>
                    )}
                  </div>

                  {(selectedRecibo as any).matriculas_detalle && (selectedRecibo as any).matriculas_detalle.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Matrículas</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>Taller</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>Tipo</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>Sesiones</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedRecibo as any).matriculas_detalle.map((m: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.5rem', fontSize: '0.875rem', color: '#111827' }}>{m.taller_nombre}</td>
                              <td style={{ padding: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>{m.taller_tipo === 'instrumento' ? 'Instrumento' : 'Taller'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#111827' }}>{m.sesiones_contratadas}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.875rem', color: '#111827' }}>S/. {Number(m.monto).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Monto Bruto:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#111827' }}>S/. {Number(selectedRecibo.monto_bruto || 0).toFixed(2)}</span>
                    </div>
                    {selectedRecibo.descuento > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Descuento:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#dc2626' }}>-S/. {Number(selectedRecibo.descuento).toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ color: '#111827', fontWeight: '600', fontSize: '0.875rem' }}>Total:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#111827', fontSize: '1rem' }}>S/. {Number(selectedRecibo.monto_total).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Pagado:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#059669' }}>S/. {Number(selectedRecibo.monto_pagado || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ color: '#111827', fontWeight: '600', fontSize: '0.875rem' }}>Saldo Pendiente:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: Number(selectedRecibo.saldo_pendiente) > 0 ? '#dc2626' : '#059669' }}>S/. {Number(selectedRecibo.saldo_pendiente || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: selectedRecibo.precio_editado ? '#fef3c7' : '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: selectedRecibo.precio_editado ? '#b45309' : '#6b7280' }}>
                      Paquete: {getPaqueteLabel(selectedRecibo.paquete_aplicado)}
                      {selectedRecibo.precio_editado && ' • Precio editado manualmente'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setShowDetailModal(false); setSelectedRecibo(null); }}
                    style={{ padding: '0.625rem 1.5rem', background: '#14b8a6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Error al cargar los datos</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RecibosPage);
