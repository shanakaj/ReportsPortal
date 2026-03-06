import api from '@/services/api';
import type { AuditLogEntry, PaginatedResponse } from '@/types';

export async function queryAuditLog(params?: {
  actor?: string;
  action?: string;
  spaceId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<AuditLogEntry>> {
  const searchParams = new URLSearchParams();
  if (params?.actor) searchParams.set('actor', params.actor);
  if (params?.action) searchParams.set('action', params.action);
  if (params?.spaceId) searchParams.set('spaceId', params.spaceId);
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  searchParams.set('limit', String(params?.limit ?? 20));
  const { data } = await api.get<PaginatedResponse<AuditLogEntry>>(
    `/admin/audit-log?${searchParams}`,
  );
  return data;
}
