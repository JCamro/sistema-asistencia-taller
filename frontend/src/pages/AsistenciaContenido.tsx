import { memo, useMemo } from 'react';
import { useWindowWidth } from '../hooks/useWindowWidth';
import AsistenciaTable from './AsistenciaTable';
import AsistenciaHistorialDia from './AsistenciaHistorialDia';
import AsistenciasResumenHorarios from './AsistenciasResumenHorarios';

interface AlumnoHorario {
  matricula_id: number;
  alumno_id: number;
  alumno_nombre: string;
  sesiones_disponibles: number;
  asistencia_id: number | null;
  estado: string | null;
  observacion: string;
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
  asistencias: AsistenciaItem[];
  alumnosPorHorario: Map<number, AlumnoHorario[]>;
  loadingTodosAlumnos: boolean;
  onEstadoChange: (alumno: AlumnoHorario, estado: string) => void;
  onEditAsistenciaFromAlumno: (alumno: AlumnoHorario) => void;
  onEditAsistencia: (asistencia: AsistenciaEdit) => void;
  onOpenRecuperacion: () => void;
}

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
  asistencias,
  alumnosPorHorario,
  loadingTodosAlumnos,
  onEstadoChange,
  onEditAsistenciaFromAlumno,
  onEditAsistencia,
  onOpenRecuperacion,
}: AsistenciaContenidoProps) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const estadisticas = useMemo(() => {
    const asistenciaHorario = asistencias.filter((a) => a.horario === horarioSeleccionado && a.fecha === fecha && a.activo !== false);
    return {
      total: asistenciaHorario.length,
      asistio: asistenciaHorario.filter((a) => a.estado === 'asistio').length,
      falta: asistenciaHorario.filter((a) => a.estado === 'falta').length,
      falta_grave: asistenciaHorario.filter((a) => a.estado === 'falta_grave').length,
    };
  }, [asistencias, horarioSeleccionado, fecha]);

  const historialAsistencias = useMemo<AsistenciaItem[]>(() => {
    if (!horarioSeleccionado || !fecha) return [];
    return asistencias.filter((a) => a.horario === horarioSeleccionado && a.fecha === fecha && a.activo !== false);
  }, [asistencias, horarioSeleccionado, fecha]);
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
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Seleccioná un taller para ver los alumnos del día
        </div>
      )}

      {horariosDelDia.length === 0 && !loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          No hay horarios programados para este día
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
