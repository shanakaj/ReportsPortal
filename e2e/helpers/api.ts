import { APIRequestContext } from '@playwright/test';
import { generateTotpCode } from './totp';

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
 * Login with full MFA support. Handles:
 * - Direct token response (no MFA challenge)
 * - SOFTWARE_TOKEN_MFA challenge (uses stored TOTP secret)
 * - MFA_SETUP challenge (associates new TOTP device, returns tokens + new secret)
 * - NEW_PASSWORD_REQUIRED challenge (sets new password, then handles MFA)
 */
export async function loginWithMfa(
  request: APIRequestContext,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<LoginResponse & { totpSecret?: string }> {
  const loginResponse = await login(request, email, password);

  // Direct tokens - no MFA challenge
  if (loginResponse.accessToken) {
    return loginResponse;
  }

  if (!loginResponse.challengeName || !loginResponse.session) {
    throw new Error(`Unexpected login response for ${email}: no tokens and no challenge`);
  }

  // Handle NEW_PASSWORD_REQUIRED (first login after admin reset)
  if (loginResponse.challengeName === 'NEW_PASSWORD_REQUIRED') {
    const firstLoginResp = await request.post(`${API_BASE}/auth/first-login`, {
      data: { session: loginResponse.session, newPassword: password },
    });
    if (!firstLoginResp.ok()) {
      throw new Error(`First login failed: ${firstLoginResp.status()} ${firstLoginResp.statusText()}`);
    }
    const firstLoginData = (await firstLoginResp.json()) as LoginResponse;

    // After password change, may get MFA_SETUP
    if (firstLoginData.challengeName === 'MFA_SETUP' && firstLoginData.secretCode) {
      return completeMfaSetup(request, firstLoginData.session!, firstLoginData.secretCode);
    }
    if (firstLoginData.accessToken) {
      return firstLoginData;
    }
    // Might get SOFTWARE_TOKEN_MFA if MFA was already set up
    if (firstLoginData.challengeName === 'SOFTWARE_TOKEN_MFA' && totpSecret) {
      const code = generateTotpCode(totpSecret);
      const mfaResp = await verifyMfa(request, firstLoginData.session!, code, email);
      return { ...mfaResp, totpSecret };
    }
    throw new Error(`Unhandled challenge after first-login: ${firstLoginData.challengeName}`);
  }

  // Handle MFA_SETUP (first time setting up TOTP)
  if (loginResponse.challengeName === 'MFA_SETUP') {
    const secretCode = (loginResponse as LoginResponse & { secretCode?: string }).secretCode;
    if (!secretCode) {
      throw new Error('MFA_SETUP challenge but no secretCode returned');
    }
    return completeMfaSetup(request, loginResponse.session, secretCode);
  }

  // Handle SOFTWARE_TOKEN_MFA (normal MFA verification)
  if (loginResponse.challengeName === 'SOFTWARE_TOKEN_MFA') {
    if (!totpSecret) {
      throw new Error(
        `SOFTWARE_TOKEN_MFA challenge for ${email} but no TOTP secret provided. ` +
          'Set the TOTP secret env var for this user.',
      );
    }
    const code = generateTotpCode(totpSecret);
    const mfaResp = await verifyMfa(request, loginResponse.session, code, email);
    return { ...mfaResp, totpSecret };
  }

  throw new Error(`Unhandled auth challenge: ${loginResponse.challengeName}`);
}

/**
 * Complete MFA setup by verifying a TOTP code generated from the new secret.
 */
async function completeMfaSetup(
  request: APIRequestContext,
  session: string,
  secretCode: string,
): Promise<LoginResponse & { totpSecret: string }> {
  const code = generateTotpCode(secretCode);
  // Verify the software token to complete MFA setup
  const verifyResp = await request.post(`${API_BASE}/auth/mfa-verify`, {
    data: { session, mfaCode: code, challengeName: 'MFA_SETUP' },
  });

  if (!verifyResp.ok()) {
    // MFA_SETUP verify might return a SOFTWARE_TOKEN_MFA challenge
    // Try with SOFTWARE_TOKEN_MFA challenge name
    const retryResp = await request.post(`${API_BASE}/auth/mfa-verify`, {
      data: { session, mfaCode: code, challengeName: 'SOFTWARE_TOKEN_MFA' },
    });
    if (!retryResp.ok()) {
      throw new Error(`MFA setup verification failed: ${retryResp.status()}`);
    }
    const retryData = (await retryResp.json()) as LoginResponse;
    return { ...retryData, totpSecret: secretCode };
  }

  const verifyData = (await verifyResp.json()) as LoginResponse;

  // May still need one more SOFTWARE_TOKEN_MFA challenge
  if (verifyData.challengeName === 'SOFTWARE_TOKEN_MFA' && verifyData.session) {
    const finalCode = generateTotpCode(secretCode);
    const finalResp = await verifyMfa(request, verifyData.session, finalCode, '');
    return { ...finalResp, totpSecret: secretCode };
  }

  return { ...verifyData, totpSecret: secretCode };
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
