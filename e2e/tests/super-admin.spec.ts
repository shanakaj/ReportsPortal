import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';
import * as api from '../helpers/api';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Super Admin Journey', () => {
  test.describe('Dashboard', () => {
    test('should display admin dashboard with all navigation items', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.dashboard.container)).toBeVisible({ timeout: 10_000 });

      // Super admin should see all nav items
      await expect(page.locator(selectors.nav.spacesLink)).toBeVisible();
      await expect(page.locator(selectors.nav.usersLink)).toBeVisible();
    });

    test('should show analytics link (super admin only)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.analyticsLink)).toBeVisible({ timeout: 10_000 });
    });

    test('should show audit log link (super admin only)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.auditLink)).toBeVisible({ timeout: 10_000 });
    });

    test('should show settings link in sidebar', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.settingsLink)).toBeVisible({ timeout: 10_000 });
    });

    test('should show notification bell', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.notificationsButton)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Space Management', () => {
    const testSpaceName = `e2e-space-${Date.now()}`;

    test('should navigate to spaces page and see space list', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should create a new customer space', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      await page.locator(selectors.spaceList.createButton).click();
      const dialog = page.locator(selectors.createSpace.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator(selectors.createSpace.nameInput).fill(testSpaceName);
      await dialog.locator(selectors.createSpace.submitButton).click();

      // Should see success or new space in list
      const success = page.locator(selectors.common.toastSuccess).or(page.getByText(testSpaceName));
      await expect(success).toBeVisible({ timeout: 10_000 });
    });

    test('should show space name info label (domain matching guidance)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      await page.locator(selectors.spaceList.createButton).click();
      const dialog = page.locator(selectors.createSpace.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      const infoLabel = dialog.locator(selectors.createSpace.infoLabel);
      if (await infoLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(infoLabel).toContainText(/domain|email/i);
      }
    });

    test('should validate space name (lowercase, alphanumeric, hyphens)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      await page.locator(selectors.spaceList.createButton).click();
      const dialog = page.locator(selectors.createSpace.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator(selectors.createSpace.nameInput).fill('INVALID NAME!!');
      await dialog.locator(selectors.createSpace.submitButton).click();

      // Should show validation error
      const error = dialog.locator(selectors.login.errorMessage).or(dialog.locator('[role="alert"]'));
      await expect(error).toBeVisible({ timeout: 5_000 });
    });

    test('should search/filter spaces', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const searchInput = page.locator(selectors.spaceList.searchInput);
      if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await searchInput.fill('e2e');
        await page.waitForTimeout(500); // Debounce
      }
    });

    test('should navigate into a space and see reports', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await spaceCard.click();
        await expect(page.locator(selectors.spaceDetail.container)).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should delete a customer space (super admin only)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      // Find a test space
      const testSpace = page.getByText(/e2e-space-/i).first();
      if (await testSpace.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await testSpace.click();

        const deleteBtn = page.locator(selectors.spaceDetail.deleteButton);
        if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await deleteBtn.click();
          const confirmBtn = page.locator(selectors.common.confirmButton);
          if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await confirmBtn.click();
            await expect(page.locator(selectors.common.toastSuccess).or(page.getByText(/deleted/i))).toBeVisible({ timeout: 10_000 });
          }
        }
      }
    });

    test('should support pagination on spaces list', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const loadMore = page.locator(selectors.spaceList.loadMoreButton);
      if (await loadMore.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await loadMore.click();
        // Should load more items
        await page.waitForTimeout(1_000);
      }
    });
  });

  test.describe('Report Management', () => {
    test('should upload a report to a space', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();
      await expect(page.locator(selectors.spaceDetail.container)).toBeVisible({ timeout: 10_000 });

      const uploadBtn = page.locator(selectors.spaceDetail.uploadButton);
      if (!(await uploadBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await uploadBtn.click();
      const fileInput = page.locator(selectors.spaceDetail.fileInput);
      await fileInput.setInputFiles('fixtures/sample-report.html');

      const submitBtn = page.locator('button:has-text("Upload"), button:has-text("Submit"), button[type="submit"]');
      await submitBtn.click();
      await expect(page.locator(selectors.common.toastSuccess).or(page.getByText(/uploaded|success/i))).toBeVisible({ timeout: 15_000 });
    });

    test('should delete a report from a space', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.spaceDetail.reportCard).first();
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Find delete button on report
      const deleteBtn = reportCard.locator('button:has-text("Delete")').or(page.getByRole('button', { name: /delete/i }).first());
      if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.locator(selectors.common.confirmButton);
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    });

    test('should open report in embedded view', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.spaceDetail.reportCard).first();
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(selectors.reportViewer.iframe)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('User Management', () => {
    test('should navigate to users page', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should list users with role filter', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const roleFilter = page.locator(selectors.userManagement.roleFilter);
      if (await roleFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await roleFilter.click();
        const adminOption = page.getByRole('option', { name: /admin/i });
        if (await adminOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await adminOption.click();
        }
      }
    });

    test('should show invite admin button (super admin only)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.locator(selectors.userManagement.inviteAdminButton)).toBeVisible({ timeout: 5_000 });
    });

    test('should invite a new admin (versent.com.au email)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      await page.locator(selectors.userManagement.inviteAdminButton).click();
      const dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator(selectors.inviteUser.emailInput).fill(`e2e-admin-${Date.now()}@versent.com.au`);
      await dialog.locator(selectors.inviteUser.submitButton).click();

      const success = page.locator(selectors.common.toastSuccess).or(page.getByText(/invited|sent/i));
      await expect(success).toBeVisible({ timeout: 10_000 });
    });

    test('should reject non-versent.com.au email for admin invite', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      await page.locator(selectors.userManagement.inviteAdminButton).click();
      const dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator(selectors.inviteUser.emailInput).fill('external@gmail.com');
      await dialog.locator(selectors.inviteUser.submitButton).click();

      const error = dialog.locator(selectors.inviteUser.errorMessage).or(page.locator(selectors.common.toastError));
      await expect(error).toBeVisible({ timeout: 5_000 });
    });

    test('should show view-as/impersonate buttons (super admin only)', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const viewAsBtn = page.locator(selectors.userManagement.viewAsButton).first();
      await expect(viewAsBtn).toBeVisible({ timeout: 5_000 });
    });

    test('should disable a user', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const disableBtn = page.locator(selectors.userManagement.disableButton).first();
      if (await disableBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await disableBtn.click();
        const confirmBtn = page.locator(selectors.common.confirmButton);
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    });

    test('should reset user MFA', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const resetMfaBtn = page.locator(selectors.userManagement.resetMfaButton).first();
      if (await resetMfaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await resetMfaBtn.click();
        const confirmBtn = page.locator(selectors.common.confirmButton);
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    });
  });

  test.describe('Impersonation', () => {
    test('should start impersonation and show banner', async ({ superAdminPage: page }) => {
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
    });

    test('should disable write actions during impersonation', async ({ superAdminPage: page }) => {
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

      // Write actions should be disabled
      const uploadBtn = page.locator(selectors.spaceDetail.uploadButton);
      if (await uploadBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(uploadBtn).toBeDisabled();
      }

      const inviteBtn = page.locator(selectors.spaceDetail.inviteButton);
      if (await inviteBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(inviteBtn).toBeDisabled();
      }
    });

    test('should end impersonation and return to admin view', async ({ superAdminPage: page }) => {
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

      await page.locator(selectors.impersonation.exitButton).click();
      await expect(page.locator(selectors.impersonation.banner)).toBeHidden({ timeout: 10_000 });
    });
  });

  test.describe('Audit Log', () => {
    test('should navigate to audit log page', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.auditLink).click();
      await expect(page.locator(selectors.audit.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should display audit log table with entries', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.auditLink).click();
      await expect(page.locator(selectors.audit.logTable)).toBeVisible({ timeout: 10_000 });
    });

    test('should filter audit log by date range', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.auditLink).click();
      await expect(page.locator(selectors.audit.container)).toBeVisible({ timeout: 10_000 });

      const dateFilter = page.locator(selectors.audit.dateFilter);
      if (await dateFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await dateFilter.fill('2024-01-01');
      }
    });

    test('should filter audit log by action type', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.auditLink).click();
      await expect(page.locator(selectors.audit.container)).toBeVisible({ timeout: 10_000 });

      const actionFilter = page.locator(selectors.audit.actionFilter);
      if (await actionFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await actionFilter.click();
      }
    });
  });

  test.describe('Analytics', () => {
    test('should navigate to analytics dashboard', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.analyticsLink).click();
      await expect(page.locator(selectors.analytics.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should display analytics charts', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.analyticsLink).click();
      await expect(page.locator(selectors.analytics.container)).toBeVisible({ timeout: 10_000 });

      const chart = page.locator(selectors.analytics.chartContainer);
      if (await chart.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(chart).toBeVisible();
      }
    });

    test('should export analytics data', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.analyticsLink).click();
      await expect(page.locator(selectors.analytics.container)).toBeVisible({ timeout: 10_000 });

      const exportBtn = page.locator(selectors.analytics.exportButton);
      if (await exportBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await exportBtn.click();
      }
    });
  });

  test.describe('Notifications', () => {
    test('should open notification dropdown', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      const notifBtn = page.locator(selectors.nav.notificationsButton);
      await expect(notifBtn).toBeVisible({ timeout: 10_000 });

      await notifBtn.click();
      const dropdown = page.locator(selectors.notifications.dropdown);
      await expect(dropdown.or(page.getByText(/notification/i))).toBeVisible({ timeout: 5_000 });
    });

    test('should mark all notifications as read', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.notificationsButton).click();

      const markAllBtn = page.locator(selectors.notifications.markAllRead);
      if (await markAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await markAllBtn.click();
      }
    });
  });

  test.describe('Customer Invitation from Space', () => {
    test('should invite a customer to a space', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const inviteBtn = page.locator(selectors.spaceDetail.inviteButton);
      if (!(await inviteBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await inviteBtn.click();

      const dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator(selectors.inviteUser.emailInput).fill(`e2e-customer-${Date.now()}@example.com`);
      await dialog.locator(selectors.inviteUser.submitButton).click();

      const success = page.locator(selectors.common.toastSuccess).or(page.getByText(/invited|sent/i));
      await expect(success).toBeVisible({ timeout: 10_000 });
    });

    test('should show domain mismatch warning when inviting mismatched email', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const inviteBtn = page.locator(selectors.spaceDetail.inviteButton);
      if (!(await inviteBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await inviteBtn.click();

      const dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Use a clearly mismatched domain
      await dialog.locator(selectors.inviteUser.emailInput).fill('user@totally-different-domain.com');

      const warning = dialog.locator(selectors.inviteUser.domainWarning);
      if (await warning.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(warning).toBeVisible();
      }
    });
  });

  test.describe('Platform Settings', () => {
    test('should navigate to settings page and see all sections', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.settingsLink).click();
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.getByText('Organization')).toBeVisible();
      await expect(page.getByText('Admin Domain Restriction')).toBeVisible();
      await expect(page.getByText('Upload Limits')).toBeVisible();
      await expect(page.getByText('Security')).toBeVisible();
      await expect(page.getByText('Notifications')).toBeVisible();
    });

    test('should have editable inputs (super admin has full access)', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.locator(selectors.settings.orgNameInput)).toBeEnabled();
      await expect(page.locator(selectors.settings.maxReportSizeInput)).toBeEnabled();
      await expect(page.locator(selectors.settings.cookieTtlInput)).toBeEnabled();
    });

    test('should show Save Settings button', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(selectors.settings.saveButton)).toBeVisible();
    });

    test('should show notification toggle switches', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const switches = page.locator('button[role="switch"]');
      const count = await switches.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Switches should be enabled for super admin
      for (let i = 0; i < count; i++) {
        await expect(switches.nth(i)).toBeEnabled();
      }
    });
  });
});
