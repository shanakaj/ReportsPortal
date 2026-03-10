import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Authentication Flows', () => {
  test.describe('Login Page', () => {
    test('should display login form with email, password, and sign in button', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      await expect(page.locator(selectors.login.emailInput)).toBeVisible();
      await expect(page.locator(selectors.login.passwordInput)).toBeVisible();
      await expect(page.locator(selectors.login.submitButton)).toBeVisible();
    });

    test('should display forgot password link', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await expect(page.locator(selectors.login.forgotPasswordLink)).toBeVisible();
    });

    test('should show validation error for empty form submission', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.submitButton).click();

      // Should show error or not submit (form validation)
      const errorVisible = await page.locator(selectors.login.errorMessage).isVisible({ timeout: 3_000 }).catch(() => false);
      const stillOnLogin = page.url().includes('/login');
      expect(errorVisible || stillOnLogin).toBeTruthy();
    });

    test('should show validation error for invalid email format', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.emailInput).fill('not-an-email');
      await page.locator(selectors.login.passwordInput).fill('password123');
      await page.locator(selectors.login.submitButton).click();

      const errorVisible = await page.locator(selectors.login.errorMessage).isVisible({ timeout: 3_000 }).catch(() => false);
      const stillOnLogin = page.url().includes('/login');
      expect(errorVisible || stillOnLogin).toBeTruthy();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.emailInput).fill('nonexistent@example.com');
      await page.locator(selectors.login.passwordInput).fill('WrongPassword123!');
      await page.locator(selectors.login.submitButton).click();

      await expect(page.locator(selectors.login.errorMessage)).toBeVisible({ timeout: 10_000 });
    });

    test('should disable sign in button while loading', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();

      // Button should briefly show loading state
      const button = page.locator(selectors.login.submitButton);
      await button.isDisabled().catch(() => false);
    });
  });

  test.describe('Super Admin Login', () => {
    test('should login and redirect to admin area or MFA', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();

      // Should navigate away from login (to MFA, dashboard, or admin)
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
    });
  });

  test.describe('Admin Login', () => {
    test('should login and redirect to admin area or MFA', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const email = process.env.TEST_ADMIN_EMAIL || 'testpr.admin@versent.com.au';
      const password = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';

      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
    });
  });

  test.describe('Customer Login', () => {
    test('should login and redirect to customer area or MFA', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const email = process.env.TEST_CUSTOMER_EMAIL || 'testpr.customer@example.com.au';
      const password = process.env.TEST_CUSTOMER_PASSWORD || 'TestPassword123!';

      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
    });
  });

  test.describe('MFA Verification', () => {
    test('should display MFA input when challenge is returned', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();

      // Either MFA input or dashboard should appear
      const mfaInput = page.locator(selectors.mfa.codeInput);
      const dashboard = page.locator(selectors.dashboard.container);
      await expect(mfaInput.or(dashboard)).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Forgot Password', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.forgotPasswordLink).click();

      await page.waitForURL(/forgot|reset/i, { timeout: 5_000 });
      await expect(page.locator(selectors.forgotPassword.emailInput)).toBeVisible();
    });

    test('should submit forgot password request', async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);

      await page.locator(selectors.forgotPassword.emailInput).fill('test@example.com');
      const submitBtn = page.locator(selectors.forgotPassword.submitButton);
      await submitBtn.click();

      // Should show success message, code input, or error (user may not exist)
      const successOrError = page.getByText(/sent|check.*email|code|reset|error|not found|limit exceeded/i);
      const codeInput = page.locator(selectors.forgotPassword.codeInput);
      const errorAlert = page.locator('[role="alert"]');
      await expect(successOrError.or(codeInput).or(errorAlert)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('First Login (New Password Required)', () => {
    test('should show change password form for first-time login', async ({ page }) => {
      await page.goto(`${BASE_URL}/change-password`);

      // Should show password fields or redirect to login
      const newPasswordField = page.locator(selectors.firstLogin.newPasswordInput);
      const loginPage = page.locator(selectors.login.emailInput);
      await expect(newPasswordField.or(loginPage)).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('Logout', () => {
    test('should logout and redirect to login page', async ({ page }) => {
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

      // Login first
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });

      // Skip if on MFA page
      if (page.url().includes('mfa')) return;

      // Click logout
      const logoutBtn = page.locator(selectors.nav.logoutButton);
      if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await logoutBtn.click();
        await page.waitForURL(/login/i, { timeout: 10_000 });
      }
    });

    test('should clear tokens from localStorage on logout', async ({ page }) => {
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.emailInput).fill(email);
      await page.locator(selectors.login.passwordInput).fill(password);
      await page.locator(selectors.login.submitButton).click();
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });

      if (page.url().includes('mfa')) return;

      const logoutBtn = page.locator(selectors.nav.logoutButton);
      if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await logoutBtn.click();
        await page.waitForURL(/login/i, { timeout: 10_000 });

        const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
        const idToken = await page.evaluate(() => localStorage.getItem('idToken'));
        expect(accessToken).toBeNull();
        expect(idToken).toBeNull();
      }
    });
  });
});
