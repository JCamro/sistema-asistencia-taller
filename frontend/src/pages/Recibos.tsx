import { useState, useEffect, memo, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
}

interface Recibo {
  id: number;
  numero: string;
  alumno: number;
  alumno_nombre: string;
  ciclo: number;
  fecha_emision: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  estado: string;
}

interface ReciboFormData {
  numero: string;
  alumno: number | '';
  fecha_emision: string;
  monto_total: string;
  monto_pagado: string;
  estado: string;
}

const initialFormData: ReciboFormData = {
  numero: '',
  alumno: '',
  fecha_emision: new Date().toISOString().split('T')[0],
  monto_total: '',
  monto_pagado: '0',
  estado: 'pendiente',
};

function RecibosPage() {
  const { cicloActual } = useCiclo();
  const { showApiError } = useToast();
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ReciboFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!cicloActual) return;
    const token = localStorage.getItem('access_token');
    try {
      const [recibosRes, alumnosRes] = await Promise.all([
        fetch(`/api/ciclos/${cicloActual.id}/recibos/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/ciclos/${cicloActual.id}/alumnos/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [recibosData, alumnosData] = await Promise.all([recibosRes.json(), alumnosRes.json()]);
      setRecibos(recibosData.results || recibosData);
      setAlumnos((alumnosData.results || alumnosData).filter((a: Alumno) => a.activo));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRecibos = recibos.filter((r) =>
    r.alumno_nombre.toLowerCase().includes(search.toLowerCase()) ||
    r.numero.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloActual || !formData.alumno) return;
    setSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const url = editingId ? `/api/recibos/${editingId}/` : `/api/ciclos/${cicloActual.id}/recibos/`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, ciclo: cicloActual.id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormData);
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
      alumno: recibo.alumno,
      fecha_emision: recibo.fecha_emision,
      monto_total: recibo.monto_total.toString(),
      monto_pagado: recibo.monto_pagado.toString(),
      estado: recibo.estado,
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    const num = `R-${Date.now().toString().slice(-6)}`;
    setEditingId(null);
    setFormData({ ...initialFormData, numero: num });
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #14b8a6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const total = filteredRecibos.reduce((sum, r) => sum + Number(r.monto_total), 0);
  const pendiente = filteredRecibos.filter((r) => r.estado === 'pendiente').reduce((sum, r) => sum + r.saldo_pendiente, 0);
  const pagado = filteredRecibos.filter((r) => r.estado === 'pagado').reduce((sum, r) => sum + Number(r.monto_pagado), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>Recibos</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{recibos.length} recibos emitidos</p>
        </div>
        <button onClick={openCreateModal} disabled={alumnos.length === 0} style={{ background: alumnos.length === 0 ? '#e5e7eb' : '#14b8a6', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'not-allowed' }}>
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
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Alumno</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Fecha</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Monto</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Saldo</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecibos.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No hay recibos</td></tr>
            ) : (
              filteredRecibos.map((r) => {
                const colors = getEstadoColor(r.estado);
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}><span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#14b8a6' }}>{r.numero}</span></td>
                    <td style={{ padding: '1rem' }}><div style={{ fontWeight: '600', color: '#111827' }}>{r.alumno_nombre}</div></td>
                    <td style={{ padding: '1rem', color: '#374151' }}>{new Date(r.fecha_emision).toLocaleDateString('es-PE')}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>S/. {Number(r.monto_total).toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: r.saldo_pendiente > 0 ? '#dc2626' : '#059669' }}>S/. {r.saldo_pendiente.toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', background: colors.bg, color: colors.color }}>
                        {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
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
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{editingId ? 'Editar Recibo' : 'Nuevo Recibo'}</h2>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Número</label>
                  <input type="text" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Alumno</label>
                  <select value={formData.alumno} onChange={(e) => setFormData({ ...formData, alumno: e.target.value ? parseInt(e.target.value) : '' })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                    <option value="">Seleccionar alumno</option>
                    {alumnos.map((a) => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Fecha</label>
                    <input type="date" value={formData.fecha_emision} onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Monto (S/.)</label>
                    <input type="number" step="0.01" value={formData.monto_total} onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Pagado (S/.)</label>
                    <input type="number" step="0.01" value={formData.monto_pagado} onChange={(e) => setFormData({ ...formData, monto_pagado: e.target.value })} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Estado</label>
                    <select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                      <option value="pendiente">Pendiente</option>
                      <option value="pagado">Pagado</option>
                      <option value="anulado">Anulado</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.75rem', background: saving ? '#5eead4' : '#14b8a6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RecibosPage);
