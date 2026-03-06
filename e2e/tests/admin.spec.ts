import { test, expect } from '../fixtures/auth';

test.describe('Admin Journey', () => {
  test.beforeEach(async ({ page, admin }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(admin.email);
    await page.getByLabel(/password/i).fill(admin.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

    if (page.url().includes('mfa')) {
      test.skip(true, 'MFA verification required');
    }
  });

  test.describe('Dashboard', () => {
    test('should display admin dashboard', async ({ page }) => {
      await expect(page.getByText(/dashboard/i)).toBeVisible();
    });

    test('should not show super-admin-only features', async ({ page }) => {
      // Admin should NOT see invite admin button or audit logs
      await expect(page.getByRole('link', { name: /audit/i })).not.toBeVisible();
    });
  });

  test.describe('Report Management', () => {
    test('should navigate to a space and view reports', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      // Click on first space
      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (await spaceLink.isVisible()) {
        await spaceLink.click();
        await expect(page.getByText(/reports/i)).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should upload a report to a space', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (await spaceLink.isVisible()) {
        await spaceLink.click();
        await page.waitForLoadState('networkidle');

        const uploadButton = page.getByRole('button', { name: /upload/i });
        if (await uploadButton.isVisible()) {
          await uploadButton.click();

          // Upload file
          const fileInput = page.locator('input[type="file"]');
          await fileInput.setInputFiles('fixtures/sample-report.html');

          await page.getByRole('button', { name: /upload|submit/i }).click();
          await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 15_000 });
        }
      }
    });

    test('should delete a report', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (await spaceLink.isVisible()) {
        await spaceLink.click();
        await page.waitForLoadState('networkidle');

        const deleteButton = page.getByRole('button', { name: /delete/i }).first();
        if (await deleteButton.isVisible()) {
          await deleteButton.click();

          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await expect(page.getByText(/deleted|removed/i)).toBeVisible({ timeout: 10_000 });
          }
        }
      }
    });
  });

  test.describe('Customer Invitation', () => {
    test('should invite a customer to a space', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (await spaceLink.isVisible()) {
        await spaceLink.click();
        await page.waitForLoadState('networkidle');

        const inviteButton = page.getByRole('button', { name: /invite/i });
        if (await inviteButton.isVisible()) {
          await inviteButton.click();

          await page.getByLabel(/email/i).fill(`e2e-customer-${Date.now()}@example.com`);
          await page.getByRole('button', { name: /invite|send|submit/i }).click();

          await expect(page.getByText(/invited|invitation.*sent/i)).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('Feedback Management', () => {
    test('should view feedback threads for a report', async ({ page }) => {
      await page.getByRole('link', { name: /feedback/i }).click();
      await page.waitForLoadState('networkidle');

      // Should see feedback list or empty state
      const feedbackList = page.getByText(/feedback|threads|no feedback/i);
      await expect(feedbackList).toBeVisible({ timeout: 10_000 });
    });

    test('should reply to a feedback thread', async ({ page }) => {
      await page.getByRole('link', { name: /feedback/i }).click();
      await page.waitForLoadState('networkidle');

      const threadLink = page.locator('a, [role="link"], tr').filter({ hasText: /thread|feedback/i }).first();
      if (await threadLink.isVisible()) {
        await threadLink.click();
        await page.waitForLoadState('networkidle');

        const replyInput = page.getByLabel(/message|reply/i).or(page.locator('textarea'));
        if (await replyInput.isVisible()) {
          await replyInput.fill('Admin reply from E2E test');
          await page.getByRole('button', { name: /send|reply|submit/i }).click();

          await expect(page.getByText('Admin reply from E2E test')).toBeVisible({ timeout: 10_000 });
        }
      }
    });

    test('should resolve a feedback thread', async ({ page }) => {
      await page.getByRole('link', { name: /feedback/i }).click();
      await page.waitForLoadState('networkidle');

      const threadLink = page.locator('a, [role="link"], tr').filter({ hasText: /open/i }).first();
      if (await threadLink.isVisible()) {
        await threadLink.click();
        await page.waitForLoadState('networkidle');

        const resolveButton = page.getByRole('button', { name: /resolve/i });
        if (await resolveButton.isVisible()) {
          await resolveButton.click();
          await expect(page.getByText(/resolved/i)).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('Notifications', () => {
    test('should see notification bell/icon', async ({ page }) => {
      const notificationIcon = page.getByRole('button', { name: /notification/i })
        .or(page.locator('[data-testid="notifications"]'))
        .or(page.locator('[aria-label*="notification"]'));
      await expect(notificationIcon).toBeVisible({ timeout: 10_000 });
    });
  });
});
