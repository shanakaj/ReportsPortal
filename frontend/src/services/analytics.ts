import api from '@/services/api';
import type { AnalyticsSummary } from '@/types';

export async function getSpaceAnalytics(
  spaceId: string,
  from?: string,
  to?: string,
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get<AnalyticsSummary>(
    `/admin/analytics/spaces/${spaceId}?${params}`,
  );
  return data;
}

export async function getUserAnalytics(
  userId: string,
  from?: string,
  to?: string,
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get<AnalyticsSummary>(
    `/admin/analytics/users/${userId}?${params}`,
  );
  return data;
}

export async function exportAnalytics(params: {
  spaceId?: string;
  userId?: string;
  from?: string;
  to?: string;
  format?: 'csv' | 'json';
}): Promise<{ downloadUrl: string }> {
  const { data } = await api.post<{ downloadUrl: string }>(
    '/admin/analytics/export',
    params,
  );
  return data;
}

export function sendAnalyticsEvent(events: Array<{
  eventType: string;
  spaceId: string;
  reportId: string;
  tabHash?: string;
  tabLabel?: string;
  durationSeconds?: number;
  viewMode: 'embedded' | 'full-tab';
}>): void {
  const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
  const url = `${import.meta.env.VITE_API_BASE_URL || '/api'}/analytics/events`;
  navigator.sendBeacon(url, blob);
}
