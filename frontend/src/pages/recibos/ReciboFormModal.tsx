import { useState, useEffect, memo } from 'react';
import api from '../../api/axios';
import { useToast } from '../../contexts/ToastContext';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import { BTN_PRIMARY } from '../../theme/colors';
import { previewPricing } from '../../api/endpoints';
import type { Alumno, Matricula, PricingPreviewResponse } from '../../api/endpoints';

interface PrecioCalculado extends PricingPreviewResponse {}

interface MatriculaForm extends Matricula {
  taller_tipo: string;
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

function getLimaToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

interface ReciboInput {
  id: number;
  fecha_emision: string;
  monto_bruto?: number;
  monto_total: number;
  monto_pagado: number;
  descuento?: number;
  paquete_aplicado?: string;
  precio_editado?: boolean;
  estado: string;
  metodo_pago?: string;
}

interface ReciboFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  recibo?: ReciboInput | null;
  cicloId?: number | null;
}

/**
 * ReciboFormModal — Formulario de creación/edición de recibo
 *
 * Flujo para crear:
 * 1. Seleccionar matrículas (agrupadas por alumno, con checkbox)
 * 2. El precio se calcula automáticamente vía API (descuentos por combo)
 * 3. Se pueden editar manualmente los montos (bruto, descuento, final, pagado)
 * 4. Seleccionar estado (pendiente/pagado/anulado) y método de pago
 *
 * En edición: permite cambiar montos, estado, método de pago, marcar como
 * pagado o anular. El saldo pendiente se calcula en vivo.
 */
