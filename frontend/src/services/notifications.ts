import api from '@/services/api';
import type { Notification, PaginatedResponse } from '@/types';

export async function listNotifications(params?: {
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<Notification>> {
  const searchParams = new URLSearchParams();
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  searchParams.set('limit', String(params?.limit ?? 20));
  const { data } = await api.get<PaginatedResponse<Notification>>(
    `/notifications?${searchParams}`,
  );
  return data;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.put(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.put('/notifications/read-all');
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/count');
  return data.count;
}
