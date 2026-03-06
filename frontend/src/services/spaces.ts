import api from '@/services/api';
import type { Space, PaginatedResponse } from '@/types';

export async function listSpaces(cursor?: string, limit = 20): Promise<PaginatedResponse<Space>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const { data } = await api.get<PaginatedResponse<Space>>(`/admin/spaces?${params}`);
  return data;
}

export async function getSpace(spaceId: string): Promise<Space> {
  const { data } = await api.get<Space>(`/admin/spaces/${spaceId}`);
  return data;
}

export async function createSpace(spaceName: string): Promise<Space> {
  const { data } = await api.post<Space>('/admin/spaces', { spaceName });
  return data;
}

export async function deleteSpace(spaceId: string): Promise<void> {
  await api.delete(`/admin/spaces/${spaceId}`);
}

export async function listCustomerSpaces(): Promise<PaginatedResponse<Space>> {
  const { data } = await api.get<PaginatedResponse<Space>>('/customer/spaces');
  return data;
}
