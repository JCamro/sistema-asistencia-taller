import api from './axios';
import type { AlumnoCartilla, HorarioCalendario } from '../types';
import type { ProfesorUser } from '../stores/authStore';

export interface GetAlumnosCartillaParams {
  search?: string;
  taller_id?: number;
}

export interface CicloBasic {
  id: number;
  nombre: string;
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
