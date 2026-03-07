import { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';
import { generateTotpCode } from './helpers/totp';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function verifyBaseUrl(baseURL: string): Promise<void> {
  const maxRetries = 3;
  const retryDelay = 5_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(baseURL, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });
      if (response.ok || response.status === 302 || response.status === 301) {
        console.log(`[global-setup] Base URL ${baseURL} is accessible (status: ${response.status})`);
        return;
      }
      console.warn(`[global-setup] Base URL returned status ${response.status}, attempt ${attempt}/${maxRetries}`);
    } catch (error) {
      console.warn(`[global-setup] Failed to reach ${baseURL}, attempt ${attempt}/${maxRetries}: ${error}`);
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  throw new Error(`[global-setup] Base URL ${baseURL} is not accessible after ${maxRetries} attempts`);
}

async function apiRequest(
  baseURL: string,
  method: string,
  endpoint: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const apiBase = process.env.API_BASE_URL || baseURL;
  const url = `${apiBase}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return fetch(url, options);
}

async function loginUser(
  baseURL: string,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<string> {
  const apiBase = process.env.API_BASE_URL || baseURL;
  const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    accessToken?: string;
    idToken?: string;
    challengeName?: string;
    session?: string;
    secretCode?: string;
  };

  // Direct tokens - no MFA
  if (data.accessToken) {
    return data.accessToken;
  }

  // Handle MFA_SETUP challenge (first time after MFA reset)
  if (data.challengeName === 'MFA_SETUP' && data.secretCode && data.session) {
    console.log(`[global-setup] MFA_SETUP challenge for ${email}, setting up TOTP...`);
    const code = generateTotpCode(data.secretCode);
    const verifyResp = await fetch(`${apiBase}/auth/mfa-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ session: data.session, mfaCode: code, challengeName: 'MFA_SETUP' }),
    });
    if (verifyResp.ok) {
      const verifyData = (await verifyResp.json()) as {
        accessToken?: string;
        challengeName?: string;
        session?: string;
      };
      if (verifyData.accessToken) return verifyData.accessToken;
      // May need SOFTWARE_TOKEN_MFA after setup
      if (verifyData.challengeName === 'SOFTWARE_TOKEN_MFA' && verifyData.session) {
        const finalCode = generateTotpCode(data.secretCode);
        const finalResp = await fetch(`${apiBase}/auth/mfa-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
          body: JSON.stringify({
            session: verifyData.session,
            mfaCode: finalCode,
            challengeName: 'SOFTWARE_TOKEN_MFA',
          }),
        });
        if (finalResp.ok) {
          const finalData = (await finalResp.json()) as { accessToken?: string };
          return finalData.accessToken || '';
        }
      }
    }
    throw new Error(`MFA setup verification failed for ${email}`);
  }

  // Handle SOFTWARE_TOKEN_MFA challenge (normal MFA)
  if (data.challengeName === 'SOFTWARE_TOKEN_MFA' && data.session) {
    if (!totpSecret) {
      throw new Error(
        `SOFTWARE_TOKEN_MFA challenge for ${email} but no TOTP secret. ` +
          'Set SUPER_ADMIN_TOTP_SECRET or relevant env var.',
      );
    }
    console.log(`[global-setup] SOFTWARE_TOKEN_MFA challenge for ${email}, generating TOTP...`);
    const code = generateTotpCode(totpSecret);
    const mfaResp = await fetch(`${apiBase}/auth/mfa-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({
        session: data.session,
        mfaCode: code,
        challengeName: 'SOFTWARE_TOKEN_MFA',
      }),
    });
    if (!mfaResp.ok) {
      throw new Error(`MFA verification failed for ${email}: ${mfaResp.status}`);
    }
    const mfaData = (await mfaResp.json()) as { accessToken?: string };
    return mfaData.accessToken || '';
  }

  return data.idToken || '';
}

async function ensureTestAdmin(baseURL: string, superAdminToken: string): Promise<void> {
  const testAdminEmail = process.env.TEST_ADMIN_EMAIL;
  if (!testAdminEmail) {
    console.log('[global-setup] TEST_ADMIN_EMAIL not set, skipping admin setup');
    return;
  }

  try {
    const usersResponse = await apiRequest(
      baseURL,
      'GET',
      `/admin/users?role=admin&limit=100`,
      superAdminToken,
    );

    if (usersResponse.ok) {
      const usersData = (await usersResponse.json()) as { items: Array<{ email: string }> };
      const existingAdmin = usersData.items?.find(
        (u: { email: string }) => u.email === testAdminEmail,
      );
      if (existingAdmin) {
        console.log(`[global-setup] Test admin ${testAdminEmail} already exists`);
        return;
      }
    }

    console.log(`[global-setup] Inviting test admin ${testAdminEmail}`);
    const inviteResponse = await apiRequest(baseURL, 'POST', '/admin/invite-admin', superAdminToken, {
      email: testAdminEmail,
    });

    if (inviteResponse.ok || inviteResponse.status === 409) {
      console.log(`[global-setup] Test admin invitation sent or already exists`);
    } else {
      console.warn(
        `[global-setup] Failed to invite test admin: ${inviteResponse.status} ${inviteResponse.statusText}`,
      );
    }
  } catch (error) {
    console.warn(`[global-setup] Error setting up test admin: ${error}`);
  }
}

