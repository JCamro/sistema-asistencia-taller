import { memo } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth';

interface TallerOption {
  id: number;
  nombre: string;
}

interface HorarioOption {
  id: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

interface ProfesorOption {
  id: number;
  nombre: string;
  apellido: string;
}

interface AsistenciasFilterBarProps {
  fecha: string;
  onFechaChange: (value: string) => void;
  tallerSeleccionado: number | null;
  onTallerChange: (value: number | null) => void;
  horarioSeleccionado: number | null;
  onHorarioChange: (value: number | null) => void;
  profesorSeleccionado: number | null;
  onProfesorChange: (value: number | null) => void;
  profesorBloqueado: boolean;
  onToggleProfesorBloqueado: () => void;
  onClear: () => void;
  talleres: TallerOption[];
  horariosFiltrados: HorarioOption[];
  profesores: ProfesorOption[];
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  color: '#1f2937',
  background: '#fafafa',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

/**
 * AsistenciasFilterBar — Filtros para el registro de asistencia diaria
 *
 * Flujo de selección en cascada: Fecha → Taller (según día) → Horario → Profesor.
 * Al cambiar la fecha, se resetea el horario. Al cambiar el taller, se resetea
 * el horario. El profesor se auto-asigna desde el horario y queda bloqueado.
 */
function AsistenciasFilterBar({
  fecha,
  onFechaChange,
  tallerSeleccionado,
  onTallerChange,
  horarioSeleccionado,
  onHorarioChange,
  profesorSeleccionado,
  onProfesorChange,
  profesorBloqueado,
  onToggleProfesorBloqueado,
  onClear,
  talleres,
  horariosFiltrados,
  profesores,
}: AsistenciasFilterBarProps) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: isMobile ? '0.75rem' : '1rem', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => onFechaChange(e.target.value)}
            style={inputBase}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Taller
          </label>
          <select
            value={tallerSeleccionado || ''}
            onChange={(e) => onTallerChange(e.target.value ? parseInt(e.target.value) : null)}
            style={{ ...inputBase, cursor: 'pointer', background: 'white' }}
          >
            <option value="">Seleccionar taller</option>
            {talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Horario
          </label>
          <select
            value={horarioSeleccionado || ''}
            onChange={(e) => onHorarioChange(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!tallerSeleccionado}
            style={{ ...inputBase, opacity: tallerSeleccionado ? 1 : 0.4, cursor: tallerSeleccionado ? 'pointer' : 'default', background: tallerSeleccionado ? 'white' : '#f5f5f5' }}
          >
            <option value="">{tallerSeleccionado ? 'Seleccionar horario' : 'Primero seleccione un taller'}</option>
            {horariosFiltrados.map((h) => (
              <option key={h.id} value={h.id}>
                {h.dia_nombre} {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Profesor
            </label>
            {horarioSeleccionado && (
              <button
                type="button"
                onClick={onToggleProfesorBloqueado}
                style={{
                  fontSize: '0.7rem',
                  color: profesorBloqueado ? '#d97706' : '#059669',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                {profesorBloqueado ? 'Cambiar' : 'Bloquear'}
              </button>
            )}
          </div>
          <select
            value={profesorSeleccionado || ''}
            onChange={(e) => onProfesorChange(e.target.value ? parseInt(e.target.value) : null)}
            disabled={horarioSeleccionado ? profesorBloqueado : false}
            style={{
              ...inputBase,
              opacity: horarioSeleccionado && profesorBloqueado ? 0.6 : 1,
              background: horarioSeleccionado && profesorBloqueado ? '#f5f5f5' : 'white',
              cursor: horarioSeleccionado && profesorBloqueado ? 'default' : 'pointer',
            }}
          >
            <option value="">{horarioSeleccionado ? 'Docente del horario' : 'Seleccionar profesor'}</option>
            {profesores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellido}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={onClear}
          style={{ fontSize: '0.75rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}

export default memo(AsistenciasFilterBar);
