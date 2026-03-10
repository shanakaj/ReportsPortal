import { test, expect } from '../fixtures/auth.fixture';
import * as api from '../helpers/api';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_BASE = process.env.API_BASE_URL || `${BASE_URL}/api`;

test.describe('Report Loading — End-to-End', () => {
  let spaceId: string;
  let reportId: string;
  let reportFileName: string;

  test.beforeAll(async ({ request, superAdminToken }) => {
    try {
      const spaces = await api.listSpaces(request, superAdminToken);
      if (spaces.items.length > 0) {
        spaceId = spaces.items[0].spaceId;
        const reports = await api.listReports(request, superAdminToken, spaceId);
        if (reports.items.length > 0) {
          reportId = reports.items[0].reportId;
          reportFileName = reports.items[0].fileName;
        }
      }
    } catch {
      // Tests will skip if no data
    }
  });

  test.describe('API Response Structure', () => {
    test('admin GET report returns nested report object with relative URL', async ({ request, superAdminToken }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      const response = await request.get(
        `${API_BASE}/admin/spaces/${spaceId}/reports/${reportId}`,
        { headers: { Authorization: `Bearer ${superAdminToken}` } },
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Verify nested report object
      expect(body).toHaveProperty('report');
      expect(body.report).toHaveProperty('reportId', reportId);
      expect(body.report).toHaveProperty('fileName');
      expect(body.report.fileName).toBeTruthy();

      // Verify cloudFrontUrl contains /reports/ path
      expect(body).toHaveProperty('cloudFrontUrl');
      expect(body.cloudFrontUrl).toMatch(/\/reports\//);

      // Verify signed cookies
      expect(body).toHaveProperty('signedCookies');
    });

    test('customer GET report returns same structure', async ({ request, customerToken }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      const response = await request.get(
        `${API_BASE}/customer/spaces/${spaceId}/reports/${reportId}`,
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );

      // Customer might not have access — 200 or 403 are both valid outcomes
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('report');
        expect(body.report).toHaveProperty('reportId');
        expect(body).toHaveProperty('cloudFrontUrl');
        expect(body.cloudFrontUrl).toMatch(/\/reports\//);
        expect(body).toHaveProperty('signedCookies');
      }
    });
  });

  test.describe('Admin Report Loading', () => {
    test('should navigate to space and click View to load a report', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      // Navigate to the space detail page
      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}`);
      await page.waitForLoadState('networkidle');

      // Verify reports table is visible
      const reportTable = page.locator('table');
      await expect(reportTable).toBeVisible({ timeout: 15_000 });

      // Click the Eye (View embedded) button on the first report row
      const viewButton = page.locator('[data-testid="view-report"]').first();
      if (!(await viewButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
        // If no viewable reports, skip
        test.skip();
        return;
      }
      await viewButton.click();

      // Should navigate to report view page
      await page.waitForURL(/\/admin\/spaces\/.*\/reports\//, { timeout: 10_000 });

      // Verify report viewer loads without error
      const reportViewer = page.locator('[data-testid="report-viewer"]');
      const errorMessage = page.getByText(/Failed to load report/i);

      // Wait for either the viewer to appear or an error
      await expect(reportViewer.or(errorMessage)).toBeVisible({ timeout: 15_000 });

      // Assert no error — the viewer should be visible, not the error
      await expect(errorMessage).not.toBeVisible({ timeout: 3_000 });
      await expect(reportViewer).toBeVisible();
    });

    test('should display report file name', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);

      const reportViewer = page.locator('[data-testid="report-viewer"]');
      const errorMessage = page.getByText(/Failed to load report/i);

      await expect(reportViewer.or(errorMessage)).toBeVisible({ timeout: 15_000 });

      // If report loaded successfully, check file name
      if (await reportViewer.isVisible({ timeout: 3_000 }).catch(() => false)) {
        if (reportFileName) {
          const title = page.locator('[data-testid="report-title"]');
          await expect(title).toContainText(reportFileName, { timeout: 10_000 });
        }
      }
    });

    test('should render report content in iframe or show download prompt', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);

      const reportViewer = page.locator('[data-testid="report-viewer"]');
      const errorMessage = page.getByText(/Failed to load report/i);

      await expect(reportViewer.or(errorMessage)).toBeVisible({ timeout: 15_000 });

      if (await reportViewer.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // For viewable formats: iframe should be visible
        // For non-viewable formats: download prompt should be visible
        const iframe = page.locator('[data-testid="report-iframe"]');
        const imgTag = page.locator('[data-testid="report-viewer"] img');
        const downloadPrompt = page.getByText(/cannot be previewed/i);

        await expect(iframe.or(imgTag).or(downloadPrompt)).toBeVisible({ timeout: 10_000 });

        // If iframe, verify it has a src with /reports/
        if (await iframe.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const src = await iframe.getAttribute('src');
          expect(src).toBeTruthy();
          expect(src).toMatch(/\/reports\//);
        }
      }
    });

    test('should show Open Full Tab or Download buttons', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/${reportId}`);

      const reportViewer = page.locator('[data-testid="report-viewer"]');
      const errorMessage = page.getByText(/Failed to load report/i);

      await expect(reportViewer.or(errorMessage)).toBeVisible({ timeout: 15_000 });

      if (await reportViewer.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const fullTabBtn = page.locator('[data-testid="open-full-tab"]');
        const downloadBtn = page.locator('button:has-text("Download")');

        const hasFullTab = await fullTabBtn.isVisible({ timeout: 3_000 }).catch(() => false);
        const hasDownload = await downloadBtn.isVisible({ timeout: 3_000 }).catch(() => false);

        expect(hasFullTab || hasDownload).toBeTruthy();
      }
    });
  });

  test.describe('Customer Report Loading', () => {
    test('should navigate from space list to report view', async ({ customerPage: page }) => {
      // Customer portal is at /customer
      await page.goto(`${BASE_URL}/customer`);

      // Find and click first space card
      const spaceCard = page.locator('[data-testid="customer-space-card"]').first();
      if (!(await spaceCard.isVisible({ timeout: 10_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      // Wait for reports page to load
      await page.waitForURL(/\/customer\/spaces\//, { timeout: 10_000 });

      // Find and click "View" button on first report card
      const viewButton = page.locator('[data-testid="customer-report-card"] button:has-text("View")').first();
      if (!(await viewButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await viewButton.click();

      // Should navigate to report view
      await page.waitForURL(/\/customer\/spaces\/.*\/reports\//, { timeout: 10_000 });

      // Report viewer should load
      const reportViewer = page.locator('[data-testid="report-viewer"]');
      const errorMessage = page.getByText(/Failed to load report/i);

      await expect(reportViewer.or(errorMessage)).toBeVisible({ timeout: 15_000 });
      await expect(errorMessage).not.toBeVisible({ timeout: 3_000 });
      await expect(reportViewer).toBeVisible();
    });

    test('should load report via direct URL', async ({ customerPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/customer/spaces/${spaceId}/reports/${reportId}`);

      const reportViewer = page.locator('[data-testid="report-viewer"]');
      const errorMessage = page.getByText(/Failed to load report/i);

      await expect(reportViewer.or(errorMessage)).toBeVisible({ timeout: 15_000 });

      // If customer has access, viewer should be visible
      if (await reportViewer.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(errorMessage).not.toBeVisible({ timeout: 3_000 });

        const iframe = page.locator('[data-testid="report-iframe"]');
        const downloadPrompt = page.getByText(/cannot be previewed/i);
        await expect(iframe.or(downloadPrompt)).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test.describe('Full-Tab Report Loading', () => {
    test('should load report in full viewport without errors', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/report/${spaceId}/${reportId}`);
      await page.waitForLoadState('domcontentloaded');

      const errorMessage = page.getByText(/Failed to load report/i);
      const fullTabView = page.locator('[data-testid="full-tab-view"]');

      // Wait for full-tab view or error
      await expect(fullTabView.or(errorMessage)).toBeVisible({ timeout: 15_000 });

      // No error should be shown
      await expect(errorMessage).not.toBeVisible({ timeout: 3_000 });
    });

    test('should show floating toolbar with file name and navigation', async ({ superAdminPage: page }) => {
      test.skip(!spaceId || !reportId, 'No space/report available');

      await page.goto(`${BASE_URL}/report/${spaceId}/${reportId}`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for full-tab view to load
      const fullTabView = page.locator('[data-testid="full-tab-view"]');
      await expect(fullTabView).toBeVisible({ timeout: 15_000 });

      // Floating toolbar should be visible with Portal and Feedback buttons
      const toolbar = page.locator('[data-testid="floating-toolbar"]');
      await expect(toolbar).toBeVisible({ timeout: 5_000 });

      const portalBtn = toolbar.locator('button:has-text("Portal")');
      const feedbackBtn = toolbar.locator('[data-testid="feedback-toggle"]');

      await expect(portalBtn).toBeVisible({ timeout: 3_000 });
      await expect(feedbackBtn).toBeVisible({ timeout: 3_000 });
    });
  });

  test.describe('Report Loading Error Handling', () => {
    test('should show error for non-existent report', async ({ superAdminPage: page }) => {
      test.skip(!spaceId, 'No space available');

      await page.goto(`${BASE_URL}/admin/spaces/${spaceId}/reports/non-existent-report-id`);

      const errorMessage = page.getByText(/Failed to load report/i)
        .or(page.getByText(/not found/i));
      await expect(errorMessage).toBeVisible({ timeout: 15_000 });
    });

    test('should show error for non-existent space', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/spaces/non-existent-space-id/reports/some-report-id`);

      const errorMessage = page.getByText(/Failed to load report/i)
        .or(page.getByText(/not found/i));
      await expect(errorMessage).toBeVisible({ timeout: 15_000 });
    });
  });
});
