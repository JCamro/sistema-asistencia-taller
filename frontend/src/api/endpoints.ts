import api from './axios';

// =============================================================================
// Interfaces / Tipos compartidos
// =============================================================================

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

export interface DashboardIngresos {
  ingresos_hoy: number;
  cantidad_pagos_hoy: number;
  ingresos_semana: number;
  cantidad_pagos_semana: number;
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
  metodo_pago: string;
  estado_calculado: 'activa' | 'inactiva' | 'concluida' | 'no_procesado';
  created_at: string;
  updated_at: string;
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
  alumno: number | null;
  alumno_nombre: string;
  alumnos_nombres?: string[];
  matricula_ids?: number[];
  ciclo: number;
  ciclo_nombre?: string;
  fecha_emision: string;
  monto_bruto?: number;
  monto_total: number;
  monto_pagado: number;
  descuento?: number;
  saldo_pendiente: number;
  estado: string;
  metodo_pago?: string;
  paquete_aplicado?: string;
  paquete_display?: string;
  precio_editado?: boolean;
  updated_at?: string;
  observacion?: string;
  matriculas_detalle?: Array<{
    alumno_nombre: string;
    taller_nombre: string;
    sesiones_contratadas: number;
    monto: number;
  }>;
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
  ciclo: number | null;
  ciclo_nombre: string | null;
  pago_dinamico_base: number;
  pago_dinamico_tope: number;
  porcentaje_adicional: number;
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

export interface PricingItemResponse {
  matricula_id: number;
  alumno_nombre: string;
  taller_nombre: string;
  taller_tipo: string;
  sesiones_contratadas: number;
  precio_original: number;
  precio_final: number;
  descuento_aplicado: number;
  promo_aplicada: string;
  precio_por_sesion_final: number;
}

export interface PricingPreviewResponse {
  items: PricingItemResponse[];
  total_general: number;
  descuento_total: number;
  paquete_aplicado: string;
}

export interface PricingCalculateItemResponse {
  matricula_id: number;
  alumno_nombre: string;
  taller_nombre: string;
  precio_original: number;
  precio_final: number;
  descuento_aplicado: number;
  promo_aplicada: string;
}

export interface PricingCalculateResponse {
  total_final: number;
  descuento_total: number;
  paquete_aplicado: string;
  items: PricingCalculateItemResponse[];
}

export interface PricingIndividualResponse {
  precio_total: number;
  precio_por_sesion: number;
}

export interface EstimatePricingItem {
  index: number;
  tipo_taller: string;
  cantidad_clases: number;
  precio_original: number;
  precio_final: number;
  descuento: number;
  promo_aplicada: string | null;
  precio_por_sesion: number;
}

export interface EstimatePricingResponse {
  items: EstimatePricingItem[];
  total_general: number;
  descuento_total: number;
  paquete_aplicado: string;
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
  año: number;
  mes: number;
  nombre: string;
  ingresos: number;
  egresos: number;
  balance: number;
  recibos: number;
}

// --- Feriados ---
export interface Feriado {
  id: number;
  ciclo: number;
  fecha: string;
  motivo: string;
  taller: number | null;
  taller_nombre: string | null;
  horario: number | null;
  horario_nombre: string | null;
  grupo: string | null;
  created_at: string;
  updated_at: string;
}

export type FeriadoPayload = Omit<Feriado, 'id' | 'ciclo' | 'taller_nombre' | 'horario_nombre' | 'created_at' | 'updated_at'>;

export interface FeriadoAplicarResponse {
  creadas: number;
  fecha: string;
  motivo: string;
}

export interface FeriadoGrupoAplicarResponse {
  aplicados: number;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string;
}

// --- Matrículas agrupadas / detalle ---
export interface MatriculaAgrupadaItem {
  id: number;
  taller: string;
  taller_id: number;
  taller_tipo: string;
  sesiones_consumidas: number;
  sesiones_contratadas: number;
  precio_total: string;
  estado: string;
  recibo_estado: string;
  fecha_matricula: string | null;
}

export interface MatriculaAgrupada {
  alumno_id: number;
  alumno_nombre: string;
  alumno_dni: string;
  matriculas: MatriculaAgrupadaItem[];
  activas: number;
  concluidas: number;
  sin_procesar: number;
  inactivas: number;
}

export interface MatriculaDetalleHorario {
  id: number;
  dia: string;
  dia_numero: number;
  hora_inicio: string;
  hora_fin: string;
  profesor_nombre: string;
}

export interface MatriculaDetalleAsistencia {
  id: number;
  fecha: string;
  estado: string;
  es_recuperacion: boolean;
  horario: string;
  profesor_nombre: string;
  hora: string;
  observacion: string;
}

export interface MatriculaDetalleRecibo {
  id: number;
  numero: string;
  estado: string;
  monto_total: string;
  monto_pagado: string;
}

export interface MatriculaDetalleData {
  id: number;
  alumno_id: number;
  alumno_nombre: string;
  taller: string;
  taller_id: number;
  sesiones_contratadas: number;
  sesiones_consumidas: number;
  sesiones_disponibles: number;
  precio_total: string;
  precio_por_sesion: string;
  estado: string;
  recibo_estado: string;
  recibo: MatriculaDetalleRecibo | null;
  horarios: MatriculaDetalleHorario[];
  asistencias: MatriculaDetalleAsistencia[];
  fecha_matricula: string | null;
}

export interface MatriculaDetalleResponse {
  matricula: MatriculaDetalleData;
}

export interface AlumnoDetalleMatricula {
  id: number;
  taller: string;
  taller_id: number;
  sesiones_contratadas: number;
  sesiones_consumidas: number;
  sesiones_disponibles: number;
  precio_total: string;
  estado: string;
  recibo_estado: string;
  fecha_matricula: string | null;
  asistencias: { id: number; fecha: string; estado: string; es_recuperacion: boolean }[];
}

