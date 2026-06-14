import api from './axios';
import type {
  AlumnoCartilla,
  HorarioCalendario,
  NotaDia,
  AsistenciaAlumno,
  NotaClase,
} from '../types';
import type { ProfesorUser } from '../stores/authStore';

export interface GetAlumnosCartillaParams {
  search?: string;
  taller_id?: number;
}

export interface CicloBasic {
  id: number;
  nombre: string;
  tipo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  activo?: boolean;
}

/**
 * Fetch the professor's student roll-book (cartilla) for a given cycle.
 * Results are deduplicated — each student appears once with a nested horarios list.
 *
 * @param cicloId - The cycle ID
 * @param params  - Optional search text and/or taller_id filter
 * @returns Array of AlumnoCartilla entries
 */
export async function getAlumnosCartilla(
  cicloId: number,
  params?: GetAlumnosCartillaParams
): Promise<AlumnoCartilla[]> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.taller_id) queryParams.set('taller_id', String(params.taller_id));
  const qs = queryParams.toString();
  const url = `/ciclos/${cicloId}/alumnos/${qs ? `?${qs}` : ''}`;
  const { data } = await api.get(url);
  return data;
}

/**
 * Fetch the logged-in professor's profile.
 * GET /api/portal-docente/me/
 */
export async function getMe(): Promise<ProfesorUser> {
  const { data } = await api.get('/me/');
  return data;
}

/**
 * Fetch cycles available for the logged-in professor.
 * GET /api/portal-docente/ciclos/
 */
export async function getCiclos(): Promise<CicloBasic[]> {
  const { data } = await api.get('/ciclos/');
  return data;
}

/**
 * Logout from the server — blacklists the refresh token.
 * POST /api/portal-docente/auth/logout/
 */
export async function logoutApi(refreshToken: string): Promise<void> {
  await api.post('/auth/logout/', { refresh: refreshToken });
}

/**
 * Fetch horarios (schedules) with enrolled students for the weekly calendar.
 * GET /api/portal-docente/ciclos/{cicloId}/horarios/
 */
export async function getHorarios(cicloId: number): Promise<HorarioCalendario[]> {
  const { data } = await api.get(`/ciclos/${cicloId}/horarios/`);
  return data;
}

/**
 * Fetch horario detail with enrolled students.
 * GET /api/portal-docente/ciclos/{cicloId}/horarios/{horarioId}/
 */
export async function getHorarioDetalle(
  cicloId: number,
  horarioId: number
): Promise<HorarioCalendario> {
  const { data } = await api.get(`/ciclos/${cicloId}/horarios/${horarioId}/`);
  return data;
}

/**
 * Fetch attendance records for a specific class session (read-only).
 * GET /api/portal-docente/ciclos/{cicloId}/asistencias/?horario_id=X&fecha=YYYY-MM-DD
 */
export async function getAsistencias(
  cicloId: number,
  horarioId: number,
  fecha: string
): Promise<AsistenciaAlumno[]> {
  const { data } = await api.get(
    `/ciclos/${cicloId}/asistencias/`,
    { params: { horario_id: horarioId, fecha } }
  );
  return data;
}

/**
 * Fetch class notes for a schedule.
 * GET /api/portal-docente/ciclos/{cicloId}/notas/?horario_id=X&fecha=YYYY-MM-DD
 */
export async function getNotasClase(
  cicloId: number,
  horarioId: number,
  fecha?: string
): Promise<NotaClase[]> {
  const params: Record<string, string | number> = { horario_id: horarioId };
  if (fecha) params.fecha = fecha;
  const { data } = await api.get(`/ciclos/${cicloId}/notas/`, { params });
  return data;
}

/**
 * Create a new class note.
 * POST /api/portal-docente/ciclos/{cicloId}/notas/
 */
export async function createNotaClase(
  cicloId: number,
  horarioId: number,
  fecha: string,
  contenido: string
): Promise<NotaClase> {
  const { data } = await api.post(`/ciclos/${cicloId}/notas/`, {
    horario: horarioId,
    fecha,
    contenido,
  });
  return data;
}

/**
 * Update a class note.
 * PUT /api/portal-docente/ciclos/{cicloId}/notas/{notaId}/
 */
export async function updateNotaClase(
  cicloId: number,
  notaId: number,
  contenido: string
): Promise<NotaClase> {
  const { data } = await api.put(`/ciclos/${cicloId}/notas/${notaId}/`, {
    contenido,
  });
  return data;
}

// ---------------------------------------------------------------------------
// NotaDia API
// ---------------------------------------------------------------------------

/**
 * Fetch day notes for a specific date.
 * GET /api/portal-docente/ciclos/{cicloId}/notas-dia/?fecha=YYYY-MM-DD
 */
export async function getNotasDia(
  cicloId: number,
  fecha?: string
): Promise<NotaDia[]> {
  const params: Record<string, string> = {};
  if (fecha) params.fecha = fecha;
  const { data } = await api.get(`/ciclos/${cicloId}/notas-dia/`, { params });
  return data;
}

/**
 * Create a new day note.
 * POST /api/portal-docente/ciclos/{cicloId}/notas-dia/
 */
export async function createNotaDia(
  cicloId: number,
  fecha: string,
  contenido: string
): Promise<NotaDia> {
  const { data } = await api.post(`/ciclos/${cicloId}/notas-dia/`, {
    fecha,
    contenido,
  });
  return data;
}

/**
 * Update a day note.
 * PUT /api/portal-docente/ciclos/{cicloId}/notas-dia/{notaId}/
 */
export async function updateNotaDia(
  cicloId: number,
  notaId: number,
  contenido: string
): Promise<NotaDia> {
  const { data } = await api.put(
    `/ciclos/${cicloId}/notas-dia/${notaId}/`,
    { contenido }
  );
  return data;
}

/**
 * Delete a day note.
 * DELETE /api/portal-docente/ciclos/{cicloId}/notas-dia/{notaId}/
 */
export async function deleteNotaDia(
  cicloId: number,
  notaId: number
): Promise<void> {
  await api.delete(`/ciclos/${cicloId}/notas-dia/${notaId}/`);
}
