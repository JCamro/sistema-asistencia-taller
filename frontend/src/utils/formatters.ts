/**
 * Formatea un monto numérico como moneda en soles peruanos (PEN).
 * Usa Intl.NumberFormat con locale es-PE para el formato correcto (S/ 1,234.56).
 *
 * @param monto - Valor numérico a formatear
 * @returns String con formato de moneda (ej. "S/ 150.00")
 */
export function formatMonto(monto: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto);
}