  export interface AlumnoDetalleResponse {
  alumno: {
    id: number;
    nombre: string;
    apellido: string;
    nombre_completo: string;
    dni: string;
    telefono: string;
    email: string;
    edad: number | null;
    activo: boolean;
    created_at: string | null;
  };
  matriculas: AlumnoDetalleMatricula[];
}

export interface PorHorarioResponse {
  es_feriado: boolean;
  motivo: string | null;
  resultados: {
    matricula_id: number;
    alumno_id: number;
    alumno_nombre: string;
    sesiones_disponibles: number;
    asistencia_id: number | null;
    estado: string | null;
    observacion: string;
    profesor_id: number | null;
    profesor_nombre: string;
    es_recuperacion: boolean;
    hora: string | null;
  }[];
}

export interface PorDiaHorario {
  horario_id: number;
  taller_id: number;
  taller_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  profesor_id: number | null;
  profesor_nombre: string | null;
  es_feriado: boolean;
  alumnos: {
    matricula_id: number;
    alumno_id: number;
    alumno_nombre: string;
    sesiones_disponibles: number;
    asistencia_id: number | null;
    estado: string | null;
    observacion: string;
  }[];
}

export interface PorDiaResponse {
  fecha: string;
  dia_semana: number;
  es_feriado: boolean;
  motivo: string | null;
  horarios: PorDiaHorario[];
}

// =============================================================================
// Funciones de API agrupadas por dominio
// =============================================================================

// --- Auth ---

/** Cierra sesión enviando el refresh token al backend para blacklist y limpia localStorage */
export const logout = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    await api.post('/auth/logout/', { refresh: refreshToken });
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// --- Configuración ---

/** Obtiene la configuración de pago global o de un ciclo */
export const getConfig = (cicloId?: number) =>
  cicloId ? api.get<Configuracion>(`/ciclos/${cicloId}/config/`) : api.get<Configuracion>('/config/');
/** Actualiza la configuración de pago global o de un ciclo */
export const updateConfig = (data: Partial<Configuracion>, cicloId?: number) =>
  cicloId ? api.patch(`/ciclos/${cicloId}/config/`, data) : api.patch('/config/', data);

// --- Ciclos ---
/** Lista todos los ciclos académicos */
export const getCiclos = () => api.get<Ciclo[]>('/ciclos/');
/** Obtiene un ciclo por ID */
export const getCiclo = (id: number) => api.get<Ciclo>(`/ciclos/${id}/`);
/** Crea un nuevo ciclo académico */
export const createCiclo = (data: Partial<Ciclo>) => api.post('/ciclos/', data);
/** Actualiza parcialmente un ciclo existente */
export const updateCiclo = (id: number, data: Partial<Ciclo>) => api.patch(`/ciclos/${id}/`, data);
/** Elimina un ciclo por ID */
export const deleteCiclo = (id: number) => api.delete(`/ciclos/${id}/`);

// --- Talleres ---
/** Lista talleres con paginación, búsqueda y filtro opcional por ciclo */
export const getTalleres = (cicloId?: number, page?: number, search?: string) => {
  let params = '';
  if (search) params += `search=${encodeURIComponent(search.slice(0, 100))}&`;
  if (page) params += `page=${page}`;
  const queryString = params ? `?${params.replace(/&$/, '')}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Taller>>(`/ciclos/${cicloId}/talleres/${queryString}`)
    : api.get<PaginatedResponse<Taller>>(`/talleres/${queryString}`);
};
/** Obtiene un taller por ID */
export const getTaller = (id: number) => api.get<Taller>(`/talleres/${id}/`);
/** Crea un nuevo taller */
export const createTaller = (data: Partial<Taller>) => api.post('/talleres/', data);
/** Actualiza parcialmente un taller */
export const updateTaller = (id: number, data: Partial<Taller>) => api.patch(`/talleres/${id}/`, data);
/** Elimina un taller por ID */
export const deleteTaller = (id: number) => api.delete(`/talleres/${id}/`);

// --- Profesores ---
/** Lista profesores con paginación, búsqueda y filtro opcional por ciclo */
export const getProfesores = (cicloId?: number, page?: number, search?: string) => {
  let params = '';
  if (search) params += `search=${encodeURIComponent(search.slice(0, 100))}&`;
  if (page) params += `page=${page}`;
  const queryString = params ? `?${params.replace(/&$/, '')}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Profesor>>(`/ciclos/${cicloId}/profesores/${queryString}`)
    : api.get<PaginatedResponse<Profesor>>(`/profesores/${queryString}`);
};
/** Obtiene un profesor por ID */
export const getProfesor = (id: number) => api.get<Profesor>(`/profesores/${id}/`);
/** Crea un nuevo profesor */
export const createProfesor = (data: Partial<Profesor>) => api.post('/profesores/', data);
/** Actualiza parcialmente un profesor */
export const updateProfesor = (id: number, data: Partial<Profesor>) => api.patch(`/profesores/${id}/`, data);
/** Elimina un profesor por ID */
export const deleteProfesor = (id: number) => api.delete(`/profesores/${id}/`);

// --- Alumnos ---
/** Lista alumnos con paginación, búsqueda, ordenamiento y filtro opcional por ciclo */
export const getAlumnos = (cicloId?: number, page?: number, search?: string, ordering?: string) => {
  let params = '';
  if (search) params += `search=${encodeURIComponent(search.slice(0, 100))}&`;
  if (ordering) params += `ordering=${encodeURIComponent(ordering)}&`;
  if (page) params += `page=${page}`;
  const queryString = params ? `?${params.replace(/&$/, '')}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Alumno>>(`/ciclos/${cicloId}/alumnos/${queryString}`)
    : api.get<PaginatedResponse<Alumno>>(`/alumnos/${queryString}`);
};
/** Obtiene un alumno por ID */
export const getAlumno = (id: number) => api.get<Alumno>(`/alumnos/${id}/`);
/** Crea un nuevo alumno */
export const createAlumno = (data: Partial<Alumno>) => api.post('/alumnos/', data);
/** Actualiza parcialmente un alumno */
export const updateAlumno = (id: number, data: Partial<Alumno>) => api.patch(`/alumnos/${id}/`, data);
/** Elimina un alumno por ID */
export const deleteAlumno = (id: number) => api.delete(`/alumnos/${id}/`);

// --- Horarios ---
/** Lista horarios con paginación y filtro opcional por ciclo */
export const getHorarios = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Horario>>(`/ciclos/${cicloId}/horarios/${params}`)
    : api.get<PaginatedResponse<Horario>>(`/horarios/${params}`);
};
/** Obtiene un horario por ID */
export const getHorario = (id: number) => api.get<Horario>(`/horarios/${id}/`);
/** Crea un nuevo horario */
export const createHorario = (data: Partial<Horario>) => api.post('/horarios/', data);
/** Actualiza parcialmente un horario */
export const updateHorario = (id: number, data: Partial<Horario>) => api.patch(`/horarios/${id}/`, data);
/** Elimina un horario por ID */
export const deleteHorario = (id: number) => api.delete(`/horarios/${id}/`);

// --- Matrículas ---
/** Lista matrículas con filtros combinables: búsqueda, estado, taller, día, hora, ordenamiento */
export const getMatriculas = (cicloId?: number, page?: number, search?: string, estado?: string, ordering?: string, taller?: number | string, dia?: number | string, hora?: number | string) => {
  let params = '';
  if (search) params += `search=${encodeURIComponent(search.slice(0, 100))}&`;
  if (estado && estado !== 'todas') params += `estado=${encodeURIComponent(estado)}&`;
  if (ordering) params += `ordering=${encodeURIComponent(ordering)}&`;
  if (taller !== undefined && taller !== '') params += `taller=${encodeURIComponent(taller)}&`;
  if (dia !== undefined && dia !== '') params += `dia=${encodeURIComponent(dia)}&`;
  if (hora !== undefined && hora !== '') params += `hora=${encodeURIComponent(hora)}&`;
  if (page) params += `page=${page}`;
  const queryString = params ? `?${params.replace(/&$/, '')}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Matricula>>(`/ciclos/${cicloId}/matriculas/${queryString}`)
    : api.get<PaginatedResponse<Matricula>>(`/matriculas/${queryString}`);
};
/** Obtiene una matrícula por ID */
export const getMatricula = (id: number) => api.get<Matricula>(`/matriculas/${id}/`);
/** Crea una nueva matrícula */
export const createMatricula = (data: Partial<Matricula>) => api.post('/matriculas/', data);
/** Actualiza parcialmente una matrícula */
export const updateMatricula = (id: number, data: Partial<Matricula>) => api.patch(`/matriculas/${id}/`, data);
/** Elimina una matrícula por ID */
export const deleteMatricula = (id: number) => api.delete(`/matriculas/${id}/`);

// --- Asistencias ---
/** Lista asistencias con paginación y filtro opcional por ciclo */
export const getAsistencias = (cicloId?: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return cicloId 
    ? api.get<PaginatedResponse<Asistencia>>(`/ciclos/${cicloId}/asistencias/${params}`)
    : api.get<PaginatedResponse<Asistencia>>(`/asistencias/${params}`);
};
/** Registra una nueva asistencia */
export const createAsistencia = (data: Partial<Asistencia>) => api.post('/asistencias/', data);
/** Actualiza el estado u observación de una asistencia */
export const updateAsistencia = (id: number, data: Partial<Asistencia>) => api.patch(`/asistencias/${id}/`, data);

// --- Recibos ---
/** Lista recibos con filtros vía query string (estado, rango de fechas, etc.) */
export const getRecibos = (cicloId?: number, params?: string) => {
  const query = params ? `?${params}` : '';
  return cicloId ? api.get<PaginatedResponse<Recibo>>(`/ciclos/${cicloId}/recibos/${query}`) : api.get<PaginatedResponse<Recibo>>(`/recibos/${query}`);
};
/** Obtiene un recibo por ID */
export const getRecibo = (id: number) => api.get<Recibo>(`/recibos/${id}/`);
/** Crea un nuevo recibo (con soporte multi-alumno vía ReciboMatricula) */
export const createRecibo = (data: Partial<Recibo>) => api.post('/recibos/', data);
/** Marca un recibo como pagado, opcionalmente con un monto específico */
export const marcarReciboPagado = (id: number, monto?: number) => 
  api.patch(`/recibos/${id}/marcar_pagado/`, { monto });
/** Obtiene totales agregados de recibos para un ciclo */
export const getRecibosTotals = (cicloId: number) =>
  api.get<{ total: number; pagado: number; pendiente: number }>(`/ciclos/${cicloId}/recibos/totals/`);

// --- Pagos Profesores ---
/** Lista todos los pagos a profesores registrados */
export const getPagosProfesores = () => api.get<PagoProfesor[]>('/pagos-profesores/');
/** Dispara el cálculo de pagos para un ciclo en un rango de fechas */
export const calcularPagosProfesores = (cicloId: number, fechaInicio: string, fechaFin: string) => 
  api.post('/pagos-profesores/calcular-periodo/', { ciclo_id: cicloId, fecha_inicio: fechaInicio, fecha_fin: fechaFin });

// --- Reportes ---
/** Resumen general del ciclo (usado en Finanzas) */
export const getResumenCiclo = (id: number) => api.get(`/ciclos/${id}/resumen/`);
/** Resumen financiero completo: ingresos, egresos, balance */
export const getResumenFinanzas = (id: number) => api.get<ResumenFinanzas>(`/ciclos/${id}/resumen/`);
/** Resumen mensual de ingresos/egresos por mes */
export const getResumenMensual = (id: number) => api.get<ResumenMensual[]>(`/ciclos/${id}/resumen-mensual/`);

// --- Dashboard ---
/** KPIs del dashboard: alumnos activos, talleres, matrículas del ciclo */
export const getDashboardKpis = (cicloId: number) => 
  api.get(`/ciclos/${cicloId}/dashboard/`);

/** Ingresos del día y de la semana para el toggle del dashboard */
export const getDashboardIngresos = (cicloId: number) => 
  api.get<DashboardIngresos>(`/ciclos/${cicloId}/dashboard/ingresos/`);

// --- Precios Paquete ---
/** Lista precios de paquetes (opcionalmente filtrados por ciclo) */
export const getPrecios = (cicloId?: number) =>
  cicloId ? api.get<PrecioPaquete[]>(`/ciclos/${cicloId}/precios/`) : api.get<PrecioPaquete[]>('/precios/');
/** Precios activos para un ciclo — usado por la calculadora de precios */
export const getPreciosActivos = (cicloId: number) =>
  api.get<PrecioPaquete[]>(`/precios/activos/?ciclo_id=${cicloId}`);
/** Crea un nuevo precio de paquete */
export const createPrecio = (data: Partial<PrecioPaquete>) => api.post('/precios/', data);
/** Actualiza un precio de paquete */
export const updatePrecio = (id: number, data: Partial<PrecioPaquete>) => api.patch(`/precios/${id}/`, data);
/** Elimina un precio de paquete */
export const deletePrecio = (id: number) => api.delete(`/precios/${id}/`);

// --- Pricing Engine ---

/** Previsualiza precios y promociones para una lista de matrículas */
export const previewPricing = async (matriculaIds: number[]): Promise<PricingPreviewResponse> => {
  const { data } = await api.post('/pricing/preview/', { matricula_ids: matriculaIds });
  return data;
};

/** Calcula precios y promociones para una lista de matrículas */
export const calculatePricing = async (matriculaIds: number[]): Promise<PricingCalculateResponse> => {
  const { data } = await api.post('/pricing/calculate/', { matricula_ids: matriculaIds });
  return data;
};

/** Obtiene el precio individual para un tipo de taller y cantidad de sesiones */
export const getIndividualPricing = async (
  tipoTaller: string,
  sesiones: number,
  cicloId?: number
): Promise<PricingIndividualResponse> => {
  const params: Record<string, string | number> = { tipo_taller: tipoTaller, sesiones };
  if (cicloId) params.ciclo_id = cicloId;
  const { data } = await api.get('/pricing/individual/', { params });
  return data;
};

/** Calcula precios con detección de promociones para ítems conceptuales */
export const estimatePricing = async (
  items: Array<{ tipo_taller: string; cantidad_clases: number }>,
  cicloId: number
): Promise<EstimatePricingResponse> => {
  const { data } = await api.post('/pricing/estimate/', { items, ciclo_id: cicloId });
  return data;
};

// --- Horas Trabajadas ---
export interface HoraTrabajada {
  id: number;
  profesor: number;
  profesor_nombre: string;
  ciclo: number;
  ciclo_nombre: string;
  horario: number | null;
  fecha: string;
  tipo: string;
  tipo_display: string;
  horas_trabajadas: number;
  estado: string;
  estado_display: string;
  created_from: string;
  created_from_display: string;
  num_alumnos: number;
  valor_generado: number | string;
  monto_profesor: number | string;
}

export interface HoraTrabajadaDetail extends HoraTrabajada {
  horario_info: string | null;
  monto_base: number | string;
  monto_adicional: number | string;
  ganancia_taller: number | string;
  config_snapshot: Record<string, unknown> | null;
  observacion: string;
  created_at: string;
  updated_at: string;
}

/** Lista horas trabajadas con filtros opcionales vía query string */
export const getHorasTrabajadas = (cicloId?: number, params?: string) => {
  const query = params ? `?${params}` : '';
  return cicloId
    ? api.get<PaginatedResponse<HoraTrabajada>>(`/ciclos/${cicloId}/horas-trabajadas/${query}`)
    : api.get<PaginatedResponse<HoraTrabajada>>(`/horas-trabajadas/${query}`);
};

/** Obtiene el detalle completo de una hora trabajada (incluye breakdown financiero) */
export const getHoraTrabajada = (id: number) =>
  api.get<HoraTrabajadaDetail>(`/horas-trabajadas/${id}/`);

/** Crea un registro manual de hora trabajada */
export const createHoraTrabajada = (data: Partial<HoraTrabajadaDetail>) =>
  api.post<HoraTrabajadaDetail>('/horas-trabajadas/', data);

/** Elimina un registro de hora trabajada */
export const deleteHoraTrabajada = (id: number) =>
  api.delete(`/horas-trabajadas/${id}/`);

/** Actualiza un registro de hora trabajada */
export const updateHoraTrabajada = (id: number, data: Partial<HoraTrabajadaDetail>) =>
  api.patch<HoraTrabajadaDetail>(`/horas-trabajadas/${id}/`, data);

// --- Egresos ---
/** Lista egresos con filtros opcionales vía query string */
export const getEgresos = (cicloId?: number, params?: string) => {
  const query = params ? `?${params}` : '';
  return cicloId ? api.get<PaginatedResponse<Egreso>>(`/ciclos/${cicloId}/egresos/${query}`) : api.get<PaginatedResponse<Egreso>>(`/egresos/${query}`);
};
/** Obtiene un egreso por ID */
export const getEgreso = (id: number) => api.get<Egreso>(`/egresos/${id}/`);
/** Crea un nuevo egreso (gasto de taller, pago a profesor, o gasto personal) */
export const createEgreso = (data: Partial<Egreso>, cicloId?: number) => 
  cicloId ? api.post(`/ciclos/${cicloId}/egresos/`, data) : api.post('/egresos/', data);
/** Actualiza un egreso existente */
export const updateEgreso = (id: number, data: Partial<Egreso>) => api.patch(`/egresos/${id}/`, data);
/** Elimina un egreso */
export const deleteEgreso = (id: number) => api.delete(`/egresos/${id}/`);
/** Resumen de egresos agrupados por tipo (taller, profesor, personal) */
export const getResumenEgresos = (cicloId: number) => api.get<ResumenEgresos>(`/ciclos/${cicloId}/egresos/resumen/`);
/** Historial de pagos realizados a un profesor específico */
export const getHistorialPagosProfesor = (profesorId: number, cicloId?: number, fechaDesde?: string) => {
  const params = new URLSearchParams();
  if (cicloId) params.append('ciclo_id', cicloId.toString());
  if (fechaDesde) params.append('fecha_desde', fechaDesde);
  const queryString = params.toString();
  return api.get<Egreso[]>(`/profesores/${profesorId}/historial-pagos/${queryString ? `?${queryString}` : ''}`);
};

// --- Notas y Recordatorios ---
export interface Nota {
  id: number;
  ciclo: number;
  titulo: string;
  contenido: string;
  fecha: string;
  es_recordatorio: boolean;
  fecha_vencimiento: string | null;
  leida: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotaInput {
  ciclo: number;
  titulo: string;
  contenido?: string;
  fecha?: string;
  es_recordatorio?: boolean;
  fecha_vencimiento?: string | null;
}

export interface NotaFilters {
  search?: string;
  es_recordatorio?: boolean | string;
  leida?: boolean | string;
  ordering?: string;
  page?: number;
}

/** Lista notas/recordatorios de un ciclo (paginado) */
export const getNotas = (cicloId: number, filters: NotaFilters = {}) => {
  const params = new URLSearchParams();
  params.append('ciclo_id', cicloId.toString());
  params.append('page', (filters.page ?? 1).toString());
  params.append('page_size', '20');
  if (filters.search) params.append('search', filters.search.slice(0, 100));
  if (filters.es_recordatorio !== undefined && filters.es_recordatorio !== '') {
    params.append('es_recordatorio', String(filters.es_recordatorio));
  }
  if (filters.leida !== undefined && filters.leida !== '') {
    params.append('leida', String(filters.leida));
  }
  if (filters.ordering) params.append('ordering', filters.ordering);
  return api.get<{ count: number; results: Nota[] }>(`/notas/?${params.toString()}`);
};
/** Crea una nota o recordatorio */
export const createNota = (data: NotaInput) =>
  api.post<Nota>('/notas/', data);
/** Actualiza parcialmente una nota */
export const updateNota = (id: number, data: Partial<NotaInput>) =>
  api.patch<Nota>(`/notas/${id}/`, data);
/** Elimina una nota */
export const deleteNota = (id: number) =>
  api.delete(`/notas/${id}/`);
/** Lista notas no leídas de un ciclo */
export const getNotasNoLeidas = (cicloId: number) =>
  api.get<{ count: number; results: Nota[] }>(`/notas/no_leidas/?ciclo_id=${cicloId}`);
/** Marca una nota como leída */
export const marcarLeida = (id: number) =>
  api.patch<Nota>(`/notas/${id}/marcar_leida/`);
/** Marca una nota como no leída */
export const marcarNoLeida = (id: number) =>
  api.patch<Nota>(`/notas/${id}/marcar_no_leida/`);

// --- Feriados ---
/** Lista feriados de un ciclo (paginado) */
export const getFeriados = (cicloId: number, page?: number) => {
  const params = page ? `?page=${page}` : '';
  return api.get<PaginatedResponse<Feriado>>(`/ciclos/${cicloId}/feriados/${params}`);
};
/** Crea un feriado en un ciclo */
export const createFeriado = (cicloId: number, data: Partial<FeriadoPayload>) =>
  api.post<Feriado>(`/ciclos/${cicloId}/feriados/`, data);
/** Actualiza un feriado existente */
export const updateFeriado = (cicloId: number, feriadoId: number, data: Partial<FeriadoPayload>) =>
  api.patch<Feriado>(`/ciclos/${cicloId}/feriados/${feriadoId}/`, data);
/** Elimina un feriado */
export const deleteFeriado = (cicloId: number, feriadoId: number) =>
  api.delete(`/ciclos/${cicloId}/feriados/${feriadoId}/`);
/** Aplica un feriado: marca falta a alumnos pendientes del día */
export const aplicarFeriado = (cicloId: number, feriadoId: number) =>
  api.post<FeriadoAplicarResponse>(`/ciclos/${cicloId}/feriados/${feriadoId}/aplicar/`);
/** Aplica todos los feriados de un grupo */
export const aplicarGrupo = (cicloId: number, grupoId: string) =>
  api.post<FeriadoGrupoAplicarResponse>(`/ciclos/${cicloId}/feriados/grupo/${grupoId}/aplicar/`);
/** Elimina todos los feriados de un grupo */
export const deleteGrupo = (cicloId: number, grupoId: string) =>
  api.delete(`/ciclos/${cicloId}/feriados/grupo/${grupoId}/`);

// --- Matrículas agrupadas y detalle ---
/** Lista matrículas agrupadas por alumno para un ciclo */
export const getMatriculasAgrupadas = (cicloId: number, params?: string) =>
  api.get<PaginatedResponse<MatriculaAgrupada>>(`/ciclos/${cicloId}/matriculas/agrupadas/${params ? `?${params}` : ''}`);
/** Detalle completo de un alumno dentro de un ciclo */
export const getAlumnoDetalle = (cicloId: number, alumnoId: number) =>
  api.get<AlumnoDetalleResponse>(`/ciclos/${cicloId}/alumnos/${alumnoId}/detalle/`);
/** Detalle completo de una matrícula dentro de un ciclo */
export const getMatriculaDetalle = (cicloId: number, matriculaId: number) =>
  api.get<MatriculaDetalleResponse>(`/ciclos/${cicloId}/matriculas/${matriculaId}/detalle/`);

export interface ProfesorDetalleHorario {
  id: number;
  taller: string;
  taller_id: number;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface ProfesorDetallePago {
  id: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  monto_final: string;
  horas_calculadas: number;
  total_alumnos_asistencias: number;
  estado: string;
  ganancia_taller: string;
}

export interface ProfesorDetalleData {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string | null;
  edad: number | null;
  activo: boolean;
  es_gerente: boolean;
  observaciones: string;
  horarios: ProfesorDetalleHorario[];
  pagos: ProfesorDetallePago[];
}

export interface ProfesorDetalleResponse {
  profesor: ProfesorDetalleData;
}

/** Detalle completo de un profesor dentro de un ciclo */
export const getProfesorDetalle = (cicloId: number, profesorId: number) =>
  api.get<ProfesorDetalleResponse>(`/ciclos/${cicloId}/profesores/${profesorId}/detalle/`);
