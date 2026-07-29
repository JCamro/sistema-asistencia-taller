import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCiclo } from '../contexts/CicloContext';
import { getNotasNoLeidas, marcarLeida, marcarNoLeida } from '../api/endpoints';
import { queryKeys } from '../api/queryKeys';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { cicloActual } = useCiclo();

  const {
    data: noLeidas,
    refetch: refetchBackendNotes,
  } = useQuery({
    queryKey: queryKeys.notasNoLeidas(cicloActual?.id ?? 0),
    queryFn: () => getNotasNoLeidas(cicloActual!.id).then((res) => res.data),
    enabled: !!cicloActual?.id,
  });

  const backendNotes = noLeidas?.results ?? [];
  const unreadCount = noLeidas?.count ?? 0;

  const markBackendRead = useCallback(async (id: number) => {
    await marcarLeida(id);
    queryClient.invalidateQueries({ queryKey: ['notas', cicloActual?.id ?? 0] });
    await refetchBackendNotes();
  }, [cicloActual?.id, queryClient, refetchBackendNotes]);

  const markBackendUnread = useCallback(async (id: number) => {
    await marcarNoLeida(id);
    queryClient.invalidateQueries({ queryKey: ['notas', cicloActual?.id ?? 0] });
    await refetchBackendNotes();
  }, [cicloActual?.id, queryClient, refetchBackendNotes]);

  return {
    backendNotes,
    unreadCount,
    markBackendRead,
    markBackendUnread,
    refreshBackendNotes: refetchBackendNotes,
  };
}

export type { Nota } from '../api/endpoints';
