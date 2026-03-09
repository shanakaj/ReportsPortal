import { FullConfig, request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as api from './helpers/api';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const STATE_FILE = path.resolve(__dirname, '.auth-state.json');

interface AuthState {
  superAdminTotpSecret?: string;
  testAdminTotpSecret?: string;
  testCustomerTotpSecret?: string;
  testSpaceId?: string;
  testReportId?: string;
}

function loadState(): AuthState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveState(state: AuthState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Login a user via Playwright request context (passes WAF bot detection).
 * Handles MFA_SETUP and SOFTWARE_TOKEN_MFA challenges.
 */
async function loginUser(
  ctx: APIRequestContext,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<{ token: string; totpSecret?: string }> {
  try {
    const result = await api.loginWithMfa(ctx, email, password, totpSecret);
    // Use idToken for API Gateway Cognito Authorizer (not accessToken)
    const token = result.idToken || result.accessToken || '';
    return { token, totpSecret: result.totpSecret || totpSecret };
  } catch (error) {
    throw new Error(`Login failed for ${email}: ${error}`);
  }
}

async function ensureTestSpace(
  ctx: APIRequestContext,
  superAdminToken: string,
): Promise<string | undefined> {
  try {
    const spacesData = await api.listSpaces(ctx, superAdminToken);
    const testSpace = spacesData.items?.find(
      (s) => s.spaceName === 'e2e-test-space',
    );
    if (testSpace) {
      console.log(`[global-setup] Test space already exists: ${testSpace.spaceId}`);
      return testSpace.spaceId;
    }

    console.log('[global-setup] Creating test space: e2e-test-space');
    const created = await api.createSpace(ctx, superAdminToken, 'e2e-test-space');
    console.log(`[global-setup] Test space created: ${created.spaceId}`);
    return created.spaceId;
  } catch (error) {
    console.warn(`[global-setup] Error with test space: ${error}`);
  }
  return undefined;
}

async function ensureTestReports(
  ctx: APIRequestContext,
  superAdminToken: string,
  spaceId: string,
): Promise<string | undefined> {
  try {
    const reportsData = await api.listReports(ctx, superAdminToken, spaceId);
    if (reportsData.items?.length > 0) {
      console.log(`[global-setup] Reports already exist (${reportsData.items.length} reports)`);
      return reportsData.items[0].reportId;
    }

    // Upload HTML report
    console.log('[global-setup] Uploading: architecture-review.html');
    const htmlFile = path.resolve(__dirname, 'fixtures', 'reports', 'architecture-review.html');
    const htmlContent = fs.readFileSync(htmlFile);
    const htmlReport = await api.uploadReport(ctx, superAdminToken, spaceId, 'architecture-review.html', htmlContent);
    console.log(`[global-setup] HTML report uploaded: ${htmlReport.reportId}`);

    // Upload PDF report
    const pdfFile = path.resolve(__dirname, 'fixtures', 'reports', 'security-assessment.pdf');
    if (fs.existsSync(pdfFile)) {
      console.log('[global-setup] Uploading: security-assessment.pdf');
      const pdfContent = fs.readFileSync(pdfFile);
      const pdfReport = await api.uploadReport(ctx, superAdminToken, spaceId, 'security-assessment.pdf', pdfContent);
      console.log(`[global-setup] PDF report uploaded: ${pdfReport.reportId}`);
    }

    return htmlReport.reportId;
  } catch (error) {
    console.warn(`[global-setup] Error uploading reports: ${error}`);
  }
  return undefined;
}

async function ensureCustomerInSpace(
  ctx: APIRequestContext,
  superAdminToken: string,
  spaceId: string,
  customerEmail: string,
): Promise<void> {
  try {
    const usersData = await api.listUsers(ctx, superAdminToken, {
      role: 'customer',
      spaceId,
      limit: 100,
    });
    if (usersData.items?.find((u) => u.email === customerEmail)) {
      console.log(`[global-setup] Customer ${customerEmail} already in space`);
      return;
    }
  } catch {
    // Continue to invite
  }

  try {
    console.log(`[global-setup] Inviting customer ${customerEmail} to space ${spaceId}`);
    await api.inviteUser(ctx, superAdminToken, spaceId, customerEmail);
    console.log('[global-setup] Customer invitation sent');
  } catch (error) {
    console.warn(`[global-setup] Customer invite: ${error}`);
  }
}

async function ensureAdminInPlatform(
  ctx: APIRequestContext,
  superAdminToken: string,
  adminEmail: string,
): Promise<void> {
  try {
    const usersData = await api.listUsers(ctx, superAdminToken, {
      role: 'admin',
      limit: 100,
    });
    if (usersData.items?.find((u) => u.email === adminEmail)) {
      console.log(`[global-setup] Admin ${adminEmail} already exists`);
      return;
    }
  } catch {
    // Continue to invite
  }

  try {
    console.log(`[global-setup] Inviting admin ${adminEmail}`);
    await api.inviteAdmin(ctx, superAdminToken, adminEmail);
    console.log('[global-setup] Admin invitation sent');
  } catch (error) {
    console.warn(`[global-setup] Admin invite: ${error}`);
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL || process.env.BASE_URL || 'http://localhost:5173';

  console.log('[global-setup] Starting...');
  console.log(`[global-setup] Base URL: ${baseURL}`);

  // Create Playwright API request context (behaves like a browser, passes WAF)
  const ctx = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const state = loadState();

  try {
    // Step 1: Login as super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!superAdminEmail || !superAdminPassword) {
      console.log('[global-setup] Super admin credentials not set, skipping');
      return;
    }

    let superAdminToken: string;
    try {
      console.log(`[global-setup] Logging in as super admin: ${superAdminEmail}`);
      const existingSecret = process.env.SUPER_ADMIN_TOTP_SECRET || state.superAdminTotpSecret;
      const result = await loginUser(ctx, superAdminEmail, superAdminPassword, existingSecret);
      superAdminToken = result.token;

      if (result.totpSecret && result.totpSecret !== existingSecret) {
        state.superAdminTotpSecret = result.totpSecret;
        console.log('[global-setup] Super admin TOTP secret saved');
      }
    } catch (error) {
      console.warn(`[global-setup] Super admin login failed: ${error}`);
      return;
    }

    if (!superAdminToken) {
      console.warn('[global-setup] No super admin token, skipping provisioning');
      return;
    }

    // Step 2: Ensure test space + reports
    const spaceId = await ensureTestSpace(ctx, superAdminToken);
    if (spaceId) {
      state.testSpaceId = spaceId;
      const reportId = await ensureTestReports(ctx, superAdminToken, spaceId);
      if (reportId) {
        state.testReportId = reportId;
      }
    }

    // Step 3: Ensure test admin
    const testAdminEmail = process.env.TEST_ADMIN_EMAIL;
    const testAdminPassword = process.env.TEST_ADMIN_PASSWORD;
    if (testAdminEmail) {
      await ensureAdminInPlatform(ctx, superAdminToken, testAdminEmail);

      if (testAdminPassword) {
        try {
          console.log(`[global-setup] Logging in as test admin: ${testAdminEmail}`);
          const existingSecret = process.env.TEST_ADMIN_TOTP_SECRET || state.testAdminTotpSecret;
          const result = await loginUser(ctx, testAdminEmail, testAdminPassword, existingSecret);
          if (result.totpSecret && result.totpSecret !== existingSecret) {
            state.testAdminTotpSecret = result.totpSecret;
            console.log('[global-setup] Test admin TOTP secret saved');
          }
          console.log('[global-setup] Test admin login successful');
        } catch (error) {
          console.warn(`[global-setup] Test admin login failed: ${error}`);
        }
      }
    }

    // Step 4: Ensure test customer in space
    const testCustomerEmail = process.env.TEST_CUSTOMER_EMAIL;
    const testCustomerPassword = process.env.TEST_CUSTOMER_PASSWORD;
    if (testCustomerEmail && spaceId) {
      await ensureCustomerInSpace(ctx, superAdminToken, spaceId, testCustomerEmail);

      if (testCustomerPassword) {
        try {
          console.log(`[global-setup] Logging in as test customer: ${testCustomerEmail}`);
          const existingSecret = process.env.TEST_CUSTOMER_TOTP_SECRET || state.testCustomerTotpSecret;
          const result = await loginUser(ctx, testCustomerEmail, testCustomerPassword, existingSecret);
          if (result.totpSecret && result.totpSecret !== existingSecret) {
            state.testCustomerTotpSecret = result.totpSecret;
            console.log('[global-setup] Test customer TOTP secret saved');
          }
          console.log('[global-setup] Test customer login successful');
        } catch (error) {
          console.warn(`[global-setup] Test customer login failed: ${error}`);
        }
      }
    }
  } finally {
    saveState(state);
    await ctx.dispose();
  }

  console.log('[global-setup] Complete');
}

export default globalSetup;
