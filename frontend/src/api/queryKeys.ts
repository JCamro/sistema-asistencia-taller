export const queryKeys = {
  alumnos: (cicloId: number, page: number = 1, search?: string, ordering?: string) =>
    ['alumnos', cicloId, page, search, ordering] as const,
  profesores: (cicloId: number, page: number = 1, search?: string) =>
    ['profesores', cicloId, page, search] as const,
  talleres: (cicloId: number, page: number = 1, search?: string) =>
    ['talleres', cicloId, page, search] as const,
  notas: (
    cicloId: number,
    page: number = 1,
    search?: string,
    esRecordatorio?: string,
    leida?: string,
    ordering?: string
  ) => ['notas', cicloId, page, search, esRecordatorio, leida, ordering] as const,
  notasNoLeidas: (cicloId: number) => ['notas-no-leidas', cicloId] as const,
} as const;
