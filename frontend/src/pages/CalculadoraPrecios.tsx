import { useState, useEffect, useCallback, memo } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { getPreciosActivos, type PrecioPaquete } from '../api/endpoints';
import { useWindowWidth } from '../hooks/useWindowWidth';

interface PrecioEntry {
  total: number;
  sesion: number;
}

interface PreciosMap {
  instrumento: Record<number, PrecioEntry>;
  taller: Record<number, PrecioEntry>;
}

interface PromoEntry {
  total: number;
  descuento: number;
}

interface PromosMap {
  combo_musical: Record<string, PromoEntry>;
  mixto: Record<string, PromoEntry>;
  intensivo: Record<string, PromoEntry>;
}

interface ItemSeleccionado {
  id: number;
  tipo: 'instrumento' | 'taller';
  nombre: string;
  clases: number;
}

// Precios por defecto (fallback)
const PRECIOS_DEFAULT: PreciosMap = {
  instrumento: {
    1: { total: 20, sesion: 20 },
    8: { total: 160, sesion: 20 },
    12: { total: 200, sesion: 16.67 },
    20: { total: 300, sesion: 15 },
  },
  taller: {
    1: { total: 17.50, sesion: 17.50 },
    8: { total: 140, sesion: 17.50 },
    12: { total: 180, sesion: 15 },
    20: { total: 250, sesion: 12.50 },
  },
};

function construirPreciosDesdeAPI(data: PrecioPaquete[]): PreciosMap {
  const precios: PreciosMap = { instrumento: {}, taller: {} };

  for (const p of data) {
    if (p.tipo_paquete === 'individual' && p.activo) {
      precios[p.tipo_taller][p.cantidad_clases] = {
        total: Number(p.precio_total),
        sesion: Number(p.precio_por_sesion),
      };
    }
  }

  // Si no hay precios de algún tipo, usar defaults
  if (Object.keys(precios.instrumento).length === 0) {
    precios.instrumento = { ...PRECIOS_DEFAULT.instrumento };
  }
  if (Object.keys(precios.taller).length === 0) {
    precios.taller = { ...PRECIOS_DEFAULT.taller };
  }

  return precios;
}

function construirPromosDesdeAPI(data: PrecioPaquete[]): PromosMap {
  const promos: PromosMap = { combo_musical: {}, mixto: {}, intensivo: {} };

  for (const p of data) {
    if (!p.activo) continue;

    if (p.tipo_paquete === 'combo_musical') {
      const key = p.cantidad_clases_secundaria
        ? `${p.cantidad_clases}+${p.cantidad_clases_secundaria}`
        : `${p.cantidad_clases}`;
      promos.combo_musical[key] = {
        total: Number(p.precio_total),
        descuento: 0,
      };
    } else if (p.tipo_paquete === 'mixto') {
      const key = p.cantidad_clases_secundaria
        ? `${p.cantidad_clases}+${p.cantidad_clases_secundaria}`
        : `${p.cantidad_clases}`;
      promos.mixto[key] = {
        total: Number(p.precio_total),
        descuento: 0,
      };
    } else if (p.tipo_paquete === 'intensivo') {
      // Key: tipo_taller (instrumento/taller)
      promos.intensivo[p.tipo_taller] = {
        total: Number(p.precio_total),
        descuento: 0,
      };
    }
  }

  return promos;
}

