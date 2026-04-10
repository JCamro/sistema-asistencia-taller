/**
 * Timezone utilities para Lima (UTC-5)
 * 
 * El backend almacena las fechas en UTC.
 * Para mostrar/guardar fechas en timezone Lima:
 * - Display: convertir UTC a Lima
 * - Submit: enviar como YYYY-MM-DD (Django interpreta como midnight Lima → convierte a UTC)
 */

const LIMA_OFFSET_HOURS = -5;

/**
 * Convierte una fecha UTC (ISO string) a la fecha en Lima
 * Ejemplo: "2026-04-17T03:00:00+00:00" → "2026-04-16" (porque 03:00 UTC = 22:00 Lima del día anterior)
 */
export function utcToLimaDate(utcIsoString: string | null | undefined): string {
  if (!utcIsoString) return '';
  
  const utcDate = new Date(utcIsoString);
  if (isNaN(utcDate.getTime())) return '';
  
  // Convertir a Lima sumando el offset
  const limaTime = utcDate.getTime() + (LIMA_OFFSET_HOURS * 60 * 60 * 1000);
  const limaDate = new Date(limaTime);
  
  // Formato YYYY-MM-DD
  const year = limaDate.getUTCFullYear();
  const month = String(limaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(limaDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Convierte una fecha Lima (YYYY-MM-DD) a ISO string en UTC
 * Ejemplo: "2026-04-17" → "2026-04-17T05:00:00.000Z" (midnight Lima = 05:00 UTC)
 */
export function limaDateToUtc(limaDateString: string | null | undefined): string {
  if (!limaDateString) return '';
  
  // Parsear la fecha en Lima timezone (asumimos midnight Lima)
  const [year, month, day] = limaDateString.split('-').map(Number);
  
  // Crear UTC date restando el offset (Lima es UTC-5, así que midnight Lima = 05:00 UTC)
  const utcDate = new Date(Date.UTC(year, month - 1, day, -LIMA_OFFSET_HOURS, 0, 0));
  
  return utcDate.toISOString();
}

/**
 * Formatea una fecha UTC para mostrar en Lima (DD/MM/YYYY)
 */
export function formatLimaDate(utcIsoString: string | null | undefined): string {
  const limaDate = utcToLimaDate(utcIsoString);
  if (!limaDate) return '';
  
  const [year, month, day] = limaDate.split('-');
  return `${day}/${month}/${year}`;
}
