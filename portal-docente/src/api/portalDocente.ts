import api from './axios';
import type { AlumnoCartilla } from '../types';

export interface GetAlumnosCartillaParams {
  search?: string;
  taller_id?: number;
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
