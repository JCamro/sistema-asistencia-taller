import { create } from 'zustand';

interface ProfesorUser {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: ProfesorUser | null;
  cicloActual: { id: number; nombre: string } | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: ProfesorUser) => void;
  setCicloActual: (ciclo: { id: number; nombre: string } | null) => void;
  logout: () => void;
}

const getLocalStorage = <T>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: getLocalStorage<string | null>('pd_access_token', null),
  refreshToken: getLocalStorage<string | null>('pd_refresh_token', null),
  user: getLocalStorage<ProfesorUser | null>('pd_user', null),
  cicloActual: getLocalStorage<{ id: number; nombre: string } | null>('pd_ciclo_actual', null),

  setTokens: (access, refresh) => {
    try {
      localStorage.setItem('pd_access_token', access);
      localStorage.setItem('pd_refresh_token', refresh);
    } catch {
      // localStorage unavailable (private/incognito)
    }
    set({ accessToken: access, refreshToken: refresh });
  },

  setUser: (user) => {
    try {
      localStorage.setItem('pd_user', JSON.stringify(user));
    } catch {
      // ignore
    }
    set({ user });
  },

  setCicloActual: (ciclo) => {
    try {
      if (ciclo) {
        localStorage.setItem('pd_ciclo_actual', JSON.stringify(ciclo));
      } else {
        localStorage.removeItem('pd_ciclo_actual');
      }
    } catch {
      // ignore
    }
    set({ cicloActual: ciclo });
  },

  logout: () => {
    try {
      localStorage.removeItem('pd_access_token');
      localStorage.removeItem('pd_refresh_token');
      localStorage.removeItem('pd_user');
      localStorage.removeItem('pd_ciclo_actual');
    } catch {
      // ignore
    }
    set({ accessToken: null, refreshToken: null, user: null, cicloActual: null });
  },
}));
