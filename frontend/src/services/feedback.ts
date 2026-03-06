import api from '@/services/api';
import type { FeedbackThread, FeedbackMessage, PaginatedResponse } from '@/types';

export async function listThreads(
  spaceId: string,
  reportId: string,
  cursor?: string,
  limit = 20,
): Promise<PaginatedResponse<FeedbackThread>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const { data } = await api.get<PaginatedResponse<FeedbackThread>>(
    `/spaces/${spaceId}/reports/${reportId}/feedback?${params}`,
  );
  return data;
}

export async function createThread(
  spaceId: string,
  reportId: string,
  subject: string,
  message: string,
  attachments?: string[],
): Promise<FeedbackThread> {
  const { data } = await api.post<FeedbackThread>(
    `/spaces/${spaceId}/reports/${reportId}/feedback`,
    { subject, message, attachments },
  );
  return data;
}

export async function getThreadMessages(
  threadId: string,
  cursor?: string,
  limit = 50,
): Promise<PaginatedResponse<FeedbackMessage>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const { data } = await api.get<PaginatedResponse<FeedbackMessage>>(
    `/feedback/threads/${threadId}?${params}`,
  );
  return data;
}

export async function replyToThread(
  threadId: string,
  message: string,
  attachments?: string[],
): Promise<FeedbackMessage> {
  const { data } = await api.post<FeedbackMessage>(
    `/feedback/threads/${threadId}/reply`,
    { message, attachments },
  );
  return data;
}

export async function updateThreadStatus(
  threadId: string,
  status: 'open' | 'resolved' | 'archived',
): Promise<void> {
  await api.put(`/feedback/threads/${threadId}/status`, { status });
}

export async function getAttachmentUploadUrl(
  threadId: string,
  fileName: string,
  contentType: string,
): Promise<{ uploadUrl: string; attachmentId: string }> {
  const { data } = await api.post<{ uploadUrl: string; attachmentId: string }>(
    `/feedback/threads/${threadId}/attachments`,
    { fileName, contentType },
  );
  return data;
}

export async function getAdminInbox(params?: {
  spaceId?: string;
  status?: 'open' | 'resolved' | 'archived';
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<FeedbackThread>> {
  const searchParams = new URLSearchParams();
  if (params?.spaceId) searchParams.set('spaceId', params.spaceId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  searchParams.set('limit', String(params?.limit ?? 20));
  const { data } = await api.get<PaginatedResponse<FeedbackThread>>(
    `/admin/feedback/inbox?${searchParams}`,
  );
  return data;
}

export async function getUnreadFeedbackCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/admin/feedback/inbox/count');
  return data.count;
}
