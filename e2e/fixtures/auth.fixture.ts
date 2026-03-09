import { test as base, expect, Page, BrowserContext, APIRequestContext, TestInfo } from '@playwright/test';
import * as api from '../helpers/api';
import fs from 'fs';
import path from 'path';
import { jwtDecode } from '../helpers/jwt';

/**
 * Extended test fixtures providing pre-authenticated pages for each role.
 *
 * Each fixture logs in via the backend auth API, then injects the resulting
 * tokens into the browser's localStorage in the format that the Cognito SDK
 * expects. This lets the React app's `refreshSession()` find a valid session
 * on page load without going through the UI login flow.
 */
export interface AuthFixtures {
  superAdminToken: string;
  adminToken: string;
  customerToken: string;

  superAdminPage: Page;
  adminPage: Page;
  customerPage: Page;

  superAdminContext: BrowserContext;
  adminContext: BrowserContext;
  customerContext: BrowserContext;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '78i7nfth9pqa7fpvnp90oe2l6p';
const STATE_FILE = path.resolve(__dirname, '..', '.auth-state.json');

interface AuthState {
  superAdminTotpSecret?: string;
  testAdminTotpSecret?: string;
  testCustomerTotpSecret?: string;
  testSpaceId?: string;
  testReportId?: string;
}

interface TokenSet {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  sub: string; // Cognito username (UUID)
}

function loadAuthState(): AuthState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function loginAndGetTokens(
  request: APIRequestContext,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<TokenSet | null> {
  try {
    const response = await api.loginWithMfa(request, email, password, totpSecret);
    if (!response.idToken) return null;

    // Decode sub (Cognito username UUID) from the idToken
    const decoded = jwtDecode(response.idToken);
    const sub = decoded?.sub || decoded?.['cognito:username'] || '';

    return {
      idToken: response.idToken,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      sub,
    };
  } catch (err) {
    console.warn(`[auth.fixture] Login failed for ${email}: ${err}`);
    return null;
  }
}

/**
 * Inject tokens into localStorage in the format the Cognito Identity JS SDK expects.
 * This allows the React app to find a valid session via userPool.getCurrentUser().
 */
async function injectCognitoSession(page: Page, tokens: TokenSet): Promise<void> {
  await page.goto(BASE_URL);
  await page.evaluate(
    ({ clientId, sub, idToken, accessToken, refreshToken }) => {
      const prefix = `CognitoIdentityServiceProvider.${clientId}`;
      localStorage.setItem(`${prefix}.LastAuthUser`, sub);
      localStorage.setItem(`${prefix}.${sub}.idToken`, idToken);
      localStorage.setItem(`${prefix}.${sub}.accessToken`, accessToken);
      localStorage.setItem(`${prefix}.${sub}.refreshToken`, refreshToken);
      // clockDrift is required by the SDK for token expiry validation
      localStorage.setItem(`${prefix}.${sub}.clockDrift`, '0');
    },
    { clientId: COGNITO_CLIENT_ID, ...tokens },
  );
  // Reload so the app picks up the injected session
  await page.reload();
  await page.waitForLoadState('networkidle');
}

function videoContextOptions(testInfo: TestInfo): Record<string, unknown> {
  const videoSetting = testInfo.project.use?.video;
  if (videoSetting && videoSetting !== 'off') {
    return {
      recordVideo: {
        dir: testInfo.project.outputDir || 'videos',
        size: { width: 1280, height: 720 },
      },
    };
  }
  return {};
}

export const test = base.extend<AuthFixtures>({
  superAdminToken: async ({ request }, use) => {
    const state = loadAuthState();
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';
    const totpSecret = process.env.SUPER_ADMIN_TOTP_SECRET || state.superAdminTotpSecret;
    const tokens = await loginAndGetTokens(request, email, password, totpSecret);
    await use(tokens?.idToken || '');
  },

  adminToken: async ({ request }, use) => {
    const state = loadAuthState();
    const email = process.env.TEST_ADMIN_EMAIL || 'test.admin@versent.com.au';
    const password = process.env.TEST_ADMIN_PASSWORD || 'TestAdmin@2026!';
    const totpSecret = process.env.TEST_ADMIN_TOTP_SECRET || state.testAdminTotpSecret;
    const tokens = await loginAndGetTokens(request, email, password, totpSecret);
    await use(tokens?.idToken || '');
  },

  customerToken: async ({ request }, use) => {
    const state = loadAuthState();
    const email = process.env.TEST_CUSTOMER_EMAIL || 'test.customer@example.com.au';
    const password = process.env.TEST_CUSTOMER_PASSWORD || 'TestCustomer@2026!';
    const totpSecret = process.env.TEST_CUSTOMER_TOTP_SECRET || state.testCustomerTotpSecret;
    const tokens = await loginAndGetTokens(request, email, password, totpSecret);
    await use(tokens?.idToken || '');
  },

  superAdminContext: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext(videoContextOptions(testInfo));
    await use(context);
    await context.close();
  },

  adminContext: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext(videoContextOptions(testInfo));
    await use(context);
    await context.close();
  },

  customerContext: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext(videoContextOptions(testInfo));
    await use(context);
    await context.close();
  },

  superAdminPage: async ({ superAdminContext, request }, use) => {
    const state = loadAuthState();
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';
    const totpSecret = process.env.SUPER_ADMIN_TOTP_SECRET || state.superAdminTotpSecret;
    const tokens = await loginAndGetTokens(request, email, password, totpSecret);

    const page = await superAdminContext.newPage();
    if (tokens) {
      await injectCognitoSession(page, tokens);
    }
    await use(page);
  },

  adminPage: async ({ adminContext, request }, use) => {
    const state = loadAuthState();
    const email = process.env.TEST_ADMIN_EMAIL || 'test.admin@versent.com.au';
    const password = process.env.TEST_ADMIN_PASSWORD || 'TestAdmin@2026!';
    const totpSecret = process.env.TEST_ADMIN_TOTP_SECRET || state.testAdminTotpSecret;
    const tokens = await loginAndGetTokens(request, email, password, totpSecret);

    const page = await adminContext.newPage();
    if (tokens) {
      await injectCognitoSession(page, tokens);
    }
    await use(page);
  },

  customerPage: async ({ customerContext, request }, use) => {
    const state = loadAuthState();
    const email = process.env.TEST_CUSTOMER_EMAIL || 'test.customer@example.com.au';
    const password = process.env.TEST_CUSTOMER_PASSWORD || 'TestCustomer@2026!';
    const totpSecret = process.env.TEST_CUSTOMER_TOTP_SECRET || state.testCustomerTotpSecret;
    const tokens = await loginAndGetTokens(request, email, password, totpSecret);

    const page = await customerContext.newPage();
    if (tokens) {
      await injectCognitoSession(page, tokens);
    }
    await use(page);
  },
});

export { expect };
