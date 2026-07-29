import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCiclo } from '../contexts/CicloContext';
import { getNotasNoLeidas, marcarLeida, marcarNoLeida, type Nota } from '../api/endpoints';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'taller_notifications';

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(-50)));
  } catch {
    // ignore storage errors
  }
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { cicloActual } = useCiclo();

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const {
    data: noLeidas,
    refetch: refetchBackendNotes,
  } = useQuery({
    queryKey: ['notas-no-leidas', cicloActual?.id],
    queryFn: () => getNotasNoLeidas(cicloActual!.id).then((res) => res.data),
    enabled: !!cicloActual?.id,
  });

  const backendNotes = noLeidas?.results ?? [];
  const backendUnreadCount = noLeidas?.count ?? 0;

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const newItem: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newItem, ...prev].slice(0, 50));
    return newItem.id;
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markBackendRead = useCallback(async (id: number) => {
    await marcarLeida(id);
    queryClient.invalidateQueries({ queryKey: ['notas', cicloActual?.id] });
    await refetchBackendNotes();
  }, [cicloActual?.id, queryClient, refetchBackendNotes]);

  const markBackendUnread = useCallback(async (id: number) => {
    await marcarNoLeida(id);
    queryClient.invalidateQueries({ queryKey: ['notas', cicloActual?.id] });
    await refetchBackendNotes();
  }, [cicloActual?.id, queryClient, refetchBackendNotes]);

  const unreadCount = notifications.filter((n) => !n.read).length + backendUnreadCount;

  return {
    notifications,
    backendNotes,
    backendUnreadCount,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    markBackendRead,
    markBackendUnread,
    refreshBackendNotes: refetchBackendNotes,
  };
}

export type { Nota };
