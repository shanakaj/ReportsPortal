import { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function verifyBaseUrl(baseURL: string): Promise<void> {
  const maxRetries = 3;
  const retryDelay = 5_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(baseURL, { method: 'HEAD' });
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
  };
  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return fetch(url, options);
}

async function loginUser(baseURL: string, email: string, password: string): Promise<string> {
  const apiBase = process.env.API_BASE_URL || baseURL;
  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { accessToken?: string; idToken?: string };
  return data.accessToken || data.idToken || '';
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
      console.log(`[global-setup] Logging in as super admin: ${superAdminEmail}`);
      const token = await loginUser(baseURL, superAdminEmail, superAdminPassword);

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
