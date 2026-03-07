import { test as base, expect, Page, BrowserContext, APIRequestContext } from '@playwright/test';
import * as api from '../helpers/api';

/**
 * Extended test fixtures providing pre-authenticated pages for each role.
 *
 * Each fixture logs in via the API (not UI) for speed, stores the tokens,
 * and injects them into the page context via localStorage/cookies before navigation.
 *
 * MFA is handled programmatically using TOTP secrets from env vars.
 */
export interface AuthFixtures {
  // Tokens
  superAdminToken: string;
  adminToken: string;
  customerToken: string;

  // Pre-authenticated pages
  superAdminPage: Page;
  adminPage: Page;
  customerPage: Page;

  // Browser contexts (for cookie inspection etc.)
  superAdminContext: BrowserContext;
  adminContext: BrowserContext;
  customerContext: BrowserContext;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function loginAndGetToken(
  request: APIRequestContext,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<string> {
  try {
    const response = await api.loginWithMfa(request, email, password, totpSecret);
    return response.accessToken || response.idToken || '';
  } catch (err) {
    console.warn(`[auth.fixture] Login failed for ${email}: ${err}`);
    return '';
  }
}

async function injectAuthTokens(page: Page, token: string, idToken?: string): Promise<void> {
  await page.goto(BASE_URL);
  await page.evaluate(
    ({ accessToken, idTok }) => {
      localStorage.setItem('accessToken', accessToken);
      if (idTok) localStorage.setItem('idToken', idTok);
    },
    { accessToken: token, idTok: idToken || token },
  );
}

export const test = base.extend<AuthFixtures>({
  superAdminToken: async ({ request }, use) => {
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';
    const totpSecret = process.env.SUPER_ADMIN_TOTP_SECRET;
    const token = await loginAndGetToken(request, email, password, totpSecret);
    await use(token);
  },

  adminToken: async ({ request }, use) => {
    const email = process.env.TEST_ADMIN_EMAIL || 'admin@versent.com.au';
    const password = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';
    const totpSecret = process.env.TEST_ADMIN_TOTP_SECRET;
    const token = await loginAndGetToken(request, email, password, totpSecret);
    await use(token);
  },

  customerToken: async ({ request }, use) => {
    const email = process.env.TEST_CUSTOMER_EMAIL || 'customer@example.com';
    const password = process.env.TEST_CUSTOMER_PASSWORD || 'TestPassword123!';
    const totpSecret = process.env.TEST_CUSTOMER_TOTP_SECRET;
    const token = await loginAndGetToken(request, email, password, totpSecret);
    await use(token);
  },

  superAdminContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  customerContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  superAdminPage: async ({ superAdminContext, superAdminToken }, use) => {
    const page = await superAdminContext.newPage();
    if (superAdminToken) {
      await injectAuthTokens(page, superAdminToken);
    }
    await use(page);
  },

  adminPage: async ({ adminContext, adminToken }, use) => {
    const page = await adminContext.newPage();
    if (adminToken) {
      await injectAuthTokens(page, adminToken);
    }
    await use(page);
  },

  customerPage: async ({ customerContext, customerToken }, use) => {
    const page = await customerContext.newPage();
    if (customerToken) {
      await injectAuthTokens(page, customerToken);
    }
    await use(page);
  },
});

export { expect };
