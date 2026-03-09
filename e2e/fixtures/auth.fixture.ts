import { test as base, expect, Page, BrowserContext, APIRequestContext } from '@playwright/test';
import * as api from '../helpers/api';
import fs from 'fs';
import path from 'path';

/**
 * Extended test fixtures providing pre-authenticated pages for each role.
 *
 * Each fixture logs in via the API (not UI) for speed, stores the tokens,
 * and injects them into the page context via localStorage/cookies before navigation.
 *
 * MFA is handled programmatically using TOTP secrets from env vars or .auth-state.json.
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
const STATE_FILE = path.resolve(__dirname, '..', '.auth-state.json');

interface AuthState {
  superAdminTotpSecret?: string;
  testAdminTotpSecret?: string;
  testCustomerTotpSecret?: string;
  testSpaceId?: string;
  testReportId?: string;
}

function loadAuthState(): AuthState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function loginAndGetToken(
  request: APIRequestContext,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<string> {
  try {
    const response = await api.loginWithMfa(request, email, password, totpSecret);
    // Use idToken for API Gateway Cognito Authorizer (not accessToken)
    return response.idToken || response.accessToken || '';
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
    const state = loadAuthState();
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';
    const totpSecret = process.env.SUPER_ADMIN_TOTP_SECRET || state.superAdminTotpSecret;
    const token = await loginAndGetToken(request, email, password, totpSecret);
    await use(token);
  },

  adminToken: async ({ request }, use) => {
    const state = loadAuthState();
    const email = process.env.TEST_ADMIN_EMAIL || 'test.admin@versent.com.au';
    const password = process.env.TEST_ADMIN_PASSWORD || 'TestAdmin@2026!';
    const totpSecret = process.env.TEST_ADMIN_TOTP_SECRET || state.testAdminTotpSecret;
    const token = await loginAndGetToken(request, email, password, totpSecret);
    await use(token);
  },

  customerToken: async ({ request }, use) => {
    const state = loadAuthState();
    const email = process.env.TEST_CUSTOMER_EMAIL || 'test.customer@example.com.au';
    const password = process.env.TEST_CUSTOMER_PASSWORD || 'TestCustomer@2026!';
    const totpSecret = process.env.TEST_CUSTOMER_TOTP_SECRET || state.testCustomerTotpSecret;
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
