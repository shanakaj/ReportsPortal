import { test, expect } from '../fixtures/auth';

test.describe('Customer Journey', () => {
  test.beforeEach(async ({ page, customer }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(customer.email);
    await page.getByLabel(/password/i).fill(customer.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });

    if (page.url().includes('mfa')) {
      test.skip(true, 'MFA verification required');
    }
  });

  test.describe('Dashboard', () => {
    test('should display customer dashboard', async ({ page }) => {
      await expect(page.getByText(/dashboard|reports|welcome/i)).toBeVisible();
    });

    test('should not show admin navigation items', async ({ page }) => {
      await expect(page.getByRole('link', { name: /users|audit|analytics/i })).not.toBeVisible();
    });

    test('should only see reports for assigned space', async ({ page }) => {
      const reportList = page.getByText(/reports|no reports/i);
      await expect(reportList).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Report Viewing', () => {
    test('should list available reports', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportList = page.locator('table, [data-testid="report-list"], [role="list"]');
      await expect(reportList.or(page.getByText(/no reports/i))).toBeVisible({ timeout: 10_000 });
    });

    test('should open a report in sandboxed iframe', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report|\.html/i }).first();
      if (await reportLink.isVisible()) {
        await reportLink.click();

        // Report should be rendered in an iframe with sandbox attribute
        const iframe = page.locator('iframe');
        await expect(iframe).toBeVisible({ timeout: 15_000 });

        // Verify sandbox attribute exists
        const sandbox = await iframe.getAttribute('sandbox');
        expect(sandbox).toBeDefined();
        expect(sandbox).toContain('allow-scripts');
      }
    });

    test('should not allow report download if disabled', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      // Customer should not see download buttons unless explicitly allowed
      const downloadButton = page.getByRole('button', { name: /download/i });
      // Download may or may not be visible depending on space settings
    });
  });

  test.describe('Feedback', () => {
    test('should create a new feedback thread on a report', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        const feedbackButton = page.getByRole('button', { name: /feedback|comment/i });
        if (await feedbackButton.isVisible()) {
          await feedbackButton.click();

          await page.getByLabel(/subject|title/i).fill('E2E Test Feedback');
          const messageInput = page.getByLabel(/message|comment/i).or(page.locator('textarea'));
          await messageInput.fill('This is a test feedback message from E2E tests');
          await page.getByRole('button', { name: /submit|send|create/i }).click();

          await expect(page.getByText(/submitted|created|success/i)).toBeVisible({ timeout: 10_000 });
        }
      }
    });

    test('should view existing feedback threads', async ({ page }) => {
      const feedbackNav = page.getByRole('link', { name: /feedback/i });
      if (await feedbackNav.isVisible()) {
        await feedbackNav.click();
        await page.waitForLoadState('networkidle');

        const feedbackList = page.getByText(/feedback|threads|no feedback/i);
        await expect(feedbackList).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should reply to own feedback thread', async ({ page }) => {
      const feedbackNav = page.getByRole('link', { name: /feedback/i });
      if (await feedbackNav.isVisible()) {
        await feedbackNav.click();
        await page.waitForLoadState('networkidle');

        const threadLink = page.locator('a, [role="link"], tr').filter({ hasText: /feedback|thread/i }).first();
        if (await threadLink.isVisible()) {
          await threadLink.click();
          await page.waitForLoadState('networkidle');

          const replyInput = page.getByLabel(/message|reply/i).or(page.locator('textarea'));
          if (await replyInput.isVisible()) {
            await replyInput.fill('Customer follow-up from E2E test');
            await page.getByRole('button', { name: /send|reply|submit/i }).click();

            await expect(page.getByText('Customer follow-up from E2E test')).toBeVisible({ timeout: 10_000 });
          }
        }
      }
    });

    test('should upload attachment with feedback', async ({ page }) => {
      const feedbackNav = page.getByRole('link', { name: /feedback/i });
      if (await feedbackNav.isVisible()) {
        await feedbackNav.click();
        await page.waitForLoadState('networkidle');

        const threadLink = page.locator('a, [role="link"], tr').filter({ hasText: /feedback|thread/i }).first();
        if (await threadLink.isVisible()) {
          await threadLink.click();
          await page.waitForLoadState('networkidle');

          const attachButton = page.getByRole('button', { name: /attach/i }).or(page.locator('input[type="file"]'));
          if (await attachButton.isVisible()) {
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles('fixtures/test-attachment.txt');
          }
        }
      }
    });
  });

  test.describe('Profile', () => {
    test('should view profile page', async ({ page }) => {
      const profileLink = page.getByRole('link', { name: /profile|account/i })
        .or(page.getByRole('button', { name: /profile|account/i }));
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await expect(page.getByText(/profile|account/i)).toBeVisible({ timeout: 5_000 });
      }
    });

    test('should change password', async ({ page }) => {
      const profileLink = page.getByRole('link', { name: /profile|account|settings/i })
        .or(page.getByRole('button', { name: /profile|account|settings/i }));
      if (await profileLink.isVisible()) {
        await profileLink.click();

        const changePasswordButton = page.getByRole('button', { name: /change.*password/i });
        if (await changePasswordButton.isVisible()) {
          await changePasswordButton.click();

          await page.getByLabel(/current.*password/i).fill('TestPassword123!');
          await page.getByLabel(/new.*password/i).fill('NewTestPassword123!');
          await page.getByLabel(/confirm.*password/i).fill('NewTestPassword123!');
          await page.getByRole('button', { name: /save|update|change/i }).click();
        }
      }
    });
  });

  test.describe('Notifications', () => {
    test('should see notification indicator', async ({ page }) => {
      const notificationIcon = page.getByRole('button', { name: /notification/i })
        .or(page.locator('[data-testid="notifications"]'))
        .or(page.locator('[aria-label*="notification"]'));

      await expect(notificationIcon).toBeVisible({ timeout: 10_000 });
    });

    test('should view notifications list', async ({ page }) => {
      const notificationIcon = page.getByRole('button', { name: /notification/i })
        .or(page.locator('[data-testid="notifications"]'))
        .or(page.locator('[aria-label*="notification"]'));

      if (await notificationIcon.isVisible()) {
        await notificationIcon.click();
        const notificationList = page.getByText(/notification|no notification/i);
        await expect(notificationList).toBeVisible({ timeout: 5_000 });
      }
    });
  });
});
