import { useState, useEffect, useCallback } from 'react';
import { useCiclo } from '../contexts/CicloContext';
import { useToast } from '../contexts/ToastContext';
import { getPrecios, createPrecio, updatePrecio, deletePrecio, type PrecioPaquete } from '../api/endpoints';

const CLASES_LABELS: Record<number, string> = {
  1: '1 clase',
  8: '8 clases',
  12: '12 clases',
  20: '20 clases',
};

const TIPO_PAQUETE_LABELS: Record<string, string> = {
  individual: 'Individual',
  combo_musical: 'Combo Musical',
  mixto: 'Mixto',
  intensivo: 'Intensivo',
};

const TIPO_PAQUETE_COLORS: Record<string, { bg: string; text: string }> = {
  individual: { bg: '#f3f4f6', text: '#374151' },
  combo_musical: { bg: '#ede9fe', text: '#7c3aed' },
  mixto: { bg: '#fef3c7', text: '#d97706' },
  intensivo: { bg: '#fee2e2', text: '#dc2626' },
};

type FormMode = 'create' | 'edit' | null;

export default function ConfiguracionPrecios() {
  const { cicloActual } = useCiclo();
  const toast = useToast();
  const [precios, setPrecios] = useState<PrecioPaquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editando, setEditando] = useState<PrecioPaquete | null>(null);

  // Form state
  const [tipoTaller, setTipoTaller] = useState<'instrumento' | 'taller'>('instrumento');
  const [tipoPaquete, setTipoPaquete] = useState<string>('individual');
  const [cantidadClases, setCantidadClases] = useState<number>(12);
  const [cantidadClasesSecundaria, setCantidadClasesSecundaria] = useState<number | null>(null);
  const [precioTotal, setPrecioTotal] = useState<string>('');
  const [guardando, setGuardando] = useState(false);

  const cargarPrecios = useCallback(async () => {
    if (!cicloActual) return;
    setLoading(true);
    try {
      const response = await getPrecios(cicloActual.id);
      setPrecios(response.data);
    } catch (error) {
      console.error('Error cargando precios:', error);
      toast.showToast('Error al cargar precios', 'error');
    } finally {
      setLoading(false);
    }
  }, [cicloActual, toast]);

  useEffect(() => {
    cargarPrecios();
  }, [cargarPrecios]);

  const abrirCrear = () => {
    setEditando(null);
    setTipoTaller('instrumento');
    setTipoPaquete('individual');
    setCantidadClases(12);
    setCantidadClasesSecundaria(null);
    setPrecioTotal('');
    setFormMode('create');
  };

  const abrirEditar = (precio: PrecioPaquete) => {
    setEditando(precio);
    setTipoTaller(precio.tipo_taller);
    setTipoPaquete(precio.tipo_paquete);
    setCantidadClases(precio.cantidad_clases);
    setCantidadClasesSecundaria(precio.cantidad_clases_secundaria);
    setPrecioTotal(Number(precio.precio_total).toString());
    setFormMode('edit');
  };

  const cancelar = () => {
    setFormMode(null);
    setEditando(null);
  };

  const calcularPrecioSesion = (): string => {
    const total = parseFloat(precioTotal) || 0;
    const totalClases = cantidadClases + (cantidadClasesSecundaria || 0);
    return totalClases > 0 ? (total / totalClases).toFixed(2) : '0.00';
  };

  const guardar = async () => {
    if (!cicloActual || !precioTotal) return;
    setGuardando(true);
    try {
      const precioSesion = parseFloat(calcularPrecioSesion());
      const data = {
        ciclo: cicloActual.id,
        tipo_taller: tipoTaller,
        tipo_paquete: tipoPaquete,
        cantidad_clases: cantidadClases,
        cantidad_clases_secundaria: cantidadClasesSecundaria,
        precio_total: parseFloat(precioTotal),
        precio_por_sesion: precioSesion,
        activo: true,
      };

      if (formMode === 'edit' && editando) {
        await updatePrecio(editando.id, data);
        toast.showToast('Precio actualizado', 'success');
      } else {
        await createPrecio(data);
        toast.showToast('Precio creado', 'success');
      }

      setFormMode(null);
      setEditando(null);
      await cargarPrecios();
    } catch (error: unknown) {
      console.error('Error guardando precio:', error);
      const err = error as { response?: { data?: { detail?: string } } };
      toast.showToast(err.response?.data?.detail || 'Error al guardar precio', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (precio: PrecioPaquete) => {
    const label = `${TIPO_PAQUETE_LABELS[precio.tipo_paquete]} - ${precio.tipo_taller} - ${CLASES_LABELS[precio.cantidad_clases]}`;
    if (!window.confirm(`¿Eliminar "${label}"?`)) return;
    try {
      await deletePrecio(precio.id);
      toast.showToast('Precio eliminado', 'success');
      await cargarPrecios();
    } catch (error) {
      console.error('Error eliminando precio:', error);
      toast.showToast('Error al eliminar precio', 'error');
    }
  };

  if (!cicloActual) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>Seleccioná un ciclo para configurar precios</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>Cargando precios...</p>
      </div>
    );
  }

  // Separar precios por tipo de paquete
  const preciosIndividuales = precios.filter(p => p.tipo_paquete === 'individual');
  const preciosPromos = precios.filter(p => p.tipo_paquete !== 'individual');

  // Dentro de individuales, separar por tipo_taller
  const individualesInstrumento = preciosIndividuales.filter(p => p.tipo_taller === 'instrumento').sort((a, b) => a.cantidad_clases - b.cantidad_clases);
  const individualesTaller = preciosIndividuales.filter(p => p.tipo_taller === 'taller').sort((a, b) => a.cantidad_clases - b.cantidad_clases);

  // Promos agrupadas por tipo_paquete
  const promosComboMusical = preciosPromos.filter(p => p.tipo_paquete === 'combo_musical').sort((a, b) => a.cantidad_clases - b.cantidad_clases);
  const promosMixto = preciosPromos.filter(p => p.tipo_paquete === 'mixto').sort((a, b) => a.cantidad_clases - b.cantidad_clases);
  const promosIntensivo = preciosPromos.filter(p => p.tipo_paquete === 'intensivo').sort((a, b) => a.cantidad_clases - b.cantidad_clases);

  // Opciones de clases según tipo de paquete
  const clasesOptions: Record<string, number[]> = {
    individual: [1, 8, 12, 20],
    combo_musical: [8, 12],
    mixto: [8, 12],
    intensivo: [20],
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            Configuración de Precios
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            Ciclo: <strong>{cicloActual.nombre}</strong>
          </p>
        </div>
        <button
          onClick={abrirCrear}
          style={{
            padding: '0.625rem 1.25rem',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          + Nuevo precio
        </button>
      </div>

      {/* Formulario */}
      {formMode && (
        <div style={{
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          padding: '1.5rem',
          marginBottom: 24,
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: '#111827' }}>
            {formMode === 'edit' ? 'Editar precio' : 'Nuevo precio'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Tipo de taller</label>
              <select
                value={tipoTaller}
                onChange={(e) => setTipoTaller(e.target.value as 'instrumento' | 'taller')}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8 }}
              >
                <option value="instrumento">Instrumento</option>
                <option value="taller">Taller</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Tipo de paquete</label>
              <select
                value={tipoPaquete}
                onChange={(e) => {
                  setTipoPaquete(e.target.value);
                  // Reset cantidad_clases to first valid option
                  const opts = clasesOptions[e.target.value];
                  if (opts && !opts.includes(cantidadClases)) {
                    setCantidadClases(opts[0]);
                  }
                  // Set/reset secondary classes for combo/mixto
                  if (e.target.value === 'combo_musical' || e.target.value === 'mixto') {
                    setCantidadClasesSecundaria(cantidadClasesSecundaria ?? opts?.[0] ?? 8);
                  } else {
                    setCantidadClasesSecundaria(null);
                  }
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8 }}
              >
                <option value="individual">Individual (precio base)</option>
                <option value="combo_musical">Combo Musical (2+ instrumentos)</option>
                <option value="mixto">Mixto (instrumento + taller)</option>
                <option value="intensivo">Intensivo (20 clases)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Clases</label>
              <select
                value={cantidadClases}
                onChange={(e) => setCantidadClases(parseInt(e.target.value))}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8 }}
              >
                {(clasesOptions[tipoPaquete] || [1, 8, 12, 20]).map(n => (
                  <option key={n} value={n}>{CLASES_LABELS[n]}</option>
                ))}
              </select>
            </div>
            {(tipoPaquete === 'combo_musical' || tipoPaquete === 'mixto') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Clases secundarias</label>
                <select
                  value={cantidadClasesSecundaria ?? ''}
                  onChange={(e) => setCantidadClasesSecundaria(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8 }}
                >
                  {(clasesOptions[tipoPaquete] || [8, 12]).map(n => (
                    <option key={n} value={n}>{CLASES_LABELS[n]}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Precio total (S/.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioTotal}
                onChange={(e) => setPrecioTotal(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Precio/sesión</label>
              <div style={{
                padding: '0.5rem',
                background: '#f3f4f6',
                borderRadius: 8,
                fontWeight: 600,
                color: '#6b7280',
                fontFamily: 'monospace',
              }}>
                S/. {calcularPrecioSesion()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              onClick={guardar}
              disabled={guardando || !precioTotal}
              style={{
                padding: '0.5rem 1.5rem',
                background: guardando || !precioTotal ? '#e5e7eb' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 500,
                cursor: guardando || !precioTotal ? 'not-allowed' : 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={cancelar}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: 8,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* === PRECIOS INDIVIDUALES (base) === */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: 16 }}>
        Precios Individuales
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Instrumentos */}
        <TablaPrecios
          titulo="Instrumentos"
          color="#8b5cf6"
          precios={individualesInstrumento}
          onEditar={abrirEditar}
          onEliminar={eliminar}
        />
        {/* Talleres */}
        <TablaPrecios
          titulo="Talleres"
          color="#f59e0b"
          precios={individualesTaller}
          onEditar={abrirEditar}
          onEliminar={eliminar}
        />
      </div>

      {/* === PAQUETES PROMOCIONALES === */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: 16 }}>
        Paquetes Promocionales
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {/* Combo Musical */}
        <TablaPromos
          titulo="Combo Musical (2+ Instrumentos)"
          precios={promosComboMusical}
          onEditar={abrirEditar}
          onEliminar={eliminar}
        />
        {/* Mixto */}
        <TablaPromos
          titulo="Mixto (Instrumento + Taller)"
          precios={promosMixto}
          onEditar={abrirEditar}
          onEliminar={eliminar}
        />
        {/* Intensivo */}
        <TablaPromos
          titulo="Intensivo (20 clases)"
          precios={promosIntensivo}
          onEditar={abrirEditar}
          onEliminar={eliminar}
        />
      </div>
    </div>
  );
}

// --- Componentes auxiliares ---

interface TablaPreciosProps {
  titulo: string;
  color: string;
  precios: PrecioPaquete[];
  onEditar: (p: PrecioPaquete) => void;
  onEliminar: (p: PrecioPaquete) => void;
}

function TablaPrecios({ titulo, color, precios, onEditar, onEliminar }: TablaPreciosProps) {
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color }}>{titulo}</h3>
      {precios.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 16, fontSize: '0.875rem' }}>
          No hay precios configurados
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Clases</th>
              <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Total</th>
              <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Sesión</th>
              <th style={{ padding: '8px 0', textAlign: 'center', width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {precios.map((precio) => (
              <tr key={precio.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', fontWeight: 500 }}>{CLASES_LABELS[precio.cantidad_clases]}</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                  S/. {Number(precio.precio_total).toFixed(2)}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>
                  S/. {Number(precio.precio_por_sesion).toFixed(2)}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'center' }}>
                  <button
                    onClick={() => onEditar(precio)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#8b5cf6', marginRight: 8 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onEliminar(precio)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444' }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface TablaPromosProps {
  titulo: string;
  precios: PrecioPaquete[];
  onEditar: (p: PrecioPaquete) => void;
  onEliminar: (p: PrecioPaquete) => void;
}

function TablaPromos({ titulo, precios, onEditar, onEliminar }: TablaPromosProps) {
  if (precios.length === 0) return null;

  const colors = TIPO_PAQUETE_COLORS[precios[0].tipo_paquete] || { bg: '#f3f4f6', text: '#374151' };

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: '0.75rem',
          fontWeight: 600,
          background: colors.bg,
          color: colors.text,
        }}>
          {titulo}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Clases</th>
            <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Precio promo</th>
            <th style={{ padding: '8px 0', textAlign: 'center', width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {precios.map((precio) => (
            <tr key={precio.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 0', fontWeight: 500 }}>
                {precio.cantidad_clases_secundaria
                  ? `${precio.cantidad_clases} + ${precio.cantidad_clases_secundaria} clases`
                  : CLASES_LABELS[precio.cantidad_clases]}
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 6 }}>
                  ({precio.tipo_taller})
                </span>
              </td>
              <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: colors.text }}>
                S/. {Number(precio.precio_total).toFixed(2)}
              </td>
              <td style={{ padding: '10px 0', textAlign: 'center' }}>
                <button
                  onClick={() => onEditar(precio)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#8b5cf6', marginRight: 8 }}
                >
                  Editar
                </button>
                <button
                  onClick={() => onEliminar(precio)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444' }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
