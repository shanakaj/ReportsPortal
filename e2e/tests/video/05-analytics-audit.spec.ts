import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';

/**
 * VIDEO: "Visibility — Analytics & Audit Trail"
 *
 * NARRATIVE:
 *   A super admin reviews the analytics dashboard to track report engagement
 *   across customer spaces. They hover over charts to see tooltips, filter by
 *   space, and then switch to the audit log where every action in the system is
 *   recorded. This demonstrates the platform's built-in observability for
 *   compliance and business intelligence.
 *
 * AUDIENCE: Stakeholders, compliance officers, product managers
 * DURATION: ~90 seconds
 */
test.describe('Demo: Visibility — Analytics & Audit Trail', () => {
  test('Super admin explores analytics dashboards and reviews audit history', async ({
    superAdminPage: page,
  }) => {
    // "Our story begins on the admin dashboard. The super admin wants to
    //  understand how customers are engaging with their reports — and prove
    //  that every action in the system is being tracked."

    await test.step('Scene 1: Navigate to Analytics from the dashboard', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // "From the dashboard, the admin clicks into Analytics —
      //  the nerve centre for report engagement data."
      const dashboard = page.locator(selectors.dashboard.container).first();
      await expect(dashboard).toBeVisible().catch(() => {});
      await page.waitForTimeout(1000);

      const analyticsLink = page.locator(selectors.nav.analyticsLink).first();
      await analyticsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const analytics = page.locator(selectors.analytics.container).first();
      await expect(analytics).toBeVisible().catch(() => {});
    });

    // "The analytics page loads with interactive charts powered by Recharts.
    //  Let's explore what the data is telling us."

    await test.step('Scene 2: View charts and hover for tooltips', async () => {
      // Show the access chart — how often are reports being opened?
      const accessChart = page.locator(selectors.analytics.accessChart).first();
      const isAccessChartVisible = await accessChart.isVisible().catch(() => false);
      if (isAccessChartVisible) {
        await accessChart.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
      }

      // Show the time-spent chart — are customers actually reading reports?
      const timeChart = page.locator(selectors.analytics.timeSpentChart).first();
      const isTimeChartVisible = await timeChart.isVisible().catch(() => false);
      if (isTimeChartVisible) {
        await timeChart.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
      }

      // Show the tab breakdown chart — which report tabs get the most attention?
      const tabChart = page.locator(selectors.analytics.tabBreakdownChart).first();
      const isTabChartVisible = await tabChart.isVisible().catch(() => false);
      if (isTabChartVisible) {
        await tabChart.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
      }

      // "Now watch as the admin hovers across each chart — tooltips appear
      //  showing exact values, making the data actionable at a glance."
      const rechartsContainers = page.locator(selectors.analytics.rechartsContainer);
      const chartCount = await rechartsContainers.count();
      for (let i = 0; i < Math.min(chartCount, 3); i++) {
        const chart = rechartsContainers.nth(i);
        await chart.scrollIntoViewIfNeeded();
        const box = await chart.boundingBox();
        if (box) {
          // Sweep left-to-right across the chart to trigger tooltip animation
          await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
          await page.waitForTimeout(500);
          await page.mouse.move(box.x + box.width * 0.35, box.y + box.height / 2);
          await page.waitForTimeout(500);
          await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2);
          await page.waitForTimeout(500);
          await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
          await page.waitForTimeout(500);
          await page.mouse.move(box.x + box.width * 0.90, box.y + box.height / 2);
          await page.waitForTimeout(600);
        }
      }
    });

    // "The admin can narrow the view to a single customer space —
    //  perfect for preparing a client engagement review."

    await test.step('Scene 3: Filter analytics by space', async () => {
      const spaceSelector = page.locator(selectors.analytics.spaceSelector).first();
      const isSpaceSelectorVisible = await spaceSelector.isVisible().catch(() => false);

      if (isSpaceSelectorVisible) {
        await spaceSelector.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await spaceSelector.click();
        await page.waitForTimeout(1200);

        // Select the first available space to filter the charts
        const firstOption = page.locator('[role="option"]').first();
        const isOptionVisible = await firstOption.isVisible().catch(() => false);
        if (isOptionVisible) {
          await firstOption.click();
          await page.waitForTimeout(2000);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // "Notice how all charts update simultaneously —
      //  the data is now scoped to a single customer."
      await page.waitForTimeout(1500);
    });

    // "Need to share this data with your team? The export button
    //  lets you download everything as a CSV."

    await test.step('Scene 4: Show the export capability', async () => {
      const exportButton = page.locator(selectors.analytics.exportButton).first();
      const isExportVisible = await exportButton.isVisible().catch(() => false);

      if (isExportVisible) {
        await exportButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await exportButton.hover();
        await page.waitForTimeout(1500);
        // Hover only — we don't trigger the download in the demo
      }

      await page.waitForTimeout(1000);
    });

    // "Now the admin switches to the Audit Log — the compliance backbone
    //  of the platform. Every login, upload, invitation, and deletion
    //  is recorded here with timestamps and actor information."

    await test.step('Scene 5: Navigate to Audit Log', async () => {
      const auditLink = page.locator(selectors.nav.auditLogLink).first();
      await auditLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const auditLog = page.locator(selectors.auditLog.container).first();
      await expect(auditLog).toBeVisible().catch(() => {});
      await page.waitForTimeout(1000);
    });

    // "Let's browse through the recent entries. Each row tells a story:
    //  who did what, when, and to which resource."

    await test.step('Scene 6: Browse audit entries with hover detail', async () => {
      const logTable = page.locator(selectors.auditLog.logTable).first();
      const isTableVisible = await logTable.isVisible().catch(() => false);

      if (isTableVisible) {
        const entries = page.locator(selectors.auditLog.logEntry);
        const entryCount = await entries.count();

        for (let i = 0; i < Math.min(entryCount, 6); i++) {
          await entries.nth(i).scrollIntoViewIfNeeded();
          await entries.nth(i).hover();
          await page.waitForTimeout(700);
        }
      }

      await page.waitForTimeout(1200);
    });

    // "Finally, the admin filters the log by action type — for example,
    //  showing only 'login' events to investigate access patterns,
    //  or 'upload' events to verify report delivery."

    await test.step('Scene 7: Filter audit log by action type', async () => {
      const actionFilter = page.locator(selectors.auditLog.actionFilter).first();
      const isFilterVisible = await actionFilter.isVisible().catch(() => false);

      if (isFilterVisible) {
        await actionFilter.click();
        await page.waitForTimeout(1000);

        const option = page.locator('[role="option"]').first();
        const isOptionVisible = await option.isVisible().catch(() => false);
        if (isOptionVisible) {
          await option.click();
          await page.waitForTimeout(2000);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // Also show the date filter if available
      const dateFilter = page.locator(selectors.auditLog.dateFilter).first();
      const isDateFilterVisible = await dateFilter.isVisible().catch(() => false);
      if (isDateFilterVisible) {
        await dateFilter.hover();
        await page.waitForTimeout(1200);
      }

      // "Analytics and audit — two sides of the same coin.
      //  Together they give the organisation complete visibility
      //  into platform usage and full compliance traceability."
      await page.waitForTimeout(2000);
    });
  });
});