function ReciboFormModal({ isOpen, onClose, onSuccess, recibo, cicloId }: ReciboFormModalProps) {
  const editingId = recibo?.id ?? null;
  const { showApiError, showToast } = useToast();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [formData, setFormData] = useState<ReciboFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [precioCalculado, setPrecioCalculado] = useState<PrecioCalculado | null>(null);
  const [calculandoPrecio, setCalculandoPrecio] = useState(false);
  const [precioEditadoManual, setPrecioEditadoManual] = useState(false);
  const [searchMatricula, setSearchMatricula] = useState('');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaForm[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (recibo) {
      setFormData({
        fecha_emision: recibo.fecha_emision,
        monto_bruto: (recibo.monto_bruto ?? 0).toString(),
        monto_total: recibo.monto_total.toString(),
        monto_pagado: recibo.monto_pagado.toString(),
        descuento: (recibo.descuento ?? 0).toString(),
        paquete_aplicado: recibo.paquete_aplicado || 'individual',
        precio_editado: recibo.precio_editado ?? false,
        estado: recibo.estado,
        metodo_pago: (recibo as any).metodo_pago || 'efectivo',
        matricula_ids: [],
      });
      setPrecioCalculado(null);
      setPrecioEditadoManual(false);
      setSearchMatricula('');
      return;
    }
    setFormData({ ...initialFormData });
    setPrecioCalculado(null);
    setPrecioEditadoManual(false);
    setSearchMatricula('');
    if (!cicloId) return;
    const load = async () => {
      try {
        const [alumnosRes, matriculasRes] = await Promise.all([
          api.get(`/ciclos/${cicloId}/alumnos/?page_size=200`),
          api.get(`/ciclos/${cicloId}/matriculas/?estado=no_procesado&page_size=200`),
        ]);
        setAlumnos((alumnosRes.data.results || alumnosRes.data).filter((a: Alumno) => a.activo));
        setMatriculas((matriculasRes.data.results || matriculasRes.data) || []);
      } catch (err) {
        console.error('Error loading form data:', err);
      }
    };
    load();
  }, [isOpen, recibo, cicloId]);

  const calcularPrecioRecomendado = async (matriculaIds: number[]) => {
    if (matriculaIds.length === 0) {
      setPrecioCalculado(null);
      setFormData((prev) => ({ ...prev, monto_bruto: '0', monto_total: '0', descuento: '0' }));
      return;
    }
    setCalculandoPrecio(true);
    try {
      const jsonData = await previewPricing(matriculaIds);
      setPrecioCalculado(jsonData);
      const bruto = jsonData.items.reduce((sum, item) => sum + item.precio_original, 0);
      setFormData((prev) => ({
        ...prev,
        monto_bruto: String(bruto.toFixed(2)),
        monto_total: String(jsonData.total_general.toFixed(2)),
        descuento: String(jsonData.descuento_total.toFixed(2)),
        paquete_aplicado: jsonData.paquete_aplicado || 'individual',
      }));
      setPrecioEditadoManual(false);
    } catch (err) {
      console.error('Error calculando precio:', err);
    } finally {
      setCalculandoPrecio(false);
    }
  };

  const handleMatriculaToggle = (matriculaId: number) => {
    const newIds = formData.matricula_ids.includes(matriculaId)
      ? formData.matricula_ids.filter((id) => id !== matriculaId)
      : [...formData.matricula_ids, matriculaId];
    setFormData((prev) => ({ ...prev, matricula_ids: newIds }));
    calcularPrecioRecomendado(newIds);
  };

  const handlePrecioChange = (value: string) => {
    setPrecioEditadoManual(true);
    if (precioCalculado) {
      const bruto = precioCalculado.items.reduce((sum, item) => sum + item.precio_original, 0);
      const nuevoDescuento = bruto - parseFloat(value || '0');
      setFormData((prev) => ({
        ...prev,
        monto_total: value,
        descuento: nuevoDescuento.toString(),
        precio_editado: true,
      }));
    } else {
      setFormData((prev) => ({ ...prev, monto_total: value, precio_editado: true }));
    }
  };

  const getPaqueteLabel = (paquete: string) => {
    if (!paquete || paquete === 'individual') return 'Individual';
    const parts = paquete.split('_');
    const base = parts.slice(0, 2).join('_');
    const labels: Record<string, string> = {
      'combo_musical': 'Combo Musical',
      'mixto': 'Mixto',
      'intensivo': 'Intensivo',
    };
    const label = labels[base] || paquete;
    const numeros = parts.slice(2);
    if (numeros.length > 0) {
      return `${label} (${numeros.join('+')} clases)`;
    }
    return label;
  };

  const getAlumnoNombre = (alumnoId: number) => {
    const alumno = alumnos.find((a) => a.id === alumnoId);
    return alumno ? `${alumno.apellido}, ${alumno.nombre}` : '';
  };

  const filteredMatriculas = matriculas.filter((m) => {
    const alumnoNombre = getAlumnoNombre(m.alumno).toLowerCase();
    const tallerNombre = m.taller_nombre.toLowerCase();
    const searchLower = searchMatricula.toLowerCase();
    return alumnoNombre.includes(searchLower) || tallerNombre.includes(searchLower);
  });

  const matriculasPorAlumno = filteredMatriculas.reduce((acc, m) => {
    if (!acc[m.alumno]) acc[m.alumno] = [];
    acc[m.alumno].push(m);
    return acc;
  }, {} as Record<number, MatriculaForm[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloId) return;
    if (!editingId && formData.matricula_ids.length === 0) {
      showToast('Debe seleccionar al menos una matrícula', 'warning');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/recibos/${editingId}/` : `/ciclos/${cicloId}/recibos/`;
      const method = editingId ? 'patch' : 'post';
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
        ciclo: cicloId,
        alumno: null,
      };
      if (!editingId) {
        body.matricula_ids = formData.matricula_ids;
      }
      await api[method](url, body);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error:', err);
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  // ponytail: largest-remainder method distributes rounding across all items
  const roundTo5Balanced = (items: typeof precioCalculado extends { items: infer I } ? I : never, total: number, bruto: number) => {
    // Step 1: proportional share, floor to multiple of 5, track fraction
    const shares = items.map((item) => {
      const share = bruto > 0 ? (item.precio_original / bruto) * total : 0;
      const floored = Math.floor(share / 5) * 5;
      return { floored, fraction: share - floored };
    });
    // Step 2: how many 5-unit slots to distribute
    const sumFloored = shares.reduce((s, sh) => s + sh.floored, 0);
    let remaining = Math.round((total - sumFloored) / 5);
    // Step 3: give extra 5s to items with largest fractional remainders
    const order = items.map((_, i) => i).sort((a, b) => shares[b].fraction - shares[a].fraction);
    const result = new Array<number>(items.length);
    for (const idx of order) {
      result[idx] = shares[idx].floored + (remaining > 0 ? 5 : 0);
      remaining -= 1;
    }
    return items.map((item, i) => ({
      ...item,
      precio_final: Math.max(0, result[i]),
      descuento_aplicado: Math.max(0, item.precio_original - result[i]),
    }));
  };

  const effectiveItems = precioCalculado
    ? precioEditadoManual
      ? roundTo5Balanced(precioCalculado.items, parseFloat(formData.monto_total) || 0, precioCalculado.items.reduce((sum, item) => sum + item.precio_original, 0))
      : roundTo5Balanced(precioCalculado.items, precioCalculado.total_general, precioCalculado.items.reduce((sum, item) => sum + item.precio_original, 0))
    : [];

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{editingId ? 'Editar Recibo' : 'Nuevo Recibo'}</h2>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#e5e7eb', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha de emisión</label>
            <input type="date" value={formData.fecha_emision} onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })} required style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '0.875rem', maxWidth: '220px' }} />
          </div>

          {!editingId && (
            <div style={{ marginBottom: '1.25rem', background: '#fafbfc', borderRadius: '12px', padding: '1rem', border: '1.5px solid #c8ccd4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matrículas a incluir</span>
                <span style={{ fontSize: '0.7rem', color: '#d4af37', background: '#fef9e7', padding: '0.15rem 0.6rem', borderRadius: '9999px', fontWeight: 600 }}>{formData.matricula_ids.length} seleccionadas</span>
              </div>
              <input type="text" placeholder="Buscar por alumno o taller..." value={searchMatricula} onChange={(e) => setSearchMatricula(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '0.5rem', fontSize: '0.875rem', background: 'white' }} />
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', maxHeight: '280px', overflow: 'auto', background: 'white' }}>
                {Object.keys(matriculasPorAlumno).length === 0 ? (
                  <p style={{ padding: '1.5rem', color: '#9ca3af', textAlign: 'center' }}>No hay matrículas activas</p>
                ) : (
                  Object.entries(matriculasPorAlumno).map(([alumnoId, mats]) => (
                    <div key={alumnoId}>
                      <div style={{ padding: '0.5rem 1rem', background: '#fafbfc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.8125rem', color: '#334155' }}>{getAlumnoNombre(parseInt(alumnoId))}</div>
                      {mats.map((m) => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '0.625rem 1rem', borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: formData.matricula_ids.includes(m.id) ? '#f0fdf4' : 'transparent', transition: 'background 0.1s' }}>
                          <input type="checkbox" checked={formData.matricula_ids.includes(m.id)} onChange={() => handleMatriculaToggle(m.id)} style={{ marginRight: '0.75rem', accentColor: '#d4af37', width: 16, height: 16 }} />
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

          {calculandoPrecio && <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>Calculando precio recomendado...</div>}
          {precioCalculado && !calculandoPrecio && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.125rem', marginBottom: '1.25rem' }}>
              {/* Header: Bruto */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: effectiveItems.length > 0 ? '0.75rem' : 0 }}>
                <span style={{ fontWeight: 600, color: '#166534', fontSize: '0.875rem' }}>Precio bruto</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: '#166534' }}>
                  S/. {effectiveItems.reduce((sum, item) => sum + item.precio_original, 0).toFixed(2)}
                </span>
              </div>

              {/* Matrícula items */}
              {effectiveItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {effectiveItems.map((item) => (
                    <div key={item.matricula_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.625rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.8125rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.alumno_nombre}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#059669', marginTop: '0.125rem' }}>
                          {item.taller_nombre} · {item.sesiones_contratadas} clases
                          {item.descuento_aplicado > 0 && (
                            <span style={{ marginLeft: '0.375rem', padding: '0.0625rem 0.375rem', background: '#d1fae5', borderRadius: '4px', fontWeight: 600, fontSize: '0.625rem', color: '#047857' }}>
                              {getPaqueteLabel(item.promo_aplicada)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem', color: '#166534', textAlign: 'right', whiteSpace: 'nowrap', marginLeft: '0.75rem' }}>
                        {item.descuento_aplicado > 0 ? (
                          <span>
                            <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '0.6875rem', fontWeight: 400, marginRight: '0.25rem' }}>
                              {item.precio_original.toFixed(2)}
                            </span>
                            {item.precio_final.toFixed(2)}
                          </span>
                        ) : (
                          <span>{item.precio_final.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discount line */}
              {precioCalculado.descuento_total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #bbf7d0' }}>
                  <span style={{ color: '#059669', fontWeight: 500 }}>{getPaqueteLabel(precioCalculado.paquete_aplicado)}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#dc2626' }}>-S/. {precioEditadoManual ? (effectiveItems.reduce((sum, item) => sum + item.precio_original, 0) - parseFloat(formData.monto_total)).toFixed(2) : precioCalculado.descuento_total.toFixed(2)}</span>
                </div>
              )}

              {/* Footer: Final price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.625rem', borderTop: '1.5px solid #86efac' }}>
                <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.9375rem' }}>{precioEditadoManual ? 'Precio final' : 'Precio sugerido'}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: '#059669' }}>S/. {precioEditadoManual ? parseFloat(formData.monto_total).toFixed(2) : precioCalculado.total_general.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div style={{ background: '#fafbfc', borderRadius: '12px', padding: '1.125rem', marginBottom: '1.25rem', border: '1.5px solid #c8ccd4' }}>
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
                <input type="number" step="0.01" value={formData.monto_total} onChange={(e) => handlePrecioChange(e.target.value)} required style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 600, border: precioEditadoManual ? '2px solid #f59e0b' : '1px solid #d1d5db', background: precioEditadoManual ? '#fffbeb' : 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Pagado</span>
                <input type="number" step="0.01" value={formData.monto_pagado} onChange={(e) => setFormData({ ...formData, monto_pagado: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 600, color: '#059669', border: parseFloat(formData.monto_pagado) >= parseFloat(formData.monto_total) ? '2px solid #10b981' : '1px solid #d1d5db', background: formData.estado === 'pagado' ? '#f0fdf4' : 'white' }} />
              </div>
            </div>
            {editingId && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saldo pendiente</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9375rem', color: parseFloat(formData.monto_total) - parseFloat(formData.monto_pagado) > 0 ? '#dc2626' : '#059669' }}>
                  S/. {(parseFloat(formData.monto_total) - parseFloat(formData.monto_pagado)).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div style={{ background: '#fafbfc', borderRadius: '12px', padding: '1.125rem', marginBottom: '1.5rem', border: '1.5px solid #c8ccd4' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.75rem' }}>Estado del pago</span>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Estado</span>
                <select value={formData.estado} onChange={(e) => { const ne = e.target.value; if (ne === 'pagado') setFormData((prev) => ({ ...prev, estado: ne, monto_pagado: prev.monto_total })); else setFormData({ ...formData, estado: ne }); }} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="anulado">Anulado</option>
                </select>
                {formData.estado === 'pagado' && <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.25rem' }}>✓ Pago completo</div>}
                {formData.estado === 'anulado' && <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>Este recibo fue anulado</div>}
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Método de pago</span>
                <select value={formData.metodo_pago} onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: 'white' }}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.75rem 1.5rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem', color: '#374151' }}>Cancelar</button>
            {editingId && formData.estado === 'pendiente' && (
              <button type="button" onClick={() => setFormData((prev) => ({ ...prev, estado: 'pagado', monto_pagado: prev.monto_total }))} style={{ padding: '0.75rem 1.5rem', background: '#d1fae5', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', color: '#059669', fontSize: '0.875rem' }}>Marcar Pagado</button>
            )}
            {editingId && formData.estado !== 'anulado' && (
              <button type="button" onClick={() => setFormData((prev) => ({ ...prev, estado: 'anulado' }))} style={{ padding: '0.75rem 1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: 500, cursor: 'pointer', color: '#dc2626', fontSize: '0.875rem' }}>Anular</button>
            )}
            <button type="submit" disabled={saving || (!editingId && formData.matricula_ids.length === 0)} style={{ marginLeft: 'auto', padding: '0.75rem 2rem', border: BTN_PRIMARY.border, borderRadius: '10px', fontWeight: BTN_PRIMARY.fontWeight, fontSize: '0.875rem', color: BTN_PRIMARY.color, cursor: (saving || (!editingId && formData.matricula_ids.length === 0)) ? 'not-allowed' : 'pointer', background: (saving || (!editingId && formData.matricula_ids.length === 0)) ? '#94a3b8' : BTN_PRIMARY.background, boxShadow: (saving || (!editingId && formData.matricula_ids.length === 0)) ? 'none' : '0 2px 8px rgba(212,175,55,0.3)' }}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear recibo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(ReciboFormModal);
