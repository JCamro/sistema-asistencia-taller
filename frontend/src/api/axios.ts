import axios from 'axios';

// Función para obtener la URL base del API
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  // Fallback a ruta relativa (para desarrollo o producción con proxy)
  return '/api';
};

// Instancia de axios preconfigurada para el backend Django.
// Incluye:
//   - Base URL desde variable de entorno VITE_API_URL o fallback a ruta relativa
//   - Interceptor de request que adjunta el access token JWT
//   - Interceptor de response que intenta refresh automático en 401 y redirige a /login si falla
const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: adjunta el token JWT a cada petición saliente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Singleton de refresh: evita que múltiples 401 concurrentes refresquen en paralelo.
// Si el refresh falla, limpia tokens y redirige a /login.
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          if (!refreshPromise) {
            refreshPromise = axios
              .post(`${api.defaults.baseURL}/auth/refresh/`, { refresh: refreshToken })
              .then((res) => {
                const { access } = res.data;
                localStorage.setItem('access_token', access);
                return access;
              })
              .finally(() => {
                refreshPromise = null;
              });
          }
          const access = await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
