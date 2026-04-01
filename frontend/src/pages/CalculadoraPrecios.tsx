import { useState, memo } from 'react';

// Precios base
const PRECIOS = {
  instrumento: {
    1: { total: 20, sesion: 20 },
    8: { total: 160, sesion: 20 },
    12: { total: 200, sesion: 16.67 },
    20: { total: 300, sesion: 15 }, // Intensivo
  },
  taller: {
    1: { total: 17.50, sesion: 17.50 },
    8: { total: 140, sesion: 17.50 },
    12: { total: 180, sesion: 15 },
    20: { total: 250, sesion: 12.50 }, // Intensivo
  },
};

// Paquetes promocionales
const PROMOS = {
  combo_musical: {
    '12+12': { total: 360, descuento: 40 },
    '8+8': { total: 290, descuento: 30 },
    '12+8': { total: 330, descuento: 30 },
  },
  mixto: {
    '12+12': { total: 340, descuento: 40 },
    '8+8': { total: 270, descuento: 30 },
    '12+8': { total: 310, descuento: 30 },
  },
};

interface ItemSeleccionado {
  id: number;
  tipo: 'instrumento' | 'taller';
  nombre: string;
  clases: number;
}

function CalculadoraPrecios() {
  const [items, setItems] = useState<ItemSeleccionado[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState<'instrumento' | 'taller'>('instrumento');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoClases, setNuevoClases] = useState<number>(12);
  const [cantidadSuelta, setCantidadSuelta] = useState<number>(1);

  const agregarItem = () => {
    if (!nuevoNombre.trim()) return;
    
    if (nuevoClases === 1) {
      // Agregar múltiples clases sueltas
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

    // Calcular precio bruto individual
    for (const item of items) {
      const precio = PRECIOS[item.tipo][item.clases as keyof typeof PRECIOS['instrumento']];
      if (precio) {
        precioBruto += precio.total;
        desglose.push({
          nombre: item.nombre,
          tipo: item.tipo,
          clases: item.clases,
          precio: precio.total,
        });
      }
    }

    // Detectar Combo Musical (2+ instrumentos)
    if (instrumentos.length >= 2) {
      const clases = instrumentos.map(i => i.clases).sort((a, b) => b - a);
      const key = `${clases[0]}+${clases[1]}` as keyof typeof PROMOS.combo_musical;
      if (PROMOS.combo_musical[key]) {
        const promo = PROMOS.combo_musical[key];
        descuento = precioBruto - promo.total;
        promoAplicada = `Combo Musical ${key}`;
      }
    }
    // Detectar Mixto (1 instrumento + 1 taller)
    else if (instrumentos.length === 1 && talleres.length === 1) {
      const key = `${instrumentos[0].clases}+${talleres[0].clases}` as keyof typeof PROMOS.mixto;
      if (PROMOS.mixto[key]) {
        const promo = PROMOS.mixto[key];
        descuento = precioBruto - promo.total;
        promoAplicada = `Mixto ${key}`;
      }
    }
    // Detectar Intensivo (20 clases)
    else if (items.some(i => i.clases === 20)) {
      const item20 = items.find(i => i.clases === 20);
      if (item20) {
        const precioIndividual = PRECIOS[item20.tipo][20];
        const precioIntensivo = item20.tipo === 'instrumento' ? 300 : 250;
        if (precioIndividual) {
          descuento = precioIndividual.total - precioIntensivo;
          promoAplicada = `Intensivo ${item20.tipo}`;
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

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
          Calculadora de Precios
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Simula precios y paquetes promocionales
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
                        padding: '0.5rem',
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
                          width: '36px',
                          height: '36px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          background: 'white',
                          cursor: 'pointer',
                          fontSize: '1.25rem',
                          fontWeight: '600',
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
                          width: '60px',
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          textAlign: 'center',
                          fontWeight: '600',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setCantidadSuelta(cantidadSuelta + 1)}
                        style={{
                          width: '36px',
                          height: '36px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          background: 'white',
                          cursor: 'pointer',
                          fontSize: '1.25rem',
                          fontWeight: '600',
                        }}
                      >
                        +
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        = S/. {(cantidadSuelta * PRECIOS[nuevoTipo][1].total).toFixed(2)} total
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
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
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
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }}
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
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', color: '#059669' }}>
                      <span>Promoción: {resultado.promoAplicada}</span>
                      <span style={{ fontFamily: 'monospace' }}>-S/. {resultado.descuento.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {/* Total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  marginTop: '1rem',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                }}>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '1.125rem' }}>TOTAL</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1.25rem', color: '#059669' }}>
                    S/. {resultado.precioFinal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de precios de referencia */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
              Tabla de Precios
            </h3>
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
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>20</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>160</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>200</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>300</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', fontWeight: '500', color: '#f59e0b' }}>Taller</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>17.50</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>140</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>180</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>250</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginTop: '1rem', marginBottom: '0.5rem', color: '#111827' }}>
              Promociones
            </h4>
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div style={{ padding: '0.5rem', background: '#ede9fe', borderRadius: '6px' }}>
                <strong>Combo Musical (2 Instrumentos):</strong> 12+12 = S/. 360 | 8+8 = S/. 290 | 12+8 = S/. 330
              </div>
              <div style={{ padding: '0.5rem', background: '#fef3c7', borderRadius: '6px' }}>
                <strong>Mixto (Instrumento + Taller):</strong> 12+12 = S/. 340 | 8+8 = S/. 270 | 12+8 = S/. 310
              </div>
              <div style={{ padding: '0.5rem', background: '#fee2e2', borderRadius: '6px' }}>
                <strong>Intensivo:</strong> 20 Instrumento = S/. 300 | 20 Taller = S/. 250
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(CalculadoraPrecios);
