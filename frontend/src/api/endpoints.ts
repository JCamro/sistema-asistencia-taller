import api from './axios';

// DRF paginated response wrapper
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Tipos
export interface Ciclo {
  id: number;
  nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface Taller {
  id: number;
  ciclo: number;
  ciclo_nombre?: string;
  nombre: string;
  tipo: string;
  tipo_display?: string;
  descripcion: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Profesor {
  id: number;
  ciclo: number;
  ciclo_nombre?: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento?: string;
  edad?: number;
  activo: boolean;
  es_gerente?: boolean;
  observaciones?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Alumno {
  id: number;
  ciclo: number;
  ciclo_nombre?: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento?: string;
  edad?: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Horario {
  id: number;
  ciclo: number;
  ciclo_nombre: string;
  taller: number;
  taller_nombre: string;
  profesor: number;
  profesor_nombre: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_disponible: number;
  activo: boolean;
}

export interface Matricula {
  id: number;
  alumno: number;
  alumno_nombre: string;
  ciclo: number;
  ciclo_nombre: string;
  taller: number;
  taller_nombre: string;
  sesiones_contratadas: number;
  precio_total: number;
  precio_por_sesion: number;
  activo: boolean;
  concluida: boolean;
  sesiones_consumidas: number;
  sesiones_disponibles: number;
  fecha_matricula: string;
}

export interface Asistencia {
  id: number;
  matricula: number;
  alumno_nombre: string;
  horario: number;
  taller_nombre: string;
  profesor: number;
  profesor_nombre: string;
  fecha: string;
  hora: string;
  estado: string;
  observacion: string;
}

export interface Recibo {
  id: number;
  numero: string;
  alumno: number;
  alumno_nombre: string;
  ciclo: number;
  ciclo_nombre: string;
  fecha_emision: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  estado: string;
}

export interface PagoProfesor {
  id: number;
  profesor: number;
  profesor_nombre: string;
  ciclo: number;
  ciclo_nombre: string;
  horas_calculadas: number;
  monto_calculado: number;
  monto_final: number;
  fecha_pago: string | null;
  estado: string;
  observacion: string;
}

export interface Configuracion {
  id: number;
  ciclo_activo: number | null;
  ciclo_activo_nombre: string | null;
  pago_dinamico_base: number;
  pago_dinamico_tope: number;
  updated_at: string;
}

export interface PrecioPaquete {
  id: number;
  ciclo: number | null;
  ciclo_nombre: string | null;
  tipo_taller: 'instrumento' | 'taller';
  tipo_paquete: string;
  cantidad_clases: number;
  cantidad_clases_secundaria: number | null;
  precio_total: number;
  precio_por_sesion: number;
  activo: boolean;
}

export interface Egreso {
  id: number;
  tipo: 'gasto_taller' | 'pago_profesor' | 'gasto_personal';
  tipo_display: string;
  monto: number;
  descripcion: string;
  fecha: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'yape' | 'plin';
  metodo_pago_display: string;
  categoria: string;
  beneficiario: string;
  profesor: number | null;
  profesor_nombre: string | null;
  ciclo: number;
  ciclo_nombre: string;
  estado: 'pendiente' | 'cancelado';
  estado_display: string;
  created_at: string;
  updated_at: string;
}

export interface ResumenEgresos {
  gasto_taller: number;
  pago_profesor: number;
  gasto_personal: number;
  total: number;
}

export interface ResumenFinanzas {
  ciclo: string;
  ingresos: {
    recibos_pagados: number;
    num_recibos: number;
  };
  egresos: {
    gasto_taller: number;
    gasto_personal: number;
    pago_profesor_manual: number;
  };
  balance: {
    total_ingresos: number;
    total_egresos: number;
    ganancia_neta: number;
    porcentaje_egresos: number;
    porcentaje_ganancia: number;
    ticket_promedio: number;
  };
}

export interface ResumenMensual {
  mes: number;
  nombre: string;
  ingresos: number;
  egresos: number;
  balance: number;
  recibos: number;
}

// API Functions
export const login = async (username: string, password: string) => {
  const response = await api.post('/auth/login/', { username, password });
  return response.data;
};

export const logout = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    await api.post('/auth/logout/', { refresh: refreshToken });
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Configuracion
export const getConfig = () => api.get<Configuracion>('/config/');
export const updateConfig = (data: Partial<Configuracion>) => api.patch('/config/', data);

// Ciclos
export const getCiclos = () => api.get<Ciclo[]>('/ciclos/');
export const getCiclo = (id: number) => api.get<Ciclo>(`/ciclos/${id}/`);
export const createCiclo = (data: Partial<Ciclo>) => api.post('/ciclos/', data);
export const updateCiclo = (id: number, data: Partial<Ciclo>) => api.patch(`/ciclos/${id}/`, data);
export const deleteCiclo = (id: number) => api.delete(`/ciclos/${id}/`);

// Talleres (filtrados por ciclo)
export const getTalleres = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Taller>>(`/ciclos/${cicloId}/talleres/${params}`)
    : api.get<PaginatedResponse<Taller>>(`/talleres/${params}`);
};
export const getTaller = (id: number) => api.get<Taller>(`/talleres/${id}/`);
export const createTaller = (data: Partial<Taller>) => api.post('/talleres/', data);
export const updateTaller = (id: number, data: Partial<Taller>) => api.patch(`/talleres/${id}/`, data);
export const deleteTaller = (id: number) => api.delete(`/talleres/${id}/`);

// Profesores (filtrados por ciclo)
export const getProfesores = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Profesor>>(`/ciclos/${cicloId}/profesores/${params}`)
    : api.get<PaginatedResponse<Profesor>>(`/profesores/${params}`);
};
export const getProfesor = (id: number) => api.get<Profesor>(`/profesores/${id}/`);
export const createProfesor = (data: Partial<Profesor>) => api.post('/profesores/', data);
export const updateProfesor = (id: number, data: Partial<Profesor>) => api.patch(`/profesores/${id}/`, data);
export const deleteProfesor = (id: number) => api.delete(`/profesores/${id}/`);

// Alumnos (filtrados por ciclo)
export const getAlumnos = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Alumno>>(`/ciclos/${cicloId}/alumnos/${params}`)
    : api.get<PaginatedResponse<Alumno>>(`/alumnos/${params}`);
};
export const getAlumno = (id: number) => api.get<Alumno>(`/alumnos/${id}/`);
export const createAlumno = (data: Partial<Alumno>) => api.post('/alumnos/', data);
export const updateAlumno = (id: number, data: Partial<Alumno>) => api.patch(`/alumnos/${id}/`, data);
export const deleteAlumno = (id: number) => api.delete(`/alumnos/${id}/`);

// Horarios (paginado)
export const getHorarios = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Horario>>(`/ciclos/${cicloId}/horarios/${params}`)
    : api.get<PaginatedResponse<Horario>>(`/horarios/${params}`);
};
export const getHorario = (id: number) => api.get<Horario>(`/horarios/${id}/`);
export const createHorario = (data: Partial<Horario>) => api.post('/horarios/', data);
export const updateHorario = (id: number, data: Partial<Horario>) => api.patch(`/horarios/${id}/`, data);
export const deleteHorario = (id: number) => api.delete(`/horarios/${id}/`);

