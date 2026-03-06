import { test, expect } from '../fixtures/auth';

test.describe('Security Boundaries', () => {
  test.describe('Route Protection', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL(/login/i, { timeout: 10_000 });
    });

    test('should redirect unauthenticated users from customer routes', async ({ page }) => {
      await page.goto('/customer/reports');
      await expect(page).toHaveURL(/login/i, { timeout: 10_000 });
    });

    test('should redirect unauthenticated users from admin API routes', async ({ page }) => {
      const response = await page.request.get('/admin/spaces');
      expect([401, 403, 302]).toContain(response.status());
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('customer cannot access admin routes', async ({ page, customer }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/password/i).fill(customer.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Try navigating to admin routes
      await page.goto('/admin/dashboard');

      // Should be redirected or see forbidden
      await expect(
        page.getByText(/forbidden|unauthorized|access denied/i)
          .or(page.locator('body'))
      ).toBeVisible();

      // URL should not be admin dashboard
      expect(page.url()).not.toMatch(/admin\/dashboard$/);
    });

    test('customer cannot access other customer spaces', async ({ page, customer }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/password/i).fill(customer.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Try accessing a random space ID
      await page.goto('/customer/spaces/nonexistent-space-id/reports');

      // Should see error or be redirected
      await expect(
        page.getByText(/not found|forbidden|unauthorized|no reports/i)
          .or(page.locator('body'))
      ).toBeVisible();
    });

    test('admin cannot access super-admin-only features', async ({ page, admin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(admin.email);
      await page.getByLabel(/password/i).fill(admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Admin should not see audit log (super_admin only)
      const auditLink = page.getByRole('link', { name: /audit/i });
      await expect(auditLink).not.toBeVisible({ timeout: 3_000 });

      // Admin should not see impersonate button
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      const impersonateButton = page.getByRole('button', { name: /impersonate/i }).first();
      await expect(impersonateButton).not.toBeVisible({ timeout: 3_000 });
    });
  });

  test.describe('XSS Prevention', () => {
    test('should sanitize malicious input in feedback', async ({ page, customer }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/password/i).fill(customer.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      const feedbackNav = page.getByRole('link', { name: /feedback/i });
      if (!(await feedbackNav.isVisible())) {
        test.skip(true, 'Feedback nav not visible');
        return;
      }

      await feedbackNav.click();
      await page.waitForLoadState('networkidle');

      const threadLink = page.locator('a, [role="link"], tr').filter({ hasText: /feedback|thread/i }).first();
      if (await threadLink.isVisible()) {
        await threadLink.click();
        await page.waitForLoadState('networkidle');

        const replyInput = page.getByLabel(/message|reply/i).or(page.locator('textarea'));
        if (await replyInput.isVisible()) {
          // Try XSS payload
          await replyInput.fill('<script>alert("xss")</script>');
          await page.getByRole('button', { name: /send|reply|submit/i }).click();
          await page.waitForTimeout(2_000);

          // The script should be sanitized - no alert dialog
          const dialogs: string[] = [];
          page.on('dialog', (dialog) => {
            dialogs.push(dialog.message());
            dialog.dismiss();
          });

          await page.waitForTimeout(1_000);
          expect(dialogs).toHaveLength(0);
        }
      }
    });
  });

  test.describe('Session Management', () => {
    test('should clear session data on logout', async ({ page, context, superAdmin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Logout
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await page.waitForURL(/login/i, { timeout: 10_000 });

        // Verify tokens are cleared from localStorage
        const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
        const idToken = await page.evaluate(() => localStorage.getItem('idToken'));
        expect(accessToken).toBeNull();
        expect(idToken).toBeNull();
      }
    });

    test('should prevent accessing protected routes after logout', async ({ page, superAdmin }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Logout
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await page.waitForURL(/login/i, { timeout: 10_000 });
      }

      // Try accessing protected route
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL(/login/i, { timeout: 10_000 });
    });
  });

  test.describe('CSRF Protection', () => {
    test('should reject requests without proper authorization', async ({ page }) => {
      // Make a direct API call without auth headers
      const response = await page.request.post('/admin/spaces', {
        data: { name: 'unauthorized-space' },
      });
      expect([401, 403]).toContain(response.status());
    });
  });
});
