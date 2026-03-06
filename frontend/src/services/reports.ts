import api from '@/services/api';
import axios from 'axios';
import type { Report, PaginatedResponse, ReportViewData } from '@/types';

export async function listReports(
  spaceId: string,
  cursor?: string,
  limit = 20,
  isAdmin = true,
): Promise<PaginatedResponse<Report>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const prefix = isAdmin ? '/admin' : '/customer';
  const { data } = await api.get<PaginatedResponse<Report>>(
    `${prefix}/spaces/${spaceId}/reports?${params}`,
  );
  return data;
}

export async function getReportUploadUrl(
  spaceId: string,
  fileName: string,
  contentType: string,
): Promise<{ uploadUrl: string; reportId: string }> {
  const { data } = await api.post<{ uploadUrl: string; reportId: string }>(
    `/admin/spaces/${spaceId}/reports`,
    { fileName, contentType },
  );
  return data;
}

export async function uploadReportFile(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'text/html',
    },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  });
}

export async function deleteReport(spaceId: string, reportId: string): Promise<void> {
  await api.delete(`/admin/spaces/${spaceId}/reports/${reportId}`);
}

export async function getReport(
  spaceId: string,
  reportId: string,
  isAdmin = true,
): Promise<ReportViewData> {
  const prefix = isAdmin ? '/admin' : '/customer';
  const { data } = await api.get<ReportViewData>(
    `${prefix}/spaces/${spaceId}/reports/${reportId}`,
  );
  return data;
}
