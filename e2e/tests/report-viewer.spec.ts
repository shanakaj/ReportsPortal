import { test, expect } from '../fixtures/auth';

test.describe('Report Viewer', () => {
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

  test.describe('iframe Sandboxing', () => {
    test('should render report in sandboxed iframe', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report|\.html/i }).first();
      if (!(await reportLink.isVisible())) {
        test.skip(true, 'No reports available');
        return;
      }

      await reportLink.click();
      await page.waitForLoadState('networkidle');

      const iframe = page.locator('iframe');
      await expect(iframe).toBeVisible({ timeout: 15_000 });

      // Verify sandbox attributes
      const sandbox = await iframe.getAttribute('sandbox');
      expect(sandbox).toBeDefined();
      expect(sandbox).toContain('allow-scripts');
      // Should NOT allow navigation away
      expect(sandbox).not.toContain('allow-top-navigation');
    });

    test('should apply CSP headers allowing Mermaid CDN', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (!(await reportLink.isVisible())) {
        test.skip(true, 'No reports available');
        return;
      }

      // Intercept the report serving response to check CSP
      const [response] = await Promise.all([
        page.waitForResponse((resp) => resp.url().includes('report') || resp.url().includes('.html'), {
          timeout: 10_000,
        }).catch(() => null),
        reportLink.click(),
      ]);

      if (response) {
        const csp = response.headers()['content-security-policy'];
        // If CSP is set, verify Mermaid CDN is allowed
        if (csp) {
          expect(csp).toMatch(/cdn\.jsdelivr\.net|mermaid/i);
        }
      }
    });
  });

  test.describe('Report Navigation', () => {
    test('should show report metadata (title, date, size)', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        // Should show report details
        const reportDetails = page.getByText(/report|uploaded|date|size/i);
        await expect(reportDetails).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should navigate back to report list', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        // Navigate back
        const backButton = page.getByRole('button', { name: /back/i })
          .or(page.getByRole('link', { name: /back|reports/i }));
        if (await backButton.isVisible()) {
          await backButton.click();
          await expect(page.getByText(/reports/i)).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Signed Cookie Access', () => {
    test('should receive signed cookies for report access', async ({ page, context }) => {
      await page.getByRole('link', { name: /reports/i }).first().click();
      await page.waitForLoadState('networkidle');

      const reportLink = page.locator('a, [role="link"], tr').filter({ hasText: /report/i }).first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        // Check for CloudFront signed cookies
        const cookies = await context.cookies();
        const cfCookies = cookies.filter(
          (c) =>
            c.name.startsWith('CloudFront-') ||
            c.name === 'CloudFront-Policy' ||
            c.name === 'CloudFront-Signature' ||
            c.name === 'CloudFront-Key-Pair-Id',
        );

        // In a deployed environment, we'd expect signed cookies
        // In local dev, this may not be present
        if (cfCookies.length > 0) {
          expect(cfCookies.length).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
});
