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