async function ensureTestCustomer(baseURL: string, superAdminToken: string): Promise<void> {
  const testCustomerEmail = process.env.TEST_CUSTOMER_EMAIL;
  if (!testCustomerEmail) {
    console.log('[global-setup] TEST_CUSTOMER_EMAIL not set, skipping customer setup');
    return;
  }

  try {
    // Ensure at least one space exists for the test customer
    const spacesResponse = await apiRequest(baseURL, 'GET', '/admin/spaces?limit=10', superAdminToken);
    let spaceId: string | undefined;

    if (spacesResponse.ok) {
      const spacesData = (await spacesResponse.json()) as {
        items: Array<{ spaceId: string; spaceName: string }>;
      };
      const testSpace = spacesData.items?.find(
        (s: { spaceName: string }) => s.spaceName === 'e2e-test-space',
      );
      if (testSpace) {
        spaceId = testSpace.spaceId;
        console.log(`[global-setup] Test space already exists: ${spaceId}`);
      }
    }

    if (!spaceId) {
      console.log('[global-setup] Creating test space: e2e-test-space');
      const createResponse = await apiRequest(baseURL, 'POST', '/admin/spaces', superAdminToken, {
        name: 'e2e-test-space',
      });
      if (createResponse.ok) {
        const createData = (await createResponse.json()) as { spaceId: string };
        spaceId = createData.spaceId;
        console.log(`[global-setup] Test space created: ${spaceId}`);
      } else if (createResponse.status === 409) {
        console.log('[global-setup] Test space already exists (409)');
      } else {
        console.warn(
          `[global-setup] Failed to create test space: ${createResponse.status} ${createResponse.statusText}`,
        );
        return;
      }
    }

    if (spaceId) {
      // Check if customer already exists
      const usersResponse = await apiRequest(
        baseURL,
        'GET',
        `/admin/users?role=customer&spaceId=${spaceId}&limit=100`,
        superAdminToken,
      );

      if (usersResponse.ok) {
        const usersData = (await usersResponse.json()) as { items: Array<{ email: string }> };
        const existingCustomer = usersData.items?.find(
          (u: { email: string }) => u.email === testCustomerEmail,
        );
        if (existingCustomer) {
          console.log(`[global-setup] Test customer ${testCustomerEmail} already exists`);
          return;
        }
      }

      console.log(`[global-setup] Inviting test customer ${testCustomerEmail} to space ${spaceId}`);
      const inviteResponse = await apiRequest(
        baseURL,
        'POST',
        `/admin/spaces/${spaceId}/invite`,
        superAdminToken,
        { email: testCustomerEmail },
      );

      if (inviteResponse.ok || inviteResponse.status === 409) {
        console.log('[global-setup] Test customer invitation sent or already exists');
      } else {
        console.warn(
          `[global-setup] Failed to invite test customer: ${inviteResponse.status} ${inviteResponse.statusText}`,
        );
      }
    }
  } catch (error) {
    console.warn(`[global-setup] Error setting up test customer: ${error}`);
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL || process.env.BASE_URL || 'http://localhost:5173';

  console.log('[global-setup] Starting global setup...');
  console.log(`[global-setup] Base URL: ${baseURL}`);

  // Step 1: Verify the base URL is accessible
  await verifyBaseUrl(baseURL);

  // Step 2: Login as super admin and create test users if needed
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (superAdminEmail && superAdminPassword) {
    try {
      const totpSecret = process.env.SUPER_ADMIN_TOTP_SECRET;
      console.log(`[global-setup] Logging in as super admin: ${superAdminEmail}`);
      const token = await loginUser(baseURL, superAdminEmail, superAdminPassword, totpSecret);

      if (token) {
        await ensureTestAdmin(baseURL, token);
        await ensureTestCustomer(baseURL, token);
      } else {
        console.warn('[global-setup] Super admin login returned no token; skipping user provisioning');
      }
    } catch (error) {
      console.warn(`[global-setup] Could not provision test users (non-fatal): ${error}`);
    }
  } else {
    console.log('[global-setup] Super admin credentials not set, skipping user provisioning');
  }

  console.log('[global-setup] Global setup complete');
}

export default globalSetup;
