// Helper para obtener la URL base del API
// Usar en todos los fetch() directos que no pasen por axios

export const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl;
  }
  // En desarrollo sin VITE_API_URL, usar ruta relativa
  // Vite proxy reenviará /api -> localhost:8000
  return '';
};

// Para compatibilidad con código existente
export const getApiUrl = getApiBaseUrl;