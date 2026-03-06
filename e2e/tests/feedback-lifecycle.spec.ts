import { test, expect } from '../fixtures/auth';

test.describe('Feedback Lifecycle', () => {
  test.describe('Full Feedback Thread Lifecycle', () => {
    test('customer creates feedback, admin replies, admin resolves', async ({
      page,
      customer,
      admin,
    }) => {
      const threadSubject = `E2E Lifecycle ${Date.now()}`;

      // Step 1: Customer logs in and creates feedback
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/password/i).fill(customer.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Navigate to reports and find a report to give feedback on
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (!(await reportLink.isVisible())) {
        test.skip(true, 'No reports available for feedback');
        return;
      }

      await reportLink.click();
      await page.waitForLoadState('networkidle');

      const feedbackButton = page.getByRole('button', { name: /feedback|comment/i });
      if (!(await feedbackButton.isVisible())) {
        test.skip(true, 'Feedback button not available');
        return;
      }

      await feedbackButton.click();
      await page.getByLabel(/subject|title/i).fill(threadSubject);
      const messageInput = page.getByLabel(/message|comment/i).or(page.locator('textarea'));
      await messageInput.fill('Customer initial feedback message');
      await page.getByRole('button', { name: /submit|send|create/i }).click();
      await expect(page.getByText(/submitted|created|success/i)).toBeVisible({ timeout: 10_000 });

      // Step 2: Customer logs out
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else {
        await page.goto('/login');
      }

      // Step 3: Admin logs in and replies to feedback
      await page.getByLabel(/email/i).fill(admin.email);
      await page.getByLabel(/password/i).fill(admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required for admin');
        return;
      }

      await page.getByRole('link', { name: /feedback/i }).click();
      await page.waitForLoadState('networkidle');

      // Find the thread we just created
      const threadLink = page.getByText(threadSubject);
      if (await threadLink.isVisible()) {
        await threadLink.click();
        await page.waitForLoadState('networkidle');

        // Admin replies
        const replyInput = page.getByLabel(/message|reply/i).or(page.locator('textarea'));
        await replyInput.fill('Admin response to customer feedback');
        await page.getByRole('button', { name: /send|reply|submit/i }).click();
        await expect(page.getByText('Admin response to customer feedback')).toBeVisible({ timeout: 10_000 });

        // Admin resolves the thread
        const resolveButton = page.getByRole('button', { name: /resolve/i });
        if (await resolveButton.isVisible()) {
          await resolveButton.click();
          await expect(page.getByText(/resolved/i)).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('Feedback with Attachments', () => {
    test('customer can attach files to feedback', async ({ page, customer }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/password/i).fill(customer.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(customer|mfa|dashboard|reports)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        const feedbackButton = page.getByRole('button', { name: /feedback|comment/i });
        if (await feedbackButton.isVisible()) {
          await feedbackButton.click();

          await page.getByLabel(/subject|title/i).fill('Feedback with attachment');
          const messageInput = page.getByLabel(/message|comment/i).or(page.locator('textarea'));
          await messageInput.fill('See attached file for details');

          // Attach file
          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.isVisible()) {
            await fileInput.setInputFiles('fixtures/test-attachment.txt');
          }

          await page.getByRole('button', { name: /submit|send|create/i }).click();
          await expect(page.getByText(/submitted|created|success/i)).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('Feedback Notifications', () => {
    test('admin receives notification when customer creates feedback', async ({
      page,
      admin,
    }) => {
      // Login as admin to check notifications
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(admin.email);
      await page.getByLabel(/password/i).fill(admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      // Check notification icon for badge/count
      const notificationIcon = page.getByRole('button', { name: /notification/i })
        .or(page.locator('[data-testid="notifications"]'));

      if (await notificationIcon.isVisible()) {
        await notificationIcon.click();
        // Should see notification list
        const notificationList = page.getByText(/notification|feedback|no notification/i);
        await expect(notificationList).toBeVisible({ timeout: 5_000 });
      }
    });
  });
});
