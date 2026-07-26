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
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: isMobile ? '0.75rem' : '1rem', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => { onFechaChange(e.target.value); onHorarioChange(null); }}
            style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Taller</label>
          <select
            value={tallerSeleccionado || ''}
            onChange={(e) => {
              onTallerChange(e.target.value ? parseInt(e.target.value) : null);
              onHorarioChange(null);
            }}
            style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
          >
            <option value="">Seleccionar taller</option>
            {talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Horario</label>
          <select
            value={horarioSeleccionado || ''}
            onChange={(e) => onHorarioChange(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!tallerSeleccionado}
            style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', opacity: tallerSeleccionado ? 1 : 0.5 }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              {horarioSeleccionado ? 'Docente (asignado al horario)' : 'Profesor'}
            </label>
            {horarioSeleccionado && (
              <button
                type="button"
                onClick={onToggleProfesorBloqueado}
                style={{
                  fontSize: '0.75rem',
                  color: profesorBloqueado ? '#d97706' : '#059669',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {profesorBloqueado ? 'Cambiar profesor' : 'Bloquear del horario'}
              </button>
            )}
          </div>
          <select
            value={profesorSeleccionado || ''}
            onChange={(e) => onProfesorChange(e.target.value ? parseInt(e.target.value) : null)}
            disabled={horarioSeleccionado ? profesorBloqueado : false}
            style={{
              width: '100%',
              padding: '0.625rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              opacity: horarioSeleccionado && profesorBloqueado ? 0.7 : 1,
              background: horarioSeleccionado && profesorBloqueado ? '#f9fafb' : 'white',
            }}
          >
            <option value="">{horarioSeleccionado ? 'Docente del horario' : 'Seleccionar profesor'}</option>
            {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <button
          onClick={onClear}
          type="button"
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 12l6-6m-6 6l6 6"/></svg>
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}

export default memo(AsistenciasFilterBar);
