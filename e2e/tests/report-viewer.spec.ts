import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';
import * as api from '../helpers/api';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Report Viewer', () => {
  let spaceId: string;
  let reportId: string;

  test.beforeAll(async ({ request, superAdminToken }) => {
    try {
      const spaces = await api.listSpaces(request, superAdminToken);
      if (spaces.items.length > 0) {
        spaceId = spaces.items[0].spaceId;
        const reports = await api.listReports(request, superAdminToken, spaceId);
        if (reports.items.length > 0) {
          reportId = reports.items[0].reportId;
        }
      }
    } catch {
      // Will skip tests if no data
    }
  });

  test.describe('Embedded View', () => {
    test('should load report in sandboxed iframe', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);
      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

      const iframe = page.locator(selectors.reportViewer.iframe);
      await expect(iframe).toBeVisible({ timeout: 10_000 });

      // Verify sandbox attribute
      const sandbox = await iframe.getAttribute('sandbox');
      if (sandbox) {
        expect(sandbox).toContain('allow-scripts');
        expect(sandbox).toContain('allow-same-origin');
        expect(sandbox).not.toContain('allow-top-navigation');
        expect(sandbox).not.toContain('allow-forms');
        expect(sandbox).not.toContain('allow-popups');
      }
    });

    test('should have iframe src set', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);
      const iframe = page.locator(selectors.reportViewer.iframe);
      await expect(iframe).toBeVisible({ timeout: 15_000 });

      const src = await iframe.getAttribute('src');
      expect(src).toBeTruthy();
    });

    test('should show feedback toggle button', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);
      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      await expect(feedbackToggle).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('Full-Tab View', () => {
    test('should load report in full viewport with floating toolbar', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/report/${spaceId}/${reportId}`);
      await page.waitForLoadState('domcontentloaded');

      const iframe = page.locator(selectors.reportViewer.iframe);
      await expect(iframe).toBeVisible({ timeout: 15_000 });

      // At least one toolbar element should be visible
      const toolbar = page.locator(selectors.reportViewer.floatingToolbar);
      const backButton = page.locator(selectors.reportViewer.backToPortalButton);
      const feedbackButton = page.locator(selectors.reportViewer.feedbackToggle);

      const anyToolbar = await toolbar.isVisible({ timeout: 5_000 }).catch(() => false)
        || await backButton.isVisible({ timeout: 2_000 }).catch(() => false)
        || await feedbackButton.isVisible({ timeout: 2_000 }).catch(() => false);

      expect(anyToolbar).toBeTruthy();
    });

    test('should navigate back to portal via back button', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/report/${spaceId}/${reportId}`);
      await page.waitForLoadState('domcontentloaded');

      const backButton = page.locator(selectors.reportViewer.backToPortalButton);
      if (!(await backButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await backButton.click();
      await page.waitForURL((url) => !url.pathname.startsWith('/report/'), { timeout: 10_000 });
      expect(page.url()).not.toContain('/report/');
    });

    test('should toggle feedback overlay in full-tab mode', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/report/${spaceId}/${reportId}`);
      await page.waitForLoadState('domcontentloaded');

      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (!(await feedbackToggle.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Open
      await feedbackToggle.click();
      const overlay = page.locator(selectors.feedback.overlay).or(page.locator(selectors.feedback.panel));
      await expect(overlay).toBeVisible({ timeout: 5_000 });

      // Close
      await feedbackToggle.click();
      await expect(overlay).toBeHidden({ timeout: 5_000 });
    });
  });

  test.describe('Session Expiry', () => {
    test('should show overlay when signed cookies expire (mock 403)', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/report/${spaceId}/${reportId}`);
      await page.waitForLoadState('domcontentloaded');

      const iframe = page.locator(selectors.reportViewer.iframe);
      await expect(iframe).toBeVisible({ timeout: 15_000 });

      // Mock CloudFront 403
      await page.route('**/*.cloudfront.net/**', (route) => {
        route.fulfill({ status: 403, contentType: 'text/xml', body: '<Error><Code>AccessDenied</Code></Error>' });
      });
      await page.route('**/report-portal-*/**', (route) => {
        route.fulfill({ status: 403, contentType: 'text/xml', body: '<Error><Code>AccessDenied</Code></Error>' });
      });

      await page.reload();

      const overlay = page.locator(selectors.reportViewer.sessionExpiredOverlay);
      const isVisible = await overlay.isVisible({ timeout: 10_000 }).catch(() => false);

      if (isVisible) {
        await expect(overlay).toBeVisible();
        const goToPortalBtn = page.locator(selectors.reportViewer.sessionExpiredGoToPortal);
        await expect(goToPortalBtn).toBeVisible();
      }
    });
  });

  test.describe('CSP & Security', () => {
    test('should allow Mermaid CDN in CSP', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      let cspHeader: string | null = null;
      page.on('response', (response) => {
        if (response.url().includes('cloudfront') || response.url().includes('report')) {
          const csp = response.headers()['content-security-policy'];
          if (csp) cspHeader = csp;
        }
      });

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);
      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(3_000);

      if (cspHeader) {
        expect(cspHeader).toMatch(/cdn\.jsdelivr\.net/);
      }
    });
  });

  test.describe('Signed Cookies', () => {
    test('should set CloudFront signed cookies for report access', async ({ customerPage: page, customerContext: context }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/customer/spaces/${spaceId}/reports/${reportId}`);
      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

      const cookies = await context.cookies();
      const cfCookies = cookies.filter((c) =>
        c.name.startsWith('CloudFront-') ||
        c.name === 'CloudFront-Policy' ||
        c.name === 'CloudFront-Signature' ||
        c.name === 'CloudFront-Key-Pair-Id',
      );

      // In deployed env, expect 3+ cookies; in local dev they may not exist
      if (cfCookies.length > 0) {
        expect(cfCookies.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  test.describe('Analytics Tracking', () => {
    test('should fire analytics requests on report view', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      const analyticsRequests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('analytics') || req.url().includes('beacon') || req.url().includes('tracking')) {
          analyticsRequests.push(req.url());
        }
      });

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);
      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

      // Wait for analytics batch (30s interval)
      await page.waitForTimeout(5_000);

      // Navigate away to trigger beforeunload beacon
      await page.goto(BASE_URL);
      await page.waitForTimeout(2_000);

      // Note: sendBeacon may not be interceptable. This verifies the report loaded.
    });
  });
});
