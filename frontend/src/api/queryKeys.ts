export const queryKeys = {
  alumnos: (cicloId: number, page: number = 1, search?: string, ordering?: string) =>
    ['alumnos', cicloId, page, search, ordering] as const,
  profesores: (cicloId: number, page: number = 1, search?: string) =>
    ['profesores', cicloId, page, search] as const,
  talleres: (cicloId: number, page: number = 1, search?: string) =>
    ['talleres', cicloId, page, search] as const,
} as const;
