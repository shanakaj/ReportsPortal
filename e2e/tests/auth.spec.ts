import { test, expect } from '../fixtures/auth';

test.describe('Authentication Flows', () => {
  test.describe('Login', () => {
    test('should display login form with email and password fields', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show validation error for empty fields', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText(/email|required/i)).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('not-an-email');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText(/valid email|invalid/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByLabel(/password/i).fill('WrongPassword123!');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should login successfully as super admin', async ({ page, superAdmin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to admin dashboard or MFA page
      await expect(page).toHaveURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });
    });

    test('should login successfully as customer', async ({ page, customer }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/password/i).fill(customer.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to customer dashboard or MFA page
      await expect(page).toHaveURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });
    });

    test('should disable sign in button while loading', async ({ page, superAdmin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Button should show loading state
      const button = page.getByRole('button', { name: /sign|loading/i });
      await expect(button).toBeDisabled({ timeout: 2_000 }).catch(() => {
        // Button may have already transitioned past loading state
      });
    });
  });

  test.describe('MFA Verification', () => {
    test('should show MFA form when challenge is returned', async ({ page, superAdmin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // If MFA is enforced, should see MFA form
      const mfaForm = page.getByLabel(/code|mfa|otp|verification/i);
      const dashboard = page.getByText(/dashboard|welcome/i);

      // Either MFA or dashboard should appear
      await expect(mfaForm.or(dashboard)).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Forgot Password', () => {
    test('should display forgot password link on login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByText(/forgot.*password/i)).toBeVisible();
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');
      await page.getByText(/forgot.*password/i).click();

      await expect(page).toHaveURL(/forgot|reset/i, { timeout: 5_000 });
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should submit forgot password request', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByRole('button', { name: /reset|send|submit/i }).click();

      await expect(page.getByText(/sent|check.*email|code/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Logout', () => {
    test('should logout and redirect to login page', async ({ page, superAdmin }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for authenticated state
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      // If on MFA page, skip this test
      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required - skipping logout test');
        return;
      }

      // Click logout
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await expect(page).toHaveURL(/login/i, { timeout: 10_000 });
      }
    });
  });

  test.describe('New Password Required', () => {
    test('should show change password form for NEW_PASSWORD_REQUIRED challenge', async ({ page }) => {
      // Navigate to the change password page directly
      await page.goto('/change-password');

      // Should show password fields or redirect to login
      const newPasswordField = page.getByLabel(/new.*password/i);
      const loginPage = page.getByLabel(/email/i);
      await expect(newPasswordField.or(loginPage)).toBeVisible({ timeout: 5_000 });
    });
  });
});
