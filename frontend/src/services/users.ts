import api from '@/services/api';
import type { User, PaginatedResponse, Role } from '@/types';

export async function listUsers(params?: {
  role?: Role;
  spaceId?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<User>> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.set('role', params.role);
  if (params?.spaceId) searchParams.set('spaceId', params.spaceId);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  searchParams.set('limit', String(params?.limit ?? 20));
  const { data } = await api.get<PaginatedResponse<User>>(`/admin/users?${searchParams}`);
  return data;
}

export async function inviteCustomer(
  spaceId: string,
  email: string,
): Promise<{ token: string }> {
  const { data } = await api.post<{ token: string }>(
    `/admin/spaces/${spaceId}/invite`,
    { email },
  );
  return data;
}

export async function inviteAdmin(email: string): Promise<{ token: string }> {
  const { data } = await api.post<{ token: string }>('/admin/invite-admin', { email });
  return data;
}

export async function disableUser(userId: string): Promise<void> {
  await api.put(`/admin/users/${userId}/disable`);
}

export async function enableUser(userId: string): Promise<void> {
  await api.put(`/admin/users/${userId}/enable`);
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}

export async function resetMfa(userId: string): Promise<void> {
  await api.put(`/admin/users/${userId}/reset-mfa`);
}

export async function impersonateUser(userId: string): Promise<{
  accessToken: string;
  idToken: string;
}> {
  const { data } = await api.post<{ accessToken: string; idToken: string }>(
    `/admin/impersonate/${userId}`,
  );
  return data;
}

export async function exitImpersonation(): Promise<void> {
  await api.delete('/admin/impersonate');
}
