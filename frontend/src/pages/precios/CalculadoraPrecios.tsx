import { useState, useCallback, useEffect, memo } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import { getTalleres, estimatePricing } from '../../api/endpoints';
import type { Taller } from '../../api/endpoints';

interface ItemSeleccionado { id: number; tipo: 'instrumento' | 'taller'; nombre: string; clases: number; }
interface ItemCalculado { item: ItemSeleccionado; precio_total: number; precio_por_sesion: number; promo?: string; descuento?: number; }

const SUGERENCIAS = [4, 8, 12, 16, 20, 24];
const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' };
const sectionHeader: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#0f172a' };

/**
 * CalculadoraPrecios — Cotiza precios con promociones para ítems seleccionados.
 * Los ítems usan talleres reales del ciclo activo.
 */
function CalculadoraPrecios() {
  const { cicloActual } = useCiclo();
  const [items, setItems] = useState<ItemSeleccionado[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState<'instrumento' | 'taller'>('instrumento');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoClases, setNuevoClases] = useState(12);
  const [resultados, setResultados] = useState<ItemCalculado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loadingTalleres, setLoadingTalleres] = useState(false);

  useEffect(() => {
    if (!cicloActual) return;
    setLoadingTalleres(true);
    getTalleres(cicloActual.id, 1, '')
      .then((res) => {
        const data = res.data.results || res.data;
        setTalleres(Array.isArray(data) ? data.filter((t: Taller) => t.activo) : []);
      })
      .catch(() => setTalleres([]))
      .finally(() => setLoadingTalleres(false));
  }, [cicloActual]);

  const talleresFiltrados = talleres.filter(t => t.tipo === nuevoTipo);

  const agregarItem = useCallback(() => {
    if (!nuevoNombre.trim()) return;
    const item: ItemSeleccionado = { id: Date.now(), tipo: nuevoTipo, nombre: nuevoNombre.trim(), clases: nuevoClases };
    setItems((prev) => [...prev, item]);
    setResultados([]);
    setNuevoNombre('');
  }, [nuevoNombre, nuevoTipo, nuevoClases]);

  const eliminarItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setResultados([]);
  }, []);

  const calcularPrecios = useCallback(async () => {
    if (items.length === 0 || !cicloActual) return;
    setLoading(true);
    setError(null);
    try {
      const result = await estimatePricing(
        items.map(item => ({ tipo_taller: item.tipo, cantidad_clases: item.clases })),
        cicloActual.id
      );
      const calculados: ItemCalculado[] = result.items.map((ri) => {
        const item = items[ri.index];
        return {
          item,
          precio_total: ri.precio_final,
          precio_por_sesion: ri.precio_por_sesion,
          promo: ri.promo_aplicada && ri.promo_aplicada !== 'individual' ? ri.promo_aplicada : undefined,
          descuento: ri.descuento,
        };
      });
      setResultados(calculados);
    } catch (err: any) {
      const detail = err?.response?.data?.error || err?.response?.data?.detail || 'No se pudieron calcular los precios.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [items, cicloActual]);

  const total = resultados.reduce((sum, r) => sum + r.precio_total, 0);

  const tipoBtnStyle = (tipo: 'instrumento' | 'taller'): React.CSSProperties => ({
    flex: 1, padding: '0.5rem 0.75rem', minHeight: 44, borderRadius: 8,
    border: nuevoTipo === tipo ? '2px solid #d4af37' : '1.5px solid #e5e7eb',
    background: nuevoTipo === tipo ? '#fef9e7' : '#fff',
    color: nuevoTipo === tipo ? '#8b6914' : '#64748b',
    fontWeight: nuevoTipo === tipo ? 600 : 400,
    fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 200ms ease'
  });

  const chipStyle = (n: number): React.CSSProperties => ({
    flex: 1, minWidth: '48px', padding: '0.5rem 0.25rem', minHeight: 44, borderRadius: 8,
    border: nuevoClases === n ? '2px solid #d4af37' : '1.5px solid #e5e7eb',
    background: nuevoClases === n ? '#fef9e7' : '#fff',
    color: nuevoClases === n ? '#8b6914' : '#64748b',
    fontWeight: nuevoClases === n ? 600 : 400,
    fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 200ms ease'
  });

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        <h3 style={sectionHeader}>Agregar Clase</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => setNuevoTipo('instrumento')} className="touch-target" style={tipoBtnStyle('instrumento')}>Instrumento</button>
              <button type="button" onClick={() => setNuevoTipo('taller')} className="touch-target" style={tipoBtnStyle('taller')}>Taller</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Nombre</label>
            <select
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              style={inputStyle}
              disabled={loadingTalleres}
            >
              <option value="">{loadingTalleres ? 'Cargando...' : 'Seleccionar...'}</option>
              {talleresFiltrados.map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Clases</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SUGERENCIAS.map((n) => (
                <button key={n} type="button" onClick={() => setNuevoClases(n)} className="touch-target" style={chipStyle(n)}>{n}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={agregarItem} disabled={!nuevoNombre.trim()} className="touch-target" style={{
            width: '100%', padding: '0.625rem', minHeight: 44, borderRadius: 10,
            border: nuevoNombre.trim() ? '2px solid #d4af37' : '1px solid #e5e7eb',
            background: nuevoNombre.trim() ? '#fef9e7' : '#fafbfc',
            color: nuevoNombre.trim() ? '#8b6914' : '#cbd5e1',
            fontWeight: 600, fontSize: '0.875rem',
            cursor: nuevoNombre.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar clase
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        <h3 style={sectionHeader}>Clases Seleccionadas ({items.length})</h3>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Agregá clases para calcular el precio
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: 10,
                background: item.tipo === 'instrumento' ? '#fef9e7' : '#fefce8',
                border: `1px solid ${item.tipo === 'instrumento' ? '#f0d878' : '#fde68a'}`,
                transition: 'all 200ms'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.tipo === 'instrumento' ? '#b59410' : '#ca8a04'} strokeWidth="1.8" style={{ flexShrink: 0 }}>
                  {item.tipo === 'instrumento' ? (
                    <><path d="M9 18V5l9-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>
                  ) : (
                    <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>
                  )}
                </svg>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.nombre}</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                    {item.tipo === 'instrumento' ? 'Instrumento' : 'Taller'} · {item.clases} clases
                  </span>
                </div>
                <button type="button" onClick={() => eliminarItem(item.id)} className="touch-target" style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ ...cardStyle }}>
          <h3 style={sectionHeader}>Resumen de Precio</h3>
          <button type="button" onClick={calcularPrecios} disabled={loading || !cicloActual} className="touch-target" style={{
            width: '100%', padding: '0.75rem', minHeight: 48, borderRadius: 10, border: 'none',
            fontWeight: 600, fontSize: '0.9375rem', cursor: loading || !cicloActual ? 'not-allowed' : 'pointer',
            background: loading || !cicloActual ? '#e5e7eb' : 'linear-gradient(135deg, #d4af37, #c59b2e)',
            color: loading || !cicloActual ? '#9ca3af' : '#0a0a0a',
            transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}>
            {loading ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="10">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.6s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                Calculando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/>
                </svg>
                Calcular precios
              </>
            )}
          </button>
          {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>}
          {resultados.length > 0 && (
            <>
              <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Desglose</p>
                {resultados.map((r, i) => (
                  <div key={r.item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: 8, background: i % 2 === 0 ? '#fafbfc' : 'white' }}>
                    <div>
                      <span style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.875rem' }}>{r.item.nombre}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>{r.item.clases} clases</span>
                      {r.promo && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8b6914', background: '#fef9e7', padding: '0.1rem 0.45rem', borderRadius: '9999px', marginLeft: '0.5rem', textTransform: 'uppercase' }}>
                          {r.promo === 'combo_musical' ? 'Combo' : r.promo === 'mixto' ? 'Mixto' : r.promo === 'intensivo' ? 'Intensivo' : r.promo}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {r.descuento && r.descuento > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through', display: 'block' }}>
                          S/. {(r.precio_total + r.descuento).toFixed(2)}
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: r.descuento && r.descuento > 0 ? '#059669' : '#0f172a' }}>
                        S/. {r.precio_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', marginTop: '1rem', background: 'linear-gradient(135deg, #fef9e7, #fef3c7)', borderRadius: 12, border: '1px solid #f0d878' }}>
                <span style={{ fontWeight: 700, color: '#8b6914', fontSize: '1rem' }}>Total</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', color: '#5c4508' }}>S/. {total.toFixed(2)}</span>
              </div>
              {resultados.some((r) => r.promo) && (
                <p style={{ fontSize: '0.75rem', color: '#8b6914', marginTop: '0.5rem', textAlign: 'center' }}>
                  ⚡ Promoción aplicada — el precio final ya incluye el descuento del paquete
                </p>
              )}
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem' }}>Precios con promociones activas para este ciclo.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(CalculadoraPrecios);
