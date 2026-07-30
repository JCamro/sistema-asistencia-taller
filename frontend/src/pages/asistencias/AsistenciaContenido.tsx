import { memo, useMemo } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import AsistenciaTable from './AsistenciaTable';
import AsistenciaHistorialDia from './AsistenciaHistorialDia';
import AsistenciasResumenHorarios from './AsistenciasResumenHorarios';
import AsistenciasDashboard from './AsistenciasDashboard';

interface AlumnoHorario {
  matricula_id: number;
  alumno_id: number;
  alumno_nombre: string;
  sesiones_disponibles: number;
  asistencia_id: number | null;
  estado: string | null;
  observacion: string;
  profesor_id?: number | null;
  profesor_nombre?: string;
  matricula_concluida: boolean;
}

interface Horario {
  id: number;
  taller: number;
  taller_nombre: string;
  profesor: number;
  profesor_nombre: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

interface AsistenciaItem {
  id: number;
  horario: number;
  fecha: string;
  alumno_nombre: string;
  estado: string;
  observacion: string;
  hora: string;
  es_recuperacion: boolean;
  profesor: number | null;
  profesor_nombre: string;
  activo: boolean;
  matricula_concluida: boolean;
}

export interface AsistenciaEdit {
  id: number;
  estado: string;
  observacion: string;
  profesor: number | null;
  hora: string;
}

interface AsistenciaContenidoProps {
  loading: boolean;
  fecha: string;
  tallerSeleccionado: number | null;
  horarioSeleccionado: number | null;
  horariosDelDia: Horario[];
  horariosFiltrados: Horario[];
  alumnosHorario: AlumnoHorario[];
  loadingAlumnos: boolean;
  saving: boolean;
  alumnosPorHorario: Map<number, AlumnoHorario[]>;
  loadingTodosAlumnos: boolean;
  esFeriado?: boolean;
  motivoFeriado?: string | null;
  erroresPorHorario?: Map<number, boolean>;
  onEstadoChange: (alumno: AlumnoHorario, estado: string) => void;
  onEditAsistenciaFromAlumno: (alumno: AlumnoHorario) => void;
  onEditAsistencia: (asistencia: AsistenciaEdit) => void;
  onOpenRecuperacion: () => void;
  onDashboardHorarioClick: (horarioId: number) => void;
}

/**
 * AsistenciaContenido — Layout principal de la sección de asistencias
 *
 * Estados de la interfaz:
 * - Sin taller seleccionado: muestra resumen de todos los horarios del día
 *   (AsistenciasResumenHorarios) o mensaje de "seleccioná un taller"
 * - Con horario seleccionado: layout de dos columnas con la tabla editable
 *   (AsistenciaTable) a la izquierda y el historial del día
 *   (AsistenciaHistorialDia) a la derecha
 */
function AsistenciaContenido({
  loading,
  fecha,
  tallerSeleccionado,
  horarioSeleccionado,
  horariosDelDia,
  horariosFiltrados,
  alumnosHorario,
  loadingAlumnos,
  saving,
  alumnosPorHorario,
  loadingTodosAlumnos,
  esFeriado,
  motivoFeriado,
  erroresPorHorario,
  onEstadoChange,
  onEditAsistenciaFromAlumno,
  onEditAsistencia,
  onOpenRecuperacion,
  onDashboardHorarioClick,
}: AsistenciaContenidoProps) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const estadisticas = useMemo(() => {
    const asistencias = alumnosHorario.filter(a => a.asistencia_id !== null);
    return {
      total: asistencias.length,
      asistio: asistencias.filter(a => a.estado === 'asistio').length,
      falta: asistencias.filter(a => a.estado === 'falta').length,
      falta_grave: asistencias.filter(a => a.estado === 'falta_grave').length,
    };
  }, [alumnosHorario]);

  const historialAsistencias = useMemo<AsistenciaItem[]>(() => {
    if (!horarioSeleccionado || !fecha) return [];
    return alumnosHorario
      .filter(a => a.asistencia_id !== null)
      .map(a => ({
        id: a.asistencia_id!,
        horario: horarioSeleccionado,
        fecha,
        alumno_nombre: a.alumno_nombre,
        estado: a.estado || 'sin_registrar',
        observacion: a.observacion || '',
        hora: '',
        es_recuperacion: false,
        profesor: a.profesor_id,
        profesor_nombre: a.profesor_nombre || '',
        activo: true,
        matricula_concluida: a.matricula_concluida,
      } as AsistenciaItem));
  }, [alumnosHorario, horarioSeleccionado, fecha]);
  return (
    <>
      {tallerSeleccionado && !horarioSeleccionado && (
        <AsistenciasResumenHorarios
          horarios={horariosFiltrados}
          alumnosPorHorario={alumnosPorHorario}
          loading={loadingTodosAlumnos}
        />
      )}

      {!tallerSeleccionado && horariosDelDia.length > 0 && (
        <AsistenciasDashboard
          fecha={fecha}
          horariosDelDia={horariosDelDia}
          alumnosPorHorario={alumnosPorHorario}
          loading={loadingTodosAlumnos}
          esFeriado={esFeriado}
          motivoFeriado={motivoFeriado}
          erroresPorHorario={erroresPorHorario}
          onHorarioClick={onDashboardHorarioClick}
        />
      )}

      {horariosDelDia.length === 0 && !loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          No hay horarios programados para este día
        </div>
      )}

      {esFeriado && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><strong>Feriado:</strong> {motivoFeriado || 'No se registra asistencia'}</span>
        </div>
      )}

      {horarioSeleccionado && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
          <AsistenciaTable
            alumnosHorario={alumnosHorario}
            loadingAlumnos={loadingAlumnos}
            saving={saving}
            horarioSeleccionado={horarioSeleccionado}
            horariosFiltrados={horariosFiltrados}
            isMobile={isMobile}
            estadisticas={estadisticas}
            onEstadoChange={onEstadoChange}
            onEditAsistencia={onEditAsistenciaFromAlumno}
            onOpenRecuperacion={onOpenRecuperacion}
          />

          <AsistenciaHistorialDia
            asistencias={historialAsistencias}
            horarioSeleccionado={horarioSeleccionado}
            horariosFiltrados={horariosFiltrados}
            onEditAsistencia={onEditAsistencia}
          />
        </div>
      )}
    </>
  );
}

export default memo(AsistenciaContenido);
