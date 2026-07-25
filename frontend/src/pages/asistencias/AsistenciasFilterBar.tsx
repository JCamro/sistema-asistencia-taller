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
  talleres: TallerOption[];
  horariosFiltrados: HorarioOption[];
  profesores: ProfesorOption[];
}

function AsistenciasFilterBar({
  fecha,
  onFechaChange,
  tallerSeleccionado,
  onTallerChange,
  horarioSeleccionado,
  onHorarioChange,
  profesorSeleccionado,
  onProfesorChange,
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
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
            {horarioSeleccionado ? 'Docente (asignado al horario)' : 'Profesor'}
          </label>
          <select
            value={profesorSeleccionado || ''}
            onChange={(e) => onProfesorChange(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!!horarioSeleccionado}
            style={{
              width: '100%',
              padding: '0.625rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              opacity: horarioSeleccionado ? 0.7 : 1,
              background: horarioSeleccionado ? '#f9fafb' : 'white',
            }}
          >
            <option value="">{horarioSeleccionado ? 'Docente del horario' : 'Seleccionar profesor'}</option>
            {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export default memo(AsistenciasFilterBar);
