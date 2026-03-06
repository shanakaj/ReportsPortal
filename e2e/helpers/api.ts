import { APIRequestContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:5173';

export interface LoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  challengeName?: string;
  session?: string;
}

export interface Space {
  spaceId: string;
  spaceName: string;
  s3BucketName: string;
  createdBy: string;
  createdAt: string;
  status: string;
}

export interface Report {
  reportId: string;
  fileName: string;
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: number;
  status: string;
}

export interface FeedbackThread {
  threadId: string;
  spaceId: string;
  reportId: string;
  subject: string;
  status: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Authenticate a user via the auth API and return tokens.
 */
export async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<LoginResponse>;
}

/**
 * Complete MFA verification after login.
 */
export async function verifyMfa(
  request: APIRequestContext,
  session: string,
  mfaCode: string,
  email: string,
): Promise<LoginResponse> {
  const response = await request.post(`${API_BASE}/auth/mfa-verify`, {
    data: { session, mfaCode, email },
  });

  if (!response.ok()) {
    throw new Error(`MFA verification failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<LoginResponse>;
}

/**
 * Create a new customer space.
 */
export async function createSpace(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<Space> {
  const response = await request.post(`${API_BASE}/admin/spaces`, {
    headers: headers(token),
    data: { name },
  });

  if (!response.ok()) {
    throw new Error(`Create space failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<Space>;
}

/**
 * Delete a customer space (super_admin only).
 */
export async function deleteSpace(
  request: APIRequestContext,
  token: string,
  spaceId: string,
): Promise<void> {
  const response = await request.delete(`${API_BASE}/admin/spaces/${spaceId}`, {
    headers: headers(token),
  });

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Delete space failed: ${response.status()} ${response.statusText()}`);
  }
}

/**
 * List customer spaces.
 */
export async function listSpaces(
  request: APIRequestContext,
  token: string,
  cursor?: string,
  limit?: number,
): Promise<PaginatedResponse<Space>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));

  const response = await request.get(`${API_BASE}/admin/spaces?${params.toString()}`, {
    headers: headers(token),
  });

  if (!response.ok()) {
    throw new Error(`List spaces failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<PaginatedResponse<Space>>;
}

/**
 * Invite a user (customer) to a specific space.
 */
export async function inviteUser(
  request: APIRequestContext,
  token: string,
  spaceId: string,
  email: string,
): Promise<{ invitationId: string }> {
  const response = await request.post(`${API_BASE}/admin/spaces/${spaceId}/invite`, {
    headers: headers(token),
    data: { email },
  });

  if (!response.ok()) {
    throw new Error(`Invite user failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<{ invitationId: string }>;
}

/**
 * Invite a new admin (super_admin only, @versent.com.au only).
 */
export async function inviteAdmin(
  request: APIRequestContext,
  token: string,
  email: string,
): Promise<{ invitationId: string }> {
  const response = await request.post(`${API_BASE}/admin/invite-admin`, {
    headers: headers(token),
    data: { email },
  });

  if (!response.ok()) {
    throw new Error(`Invite admin failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<{ invitationId: string }>;
}

/**
 * Upload a report to a space. Uses the presigned URL flow:
 * 1. Request presigned URL from API
 * 2. Upload file directly to S3
 */
export async function uploadReport(
  request: APIRequestContext,
  token: string,
  spaceId: string,
  fileName: string,
  fileContent: Buffer,
): Promise<Report> {
  // Step 1: Request presigned upload URL
  const metaResponse = await request.post(`${API_BASE}/admin/spaces/${spaceId}/reports`, {
    headers: headers(token),
    data: { fileName, fileSize: fileContent.length, contentType: 'text/html' },
  });

  if (!metaResponse.ok()) {
    throw new Error(`Upload report metadata failed: ${metaResponse.status()} ${metaResponse.statusText()}`);
  }

  const metaData = (await metaResponse.json()) as {
    uploadUrl: string;
    reportId: string;
    report: Report;
  };

  // Step 2: Upload file to presigned URL
  if (metaData.uploadUrl) {
    const uploadResponse = await request.put(metaData.uploadUrl, {
      data: fileContent,
      headers: { 'Content-Type': 'text/html' },
    });

    if (!uploadResponse.ok()) {
      throw new Error(`S3 upload failed: ${uploadResponse.status()} ${uploadResponse.statusText()}`);
    }
  }

  return metaData.report || ({ reportId: metaData.reportId } as Report);
}

/**
 * Delete a report from a space.
 */
export async function deleteReport(
  request: APIRequestContext,
  token: string,
  spaceId: string,
  reportId: string,
): Promise<void> {
  const response = await request.delete(
    `${API_BASE}/admin/spaces/${spaceId}/reports/${reportId}`,
    { headers: headers(token) },
  );

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Delete report failed: ${response.status()} ${response.statusText()}`);
  }
}

/**
 * List reports in a space.
 */
export async function listReports(
  request: APIRequestContext,
  token: string,
  spaceId: string,
): Promise<PaginatedResponse<Report>> {
  const response = await request.get(`${API_BASE}/admin/spaces/${spaceId}/reports?limit=50`, {
    headers: headers(token),
  });

  if (!response.ok()) {
    throw new Error(`List reports failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<PaginatedResponse<Report>>;
}

/**
 * Create a new feedback thread on a report.
 */
export async function createFeedback(
  request: APIRequestContext,
  token: string,
  spaceId: string,
  reportId: string,
  subject: string,
  message: string,
  attachments?: string[],
): Promise<FeedbackThread> {
  const response = await request.post(
    `${API_BASE}/spaces/${spaceId}/reports/${reportId}/feedback`,
    {
      headers: headers(token),
      data: { subject, message, attachments: attachments || [] },
    },
  );

  if (!response.ok()) {
    throw new Error(`Create feedback failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<FeedbackThread>;
}

/**
 * Reply to a feedback thread.
 */
export async function replyToFeedback(
  request: APIRequestContext,
  token: string,
  threadId: string,
  message: string,
  attachments?: string[],
): Promise<{ messageId: string }> {
  const response = await request.post(`${API_BASE}/feedback/threads/${threadId}/reply`, {
    headers: headers(token),
    data: { message, attachments: attachments || [] },
  });

  if (!response.ok()) {
    throw new Error(`Reply to feedback failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<{ messageId: string }>;
}

/**
 * Update feedback thread status (admin/super_admin only).
 */
export async function updateFeedbackStatus(
  request: APIRequestContext,
  token: string,
  threadId: string,
  status: 'open' | 'resolved' | 'archived',
): Promise<void> {
  const response = await request.put(`${API_BASE}/feedback/threads/${threadId}/status`, {
    headers: headers(token),
    data: { status },
  });

  if (!response.ok()) {
    throw new Error(`Update feedback status failed: ${response.status()} ${response.statusText()}`);
  }
}

/**
 * List feedback threads for a report.
 */
export async function listFeedbackThreads(
  request: APIRequestContext,
  token: string,
  spaceId: string,
  reportId: string,
): Promise<PaginatedResponse<FeedbackThread>> {
  const response = await request.get(
    `${API_BASE}/spaces/${spaceId}/reports/${reportId}/feedback?limit=50`,
    { headers: headers(token) },
  );

  if (!response.ok()) {
    throw new Error(`List feedback threads failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<PaginatedResponse<FeedbackThread>>;
}

/**
 * Get feedback thread messages.
 */
export async function getFeedbackThread(
  request: APIRequestContext,
  token: string,
  threadId: string,
): Promise<{
  thread: FeedbackThread;
  messages: Array<{
    messageId: string;
    authorName: string;
    authorRole: string;
    message: string;
    createdAt: string;
  }>;
}> {
  const response = await request.get(`${API_BASE}/feedback/threads/${threadId}?limit=50`, {
    headers: headers(token),
  });

  if (!response.ok()) {
    throw new Error(`Get feedback thread failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json();
}

/**
 * Start impersonation session (super_admin only).
 */
export async function startImpersonation(
  request: APIRequestContext,
  token: string,
  userId: string,
): Promise<{ accessToken: string }> {
  const response = await request.post(`${API_BASE}/admin/impersonate/${userId}`, {
    headers: headers(token),
  });

  if (!response.ok()) {
    throw new Error(`Start impersonation failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<{ accessToken: string }>;
}

/**
 * End impersonation session.
 */
export async function endImpersonation(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  const response = await request.delete(`${API_BASE}/admin/impersonate`, {
    headers: headers(token),
  });

  if (!response.ok()) {
    throw new Error(`End impersonation failed: ${response.status()} ${response.statusText()}`);
  }
}

/**
 * List users (admin).
 */
export async function listUsers(
  request: APIRequestContext,
  token: string,
  params?: { role?: string; spaceId?: string; limit?: number },
): Promise<PaginatedResponse<{ userId: string; email: string; role: string; status: string }>> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.set('role', params.role);
  if (params?.spaceId) searchParams.set('spaceId', params.spaceId);
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const response = await request.get(`${API_BASE}/admin/users?${searchParams.toString()}`, {
    headers: headers(token),
  });

  if (!response.ok()) {
    throw new Error(`List users failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json();
}