// Matriculas (paginado)
export const getMatriculas = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Matricula>>(`/ciclos/${cicloId}/matriculas/${params}`)
    : api.get<PaginatedResponse<Matricula>>(`/matriculas/${params}`);
};
export const getMatricula = (id: number) => api.get<Matricula>(`/matriculas/${id}/`);
export const createMatricula = (data: Partial<Matricula>) => api.post('/matriculas/', data);
export const updateMatricula = (id: number, data: Partial<Matricula>) => api.patch(`/matriculas/${id}/`, data);
export const deleteMatricula = (id: number) => api.delete(`/matriculas/${id}/`);

// Asistencias (paginado)
export const getAsistencias = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Asistencia>>(`/ciclos/${cicloId}/asistencias/${params}`)
    : api.get<PaginatedResponse<Asistencia>>(`/asistencias/${params}`);
};
export const createAsistencia = (data: Partial<Asistencia>) => api.post('/asistencias/', data);
export const updateAsistencia = (id: number, data: Partial<Asistencia>) => api.patch(`/asistencias/${id}/`, data);

// Recibos
export const getRecibos = (cicloId?: number) =>
  cicloId ? api.get<Recibo[]>(`/ciclos/${cicloId}/recibos/`) : api.get<Recibo[]>('/recibos/');
export const getRecibo = (id: number) => api.get<Recibo>(`/recibos/${id}/`);
export const createRecibo = (data: Partial<Recibo>) => api.post('/recibos/', data);
export const marcarReciboPagado = (id: number, monto?: number) => 
  api.patch(`/recibos/${id}/marcar_pagado/`, { monto });

// Pagos Profesores
export const getPagosProfesores = () => api.get<PagoProfesor[]>('/pagos-profesores/');
export const calcularPagosProfesores = (cicloId: number, fechaInicio: string, fechaFin: string) => 
  api.post('/pagos-profesores/calcular-periodo/', { ciclo_id: cicloId, fecha_inicio: fechaInicio, fecha_fin: fechaFin });

// Reportes
export const getResumenCiclo = (id: number) => api.get(`/ciclos/${id}/resumen/`);
export const getResumenFinanzas = (id: number) => api.get<ResumenFinanzas>(`/ciclos/${id}/resumen/`);
export const getResumenMensual = (id: number) => api.get<ResumenMensual[]>(`/ciclos/${id}/resumen-mensual/`);

// Dashboard KPIs
export const getDashboardKpis = (cicloId: number) => 
  api.get(`/ciclos/${cicloId}/dashboard/`);

// Precios Paquete
export const getPrecios = (cicloId?: number) =>
  cicloId ? api.get<PrecioPaquete[]>(`/ciclos/${cicloId}/precios/`) : api.get<PrecioPaquete[]>('/precios/');
export const getPreciosActivos = (cicloId: number) =>
  api.get<PrecioPaquete[]>(`/precios/activos/?ciclo_id=${cicloId}`);
export const createPrecio = (data: Partial<PrecioPaquete>) => api.post('/precios/', data);
export const updatePrecio = (id: number, data: Partial<PrecioPaquete>) => api.patch(`/precios/${id}/`, data);
export const deletePrecio = (id: number) => api.delete(`/precios/${id}/`);

// Egresos
export const getEgresos = (cicloId?: number) =>
  cicloId ? api.get<Egreso[]>(`/ciclos/${cicloId}/egresos/`) : api.get<Egreso[]>('/egresos/');
export const getEgreso = (id: number) => api.get<Egreso>(`/egresos/${id}/`);
export const createEgreso = (data: Partial<Egreso>, cicloId?: number) => 
  cicloId ? api.post(`/ciclos/${cicloId}/egresos/`, data) : api.post('/egresos/', data);
export const updateEgreso = (id: number, data: Partial<Egreso>) => api.patch(`/egresos/${id}/`, data);
export const deleteEgreso = (id: number) => api.delete(`/egresos/${id}/`);
export const getResumenEgresos = (cicloId: number) => api.get<ResumenEgresos>(`/ciclos/${cicloId}/egresos/resumen/`);
export const getHistorialPagosProfesor = (profesorId: number) => 
  api.get<Egreso[]>(`/profesores/${profesorId}/historial-pagos/`);
