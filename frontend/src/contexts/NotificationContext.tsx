import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '@/services/notifications';
import { useAuth } from '@/hooks/useAuth';

interface NotificationContextValue {
  unreadCount: number;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refetch: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  return (
    <NotificationContext.Provider value={{ unreadCount, refetch }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
