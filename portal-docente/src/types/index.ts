/** Day note for the professor's daily overview. */
export interface NotaDia {
  id: number;
  fecha: string;
  contenido: string;
  created_at: string;
  updated_at: string;
}

/** Attendance record for a single student in a class session. */
export interface AsistenciaAlumno {
  alumno_id: number;
  alumno_nombre: string;
  estado: string;
  fecha: string;
  hora: string;
}

/** Class note for a specific session (horario + fecha). */
export interface NotaClase {
  id: number;
  horario: number;
  fecha: string;
  contenido: string;
  created_at: string;
  updated_at: string;
}

/** Horario badge shown inside a student card (nested in AlumnoCartilla). */
export interface HorarioBadge {
  id: number;
  taller_id: number;
  taller_nombre: string;
  taller_tipo: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

/** Student roll-book entry returned by the docentes alumnos API. */
export interface AlumnoCartilla {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  horarios: HorarioBadge[];
}

/** Basic cycle info returned by GET /ciclos/. */
export interface CicloBasic {
  id: number;
  nombre: string;
}

/** Student data in a calendar cell. */
export interface AlumnoCalendario {
  id: number;
  nombre: string;
  apellido: string;
  edad: number | null;
}

/** Horario data for the weekly calendar. */
export interface HorarioCalendario {
  id: number;
  taller_id: number;
  dia_semana: number;       // 0=Lun..6=Dom
  hora_inicio: string;      // "HH:MM:SS"
  hora_fin: string;
  taller_nombre: string;
  taller_tipo: string;
  profesor_nombre: string;
  alumnos_count: number;
  alumnos: AlumnoCalendario[];
}
