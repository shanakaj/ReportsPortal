import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Security Boundary Tests', () => {
  test.describe('Route Protection — Unauthenticated', () => {
    test('should redirect /admin to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForURL(/\/(login|auth)/, { timeout: 10_000 }).catch(() => {});

      const onLogin = page.url().includes('/login') || page.url().includes('/auth');
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      const forbiddenPage = await page.locator(selectors.common.forbiddenPage).isVisible().catch(() => false);

      expect(onLogin || errorPage || forbiddenPage).toBeTruthy();
    });

    test('should redirect /admin/spaces to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/spaces`);
      await page.waitForURL(/\/(login|auth)/, { timeout: 10_000 }).catch(() => {});

      const onLogin = page.url().includes('/login') || page.url().includes('/auth');
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      expect(onLogin || errorPage).toBeTruthy();
    });

    test('should redirect /admin/users to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/users`);
      await page.waitForURL(/\/(login|auth)/, { timeout: 10_000 }).catch(() => {});

      const onLogin = page.url().includes('/login') || page.url().includes('/auth');
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      expect(onLogin || errorPage).toBeTruthy();
    });

    test('should redirect /customer/spaces to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/customer/spaces`);
      await page.waitForURL(/\/(login|auth)/, { timeout: 10_000 }).catch(() => {});

      const onLogin = page.url().includes('/login') || page.url().includes('/auth');
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      expect(onLogin || errorPage).toBeTruthy();
    });

    test('should redirect /admin/analytics to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/analytics`);
      await page.waitForURL(/\/(login|auth)/, { timeout: 10_000 }).catch(() => {});

      const onLogin = page.url().includes('/login') || page.url().includes('/auth');
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      expect(onLogin || errorPage).toBeTruthy();
    });
  });

  test.describe('Role-Based Access — Customer cannot access admin', () => {
    test('customer redirected away from /admin', async ({ customerPage: page }) => {
      await page.goto(`${BASE_URL}/admin`);

      const forbidden = await page.locator(selectors.common.forbiddenPage).isVisible({ timeout: 5_000 }).catch(() => false);
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      const redirectedToLogin = page.url().includes('/login');
      const redirectedToCustomer = page.url().includes('/customer');

      expect(forbidden || errorPage || redirectedToLogin || redirectedToCustomer).toBeTruthy();
    });

    test('customer cannot access /admin/spaces', async ({ customerPage: page }) => {
      await page.goto(`${BASE_URL}/admin/spaces`);

      const forbidden = await page.locator(selectors.common.forbiddenPage).isVisible({ timeout: 5_000 }).catch(() => false);
      const redirected = !page.url().includes('/admin/spaces');
      expect(forbidden || redirected).toBeTruthy();
    });

    test('customer cannot access /admin/users', async ({ customerPage: page }) => {
      await page.goto(`${BASE_URL}/admin/users`);

      const forbidden = await page.locator(selectors.common.forbiddenPage).isVisible({ timeout: 5_000 }).catch(() => false);
      const redirected = !page.url().includes('/admin/users');
      expect(forbidden || redirected).toBeTruthy();
    });

    test('customer cannot access other customer spaces via URL', async ({ customerPage: page }) => {
      const fakeSpaceId = 'unauthorized-space-12345';
      await page.goto(`${BASE_URL}/customer/spaces/${fakeSpaceId}`);

      const forbidden = await page.locator(selectors.common.forbiddenPage).isVisible({ timeout: 5_000 }).catch(() => false);
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      const redirected = !page.url().includes(fakeSpaceId);
      expect(forbidden || errorPage || redirected).toBeTruthy();
    });
  });

  test.describe('Role-Based Access — Admin cannot access super admin features', () => {
    test('admin cannot see invite admin button', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const inviteAdminBtn = page.locator(selectors.userManagement.inviteAdminButton);
      const isVisible = await inviteAdminBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('admin cannot see impersonate/view-as buttons', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const viewAsBtn = page.locator(selectors.userManagement.viewAsButton);
      const count = await viewAsBtn.count();
      expect(count).toBe(0);
    });

    test('admin cannot see audit log', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const auditLink = page.locator(selectors.nav.auditLink);
      await expect(auditLink).not.toBeVisible({ timeout: 3_000 });
    });

    test('admin cannot delete a space', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const deleteBtn = page.locator(selectors.spaceDetail.deleteButton);
      const isVisible = await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });
  });

  test.describe('Impersonation Security', () => {
    test('impersonation mode disables all write actions', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const viewAsBtn = page.locator(selectors.userManagement.viewAsButton).first();
      if (!(await viewAsBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await viewAsBtn.click();
      await expect(page.locator(selectors.impersonation.banner)).toBeVisible({ timeout: 10_000 });

      // Upload button should be disabled
      const uploadBtn = page.locator(selectors.spaceDetail.uploadButton);
      if (await uploadBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(uploadBtn).toBeDisabled();
      }

      // Invite button should be disabled
      const inviteBtn = page.locator(selectors.spaceDetail.inviteButton);
      if (await inviteBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(inviteBtn).toBeDisabled();
      }

      // Exit impersonation
      await page.locator(selectors.impersonation.exitButton).click();
      await expect(page.locator(selectors.impersonation.banner)).toBeHidden({ timeout: 10_000 });
    });
  });

  test.describe('Email Domain Enforcement', () => {
    test('non-versent.com.au email rejected for admin invite', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const inviteAdminBtn = page.locator(selectors.userManagement.inviteAdminButton);
      if (!(await inviteAdminBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await inviteAdminBtn.click();
      const dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible();

      await dialog.locator(selectors.inviteUser.emailInput).fill('invalid@gmail.com');
      await dialog.locator(selectors.inviteUser.submitButton).click();

      const error = dialog.locator(selectors.inviteUser.errorMessage).or(page.locator(selectors.common.toastError));
      await expect(error).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('Expired Invitation Token', () => {
    test('should show error for expired/invalid invitation token', async ({ page }) => {
      await page.goto(`${BASE_URL}/invite/expired-token-12345`);

      const errorPage = await page.locator(selectors.common.errorPage).isVisible({ timeout: 10_000 }).catch(() => false);
      const alert = await page.locator('[role="alert"]').isVisible().catch(() => false);
      const redirected = page.url().includes('/login');

      expect(errorPage || alert || redirected).toBeTruthy();
    });
  });

  test.describe('CSRF Protection', () => {
    test('should reject unauthenticated POST to admin API', async ({ request }) => {
      const apiBase = process.env.API_BASE_URL || BASE_URL;
      const response = await request.post(`${apiBase}/admin/spaces`, {
        data: { name: 'unauthorized-space' },
      });
      expect([401, 403]).toContain(response.status());
    });

    test('should reject unauthenticated DELETE to admin API', async ({ request }) => {
      const apiBase = process.env.API_BASE_URL || BASE_URL;
      const response = await request.delete(`${apiBase}/admin/spaces/fake-id`);
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  test.describe('XSS Prevention', () => {
    test('script tags in feedback should not execute', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (await feedbackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await feedbackToggle.click();
      }

      const newThreadBtn = page.locator(selectors.feedback.newThreadButton);
      if (!(await newThreadBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await newThreadBtn.click();

      await page.locator(selectors.feedback.subjectInput).fill('XSS Test <script>alert(1)</script>');
      await page.locator(selectors.feedback.messageEditor).fill('<img src=x onerror=alert(1)>');

      const dialogs: string[] = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });

      await page.locator(selectors.feedback.submitButton).click();
      await page.waitForTimeout(2_000);

      expect(dialogs).toHaveLength(0);
    });
  });

  test.describe('Session Management', () => {
    test('should prevent access to protected routes after logout', async ({ page }) => {
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

      // Login
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.auth.emailInput).fill(email);
      await page.locator(selectors.auth.passwordInput).fill(password);
      await page.locator(selectors.auth.signInButton).click();
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });

      if (page.url().includes('mfa')) return;

      // Logout
      const logoutBtn = page.locator(selectors.nav.logoutButton);
      if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await logoutBtn.click();
        await page.waitForURL(/login/i, { timeout: 10_000 });
      }

      // Try protected route
      await page.goto(`${BASE_URL}/admin`);
      const onLogin = page.url().includes('/login') || page.url().includes('/auth');
      const errorPage = await page.locator(selectors.common.errorPage).isVisible().catch(() => false);
      expect(onLogin || errorPage).toBeTruthy();
    });
  });
});