function CalculadoraPrecios() {
  const { cicloActual } = useCiclo();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [precios, setPrecios] = useState<PreciosMap>(PRECIOS_DEFAULT);
  const [promos, setPromos] = useState<PromosMap>({ combo_musical: {}, mixto: {}, intensivo: {} });
  const [loadingPrecios, setLoadingPrecios] = useState(true);
  const [items, setItems] = useState<ItemSeleccionado[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState<'instrumento' | 'taller'>('instrumento');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoClases, setNuevoClases] = useState<number>(12);
  const [cantidadSuelta, setCantidadSuelta] = useState<number>(1);

  const cargarPrecios = useCallback(async () => {
    if (!cicloActual) {
      setLoadingPrecios(false);
      return;
    }
    setLoadingPrecios(true);
    try {
      const response = await getPreciosActivos(cicloActual.id);
      if (response.data.length > 0) {
        setPrecios(construirPreciosDesdeAPI(response.data));
        setPromos(construirPromosDesdeAPI(response.data));
      }
    } catch (error) {
      console.error('Error cargando precios:', error);
      // Mantener precios por defecto
    } finally {
      setLoadingPrecios(false);
    }
  }, [cicloActual]);

  useEffect(() => {
    cargarPrecios();
  }, [cargarPrecios]);

  const agregarItem = () => {
    if (!nuevoNombre.trim()) return;

    if (nuevoClases === 1) {
      const nuevosItems: ItemSeleccionado[] = [];
      for (let i = 0; i < cantidadSuelta; i++) {
        nuevosItems.push({
          id: Date.now() + i,
          tipo: nuevoTipo,
          nombre: nuevoNombre,
          clases: 1,
        });
      }
      setItems([...items, ...nuevosItems]);
    } else {
      const newItem: ItemSeleccionado = {
        id: Date.now(),
        tipo: nuevoTipo,
        nombre: nuevoNombre,
        clases: nuevoClases,
      };
      setItems([...items, newItem]);
    }
    setNuevoNombre('');
    setCantidadSuelta(1);
  };

  const eliminarItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const calcularPrecio = () => {
    if (items.length === 0) return null;

    const instrumentos = items.filter(i => i.tipo === 'instrumento');
    const talleres = items.filter(i => i.tipo === 'taller');

    let precioBruto = 0;
    let descuento = 0;
    let promoAplicada = '';
    const desglose: { nombre: string; tipo: string; clases: number; precio: number }[] = [];

    // Calcular precio bruto individual de todos los items
    for (const item of items) {
      const precio = precios[item.tipo][item.clases];
      if (precio) {
        precioBruto += precio.total;
      }
    }

    // --- COMBO MUSICAL (2+ instrumentos) ---
    // La promo aplica solo a los 2 instrumentos del combo; los demás pagan individual
    if (instrumentos.length >= 2) {
      const instOrdenados = [...instrumentos].sort((a, b) => b.clases - a.clases);
      const primaria = instOrdenados[0].clases;
      const secundaria = instOrdenados[1].clases;
      const key = `${primaria}+${secundaria}`;

      if (promos.combo_musical[key]) {
        const precioCombo = promos.combo_musical[key].total;
        const precioIndividual2 = (precios.instrumento[primaria]?.total ?? 0) + (precios.instrumento[secundaria]?.total ?? 0);
        descuento = precioIndividual2 - precioCombo;

        // Los 2 instrumentos del combo van al desglose con precio del combo (dividido en 2)
        const precioMitad = precioCombo / 2;
        desglose.push({
          nombre: instOrdenados[0].nombre,
          tipo: 'instrumento',
          clases: primaria,
          precio: precioMitad,
        });
        desglose.push({
          nombre: instOrdenados[1].nombre,
          tipo: 'instrumento',
          clases: secundaria,
          precio: precioMitad,
        });

        // Los instrumentos restantes (3+) van a precio individual
        for (let i = 2; i < instOrdenados.length; i++) {
          const item = instOrdenados[i];
          const precioInd = precios.instrumento[item.clases]?.total ?? 0;
          desglose.push({
            nombre: item.nombre,
            tipo: 'instrumento',
            clases: item.clases,
            precio: precioInd,
          });
        }

        promoAplicada = `Combo Musical (${primaria} + ${secundaria} clases)`;
      } else {
        // No hay promo configurada para este combo - cobrar todo individual
        for (const item of items) {
          const precio = precios[item.tipo][item.clases];
          if (precio) {
            desglose.push({
              nombre: item.nombre,
              tipo: item.tipo,
              clases: item.clases,
              precio: precio.total,
            });
          }
        }
      }
    }
    // --- MIXTO (1 instrumento + 1 taller) ---
    else if (instrumentos.length === 1 && talleres.length === 1) {
      const primaria = Math.max(instrumentos[0].clases, talleres[0].clases);
      const secundaria = Math.min(instrumentos[0].clases, talleres[0].clases);
      const key = `${primaria}+${secundaria}`;

      if (promos.mixto[key]) {
        const precioMixto = promos.mixto[key].total;
        const precioIndividual2 =
          (precios[instrumentos[0].tipo][instrumentos[0].clases]?.total ?? 0) +
          (precios[talleres[0].tipo][talleres[0].clases]?.total ?? 0);
        descuento = precioIndividual2 - precioMixto;

        const precioMitad = precioMixto / 2;
        desglose.push({
          nombre: instrumentos[0].nombre,
          tipo: instrumentos[0].tipo,
          clases: instrumentos[0].clases,
          precio: precioMitad,
        });
        desglose.push({
          nombre: talleres[0].nombre,
          tipo: talleres[0].tipo,
          clases: talleres[0].clases,
          precio: precioMitad,
        });

        promoAplicada = `Mixto (${primaria} + ${secundaria} clases)`;
      } else {
        for (const item of items) {
          const precio = precios[item.tipo][item.clases];
          if (precio) {
            desglose.push({
              nombre: item.nombre,
              tipo: item.tipo,
              clases: item.clases,
              precio: precio.total,
            });
          }
        }
      }
    }
    // --- INTENSIVO (20 clases) ---
    else if (items.some(i => i.clases === 20)) {
      const item20 = items.find(i => i.clases === 20);
      if (item20 && promos.intensivo[item20.tipo]) {
        const precioIndividual = precios[item20.tipo][20]?.total ?? 0;
        const precioPromo = promos.intensivo[item20.tipo].total;
        descuento = precioIndividual - precioPromo;

        for (const item of items) {
          if (item.clases === 20 && item.tipo === item20.tipo) {
            desglose.push({
              nombre: item.nombre,
              tipo: item.tipo,
              clases: 20,
              precio: precioPromo,
            });
          } else {
            const precio = precios[item.tipo][item.clases];
            if (precio) {
              desglose.push({
                nombre: item.nombre,
                tipo: item.tipo,
                clases: item.clases,
                precio: precio.total,
              });
            }
          }
        }
        promoAplicada = `Intensivo ${item20.tipo} (20 clases)`;
      } else {
        for (const item of items) {
          const precio = precios[item.tipo][item.clases];
          if (precio) {
            desglose.push({
              nombre: item.nombre,
              tipo: item.tipo,
              clases: item.clases,
              precio: precio.total,
            });
          }
        }
      }
    }
    // --- SIN PROMOCION ---
    else {
      for (const item of items) {
        const precio = precios[item.tipo][item.clases];
        if (precio) {
          desglose.push({
            nombre: item.nombre,
            tipo: item.tipo,
            clases: item.clases,
            precio: precio.total,
          });
        }
      }
    }

    return {
      precioBruto,
      descuento,
      precioFinal: precioBruto - descuento,
      promoAplicada,
      desglose,
    };
  };

  const resultado = calcularPrecio();
  const precioSueltaRef = precios[nuevoTipo][1]?.total ?? 0;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
          Calculadora de Precios
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          {loadingPrecios ? 'Cargando precios...' : `Precios del ciclo: ${cicloActual?.nombre ?? 'No seleccionado'}`}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
        {/* Panel izquierdo - Agregar items */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
              Agregar Clase
            </h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Tipo</label>
                <select
                  value={nuevoTipo}
                  onChange={(e) => setNuevoTipo(e.target.value as 'instrumento' | 'taller')}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
                >
                  <option value="instrumento">Instrumento</option>
                  <option value="taller">Taller</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Nombre</label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Guitarra, Piano, Dibujo..."
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Clases</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 8, 12, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNuevoClases(n)}
                      style={{
                        flex: 1,
                        padding: '0.75rem 0.5rem',
                        minHeight: '44px',
                        border: nuevoClases === n ? '2px solid #8b5cf6' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: nuevoClases === n ? '#ede9fe' : 'white',
                        fontWeight: nuevoClases === n ? '600' : '400',
                        cursor: 'pointer',
                      }}
                    >
                      {n === 1 ? 'Suelta' : n}
                    </button>
                  ))}
                </div>
                {nuevoClases === 1 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Cantidad de clases sueltas</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setCantidadSuelta(Math.max(1, cantidadSuelta - 1))}
                        style={{
                          width: '44px', height: '44px',
                          border: '1px solid #d1d5db', borderRadius: '8px',
                          background: 'white', cursor: 'pointer',
                          fontSize: '1.25rem', fontWeight: '600',
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={cantidadSuelta}
                        onChange={(e) => setCantidadSuelta(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        style={{
                          width: '60px', padding: '0.5rem',
                          border: '1px solid #d1d5db', borderRadius: '8px',
                          textAlign: 'center', fontWeight: '600',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setCantidadSuelta(cantidadSuelta + 1)}
                        style={{
                          width: '44px', height: '44px',
                          border: '1px solid #d1d5db', borderRadius: '8px',
                          background: 'white', cursor: 'pointer',
                          fontSize: '1.25rem', fontWeight: '600',
                        }}
                      >
                        +
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        = S/. {(cantidadSuelta * precioSueltaRef).toFixed(2)} total
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={agregarItem}
                disabled={!nuevoNombre.trim()}
                style={{
                  padding: '0.75rem',
                  minHeight: '48px',
                  background: !nuevoNombre.trim() ? '#e5e7eb' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: !nuevoNombre.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                + Agregar
              </button>
            </div>
          </div>

          {/* Items seleccionados */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
              Clases Seleccionadas ({items.length})
            </h3>
            {items.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
                Agrega clases para calcular el precio
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem',
                      background: item.tipo === 'instrumento' ? '#ede9fe' : '#fef3c7',
                      borderRadius: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: '600', color: '#111827' }}>{item.nombre}</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        {item.tipo === 'instrumento' ? 'Instrumento' : 'Taller'} · {item.clases} clases
                      </span>
                    </div>
                    <button
                      onClick={() => eliminarItem(item.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '600', padding: '0.5rem', minHeight: '44px', minWidth: '44px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho - Resultado */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', position: 'sticky', top: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
              Resumen de Precio
            </h3>

            {!resultado ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                Agrega clases para ver el cálculo
              </p>
            ) : (
              <div>
                {/* Desglose */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>DESGLOSE</p>
                  {resultado.desglose.map((d, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#374151' }}>{d.nombre} ({d.clases} clases)</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>S/. {d.precio.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Precio bruto */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <span style={{ color: '#374151' }}>Precio bruto</span>
                  <span style={{ fontFamily: 'monospace' }}>S/. {resultado.precioBruto.toFixed(2)}</span>
                </div>

                {/* Descuento si aplica */}
                {resultado.descuento > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', color: '#059669' }}>
                    <span>Promoción: {resultado.promoAplicada}</span>
                    <span style={{ fontFamily: 'monospace' }}>-S/. {resultado.descuento.toFixed(2)}</span>
                  </div>
                )}

                {/* Total */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '1rem', marginTop: '1rem',
                  background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac',
                }}>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '1.125rem' }}>TOTAL</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1.25rem', color: '#059669' }}>
                    S/. {resultado.precioFinal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de precios de referencia (desde API) */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
              Tabla de Precios
            </h3>
            {loadingPrecios ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem', fontSize: '0.875rem' }}>Cargando...</p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Tipo</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>1</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>8</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>12</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>20</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem', fontWeight: '500', color: '#8b5cf6' }}>Instrumento</td>
                      {[1, 8, 12, 20].map(n => (
                        <td key={n} style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {precios.instrumento[n]?.total.toFixed(2) ?? '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem', fontWeight: '500', color: '#f59e0b' }}>Taller</td>
                      {[1, 8, 12, 20].map(n => (
                        <td key={n} style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {precios.taller[n]?.total.toFixed(2) ?? '-'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginTop: '1rem', marginBottom: '0.5rem', color: '#111827' }}>
                  Promociones
                </h4>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.75rem' }}>
                  {Object.keys(promos.combo_musical).length > 0 && (
                    <div style={{ padding: '0.5rem', background: '#ede9fe', borderRadius: '6px' }}>
                      <strong>Combo Musical (2 Instrumentos):</strong>
                      {Object.entries(promos.combo_musical)
                        .sort(([a], [b]) => {
                          const [a1] = a.split('+').map(Number);
                          const [b1] = b.split('+').map(Number);
                          return b1 - a1;
                        })
                        .map(([clases, promo]) => ` ${clases} clases = S/. ${promo.total.toFixed(2)}`)
                        .join(' | ')}
                    </div>
                  )}
                  {Object.keys(promos.mixto).length > 0 && (
                    <div style={{ padding: '0.5rem', background: '#fef3c7', borderRadius: '6px' }}>
                      <strong>Mixto (Instrumento + Taller):</strong>
                      {Object.entries(promos.mixto)
                        .sort(([a], [b]) => {
                          const [a1] = a.split('+').map(Number);
                          const [b1] = b.split('+').map(Number);
                          return b1 - a1;
                        })
                        .map(([clases, promo]) => ` ${clases} clases = S/. ${promo.total.toFixed(2)}`)
                        .join(' | ')}
                    </div>
                  )}
                  {Object.keys(promos.intensivo).length > 0 && (
                    <div style={{ padding: '0.5rem', background: '#fee2e2', borderRadius: '6px' }}>
                      <strong>Intensivo (20 clases):</strong>
                      {Object.entries(promos.intensivo)
                        .map(([tipo, promo]) => ` ${tipo} = S/. ${promo.total.toFixed(2)}`)
                        .join(' | ')}
                    </div>
                  )}
                  {Object.keys(promos.combo_musical).length === 0 && Object.keys(promos.mixto).length === 0 && Object.keys(promos.intensivo).length === 0 && (
                    <div style={{ padding: '0.5rem', background: '#f3f4f6', borderRadius: '6px', color: '#6b7280' }}>
                      No hay promociones configuradas. Configuralas en <strong>Precios → Paquetes Promocionales</strong>.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(CalculadoraPrecios);
