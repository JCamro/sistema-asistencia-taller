import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';

// Schema de validación para el formulario de login usando Zod.
// Ambos campos son obligatorios con mensajes de error en español.
const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

/**
 * Hook que encapsula la lógica del formulario de login:
 * validación con react-hook-form + Zod, estado de carga, y envío al endpoint JWT.
 * 
 * @returns register, handleSubmit (react-hook-form), errors de validación,
 *          isLoading, y onSubmit (función para enviar credenciales).
 */
export function useLoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  const [isLoading, setIsLoading] = useState(false);

  // POST al endpoint JWT del backend. Almacena access y refresh tokens en localStorage.
  // El interceptor de axios se encarga del refresh automático en adelante.
  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login/', data);
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
    } finally {
      setIsLoading(false);
    }
  };

  return { register, handleSubmit, errors, isLoading, onSubmit };
}
