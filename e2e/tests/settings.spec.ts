import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Platform Settings', () => {
  test.describe('Navigation', () => {
    test('should show Settings link in admin sidebar', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.settingsLink)).toBeVisible({ timeout: 10_000 });
    });

    test('should navigate to settings page', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.settingsLink).click();
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should show Settings link for regular admin', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.settingsLink)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Super Admin - Full Access', () => {
    test('should display all settings sections', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      // Organization section
      await expect(page.getByText('Organization')).toBeVisible();
      await expect(page.locator(selectors.settings.orgNameInput)).toBeVisible();
      await expect(page.locator(selectors.settings.orgLegalEntityInput)).toBeVisible();

      // Admin Domain Restriction section
      await expect(page.getByText('Admin Domain Restriction')).toBeVisible();

      // Customer Invitation Domain Validation section
      await expect(page.getByText('Customer Invitation Domain Validation')).toBeVisible();

      // Upload Limits section
      await expect(page.getByText('Upload Limits')).toBeVisible();
      await expect(page.locator(selectors.settings.maxReportSizeInput)).toBeVisible();
      await expect(page.locator(selectors.settings.maxAttachmentSizeInput)).toBeVisible();

      // Security section
      await expect(page.getByText('Security')).toBeVisible();
      await expect(page.locator(selectors.settings.cookieTtlInput)).toBeVisible();
      await expect(page.locator(selectors.settings.invitationExpiryInput)).toBeVisible();

      // Notifications section
      await expect(page.getByText('Notifications')).toBeVisible();
    });

    test('should not show View Only badge for super admin', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const viewOnlyBadge = page.getByText('View Only');
      const isVisible = await viewOnlyBadge.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('should show Save Settings button for super admin', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(selectors.settings.saveButton)).toBeVisible();
    });

    test('should have editable organization name input', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const orgNameInput = page.locator(selectors.settings.orgNameInput);
      await expect(orgNameInput).toBeEnabled();
      const currentValue = await orgNameInput.inputValue();
      expect(currentValue.length).toBeGreaterThan(0);
    });

    test('should have editable legal entity input', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const legalEntityInput = page.locator(selectors.settings.orgLegalEntityInput);
      await expect(legalEntityInput).toBeEnabled();
    });

    test('should display admin domain badges', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      // At least one domain badge should be visible
      const domainBadges = page.locator('span:has-text("@")').filter({ hasText: '@' });
      await expect(domainBadges.first()).toBeVisible({ timeout: 5_000 });
    });

    test('should add a new admin domain', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const domainInput = page.locator(selectors.settings.domainInput);
      await expect(domainInput).toBeVisible();

      const testDomain = `e2e-test-${Date.now()}.com`;
      await domainInput.fill(testDomain);
      await page.locator(selectors.settings.addDomainButton).click();

      // New domain should appear as a badge
      await expect(page.getByText(`@${testDomain}`)).toBeVisible({ timeout: 5_000 });
    });

    test('should add a domain by pressing Enter', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const domainInput = page.locator(selectors.settings.domainInput);
      const testDomain = `e2e-enter-${Date.now()}.com`;
      await domainInput.fill(testDomain);
      await domainInput.press('Enter');

      await expect(page.getByText(`@${testDomain}`)).toBeVisible({ timeout: 5_000 });
    });

    test('should not add duplicate domains', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const domainInput = page.locator(selectors.settings.domainInput);
      const testDomain = `e2e-dup-${Date.now()}.com`;

      // Add first time
      await domainInput.fill(testDomain);
      await page.locator(selectors.settings.addDomainButton).click();
      await expect(page.getByText(`@${testDomain}`)).toBeVisible({ timeout: 5_000 });

      // Try adding again
      await domainInput.fill(testDomain);
      await page.locator(selectors.settings.addDomainButton).click();

      // Should still only have one instance
      const badges = page.getByText(`@${testDomain}`);
      const count = await badges.count();
      expect(count).toBe(1);
    });

    test('should show domain validation mode selector', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const selectTrigger = page.locator(selectors.settings.validationModeSelect);
      await expect(selectTrigger).toBeVisible();
      await expect(selectTrigger).toBeEnabled();
    });

    test('should open validation mode dropdown and show options', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const selectTrigger = page.locator(selectors.settings.validationModeSelect);
      await selectTrigger.click();

      await expect(page.getByRole('option', { name: /Off/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('option', { name: /Warn/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Strict/i })).toBeVisible();
    });

    test('should show contextual description for each validation mode', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      // Check that a description is visible for the current mode
      const description = page.locator('p.text-xs.text-muted-foreground').filter({
        hasText: /validation|domain|email|check|block|warning/i,
      });
      await expect(description).toBeVisible({ timeout: 5_000 });
    });

    test('should have editable upload limit inputs', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const maxReportSize = page.locator(selectors.settings.maxReportSizeInput);
      await expect(maxReportSize).toBeEnabled();
      const value = await maxReportSize.inputValue();
      expect(Number(value)).toBeGreaterThanOrEqual(1);

      const maxAttachmentSize = page.locator(selectors.settings.maxAttachmentSizeInput);
      await expect(maxAttachmentSize).toBeEnabled();
    });

    test('should have editable security inputs', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const cookieTtl = page.locator(selectors.settings.cookieTtlInput);
      await expect(cookieTtl).toBeEnabled();

      const invitationExpiry = page.locator(selectors.settings.invitationExpiryInput);
      await expect(invitationExpiry).toBeEnabled();
    });

    test('should display notification toggles', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      // Notification section should have two switch toggles
      const switches = page.locator('button[role="switch"]');
      const count = await switches.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should toggle notification switches', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const firstSwitch = page.locator('button[role="switch"]').first();
      await expect(firstSwitch).toBeEnabled();

      const initialState = await firstSwitch.getAttribute('aria-checked');
      await firstSwitch.click();
      const newState = await firstSwitch.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);

      // Toggle back
      await firstSwitch.click();
      const restoredState = await firstSwitch.getAttribute('aria-checked');
      expect(restoredState).toBe(initialState);
    });

    test('should save settings successfully', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      // Make a small change to trigger dirty state
      const orgNameInput = page.locator(selectors.settings.orgNameInput);
      const currentValue = await orgNameInput.inputValue();
      await orgNameInput.clear();
      await orgNameInput.fill(currentValue); // same value, but triggers dirty

      await page.locator(selectors.settings.saveButton).click();

      // Should show success message or toast
      const success = page.locator(selectors.settings.saveSuccess)
        .or(page.locator(selectors.common.toastSuccess))
        .or(page.getByText(/saved successfully/i));
      await expect(success).toBeVisible({ timeout: 10_000 });
    });

    test('should validate organization name is required', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const orgNameInput = page.locator(selectors.settings.orgNameInput);
      await orgNameInput.clear();
      await page.locator(selectors.settings.saveButton).click();

      // Should show validation error
      const error = page.locator('.text-destructive');
      await expect(error).toBeVisible({ timeout: 5_000 });
    });

    test('should persist settings after page reload', async ({ superAdminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const orgNameInput = page.locator(selectors.settings.orgNameInput);
      const currentValue = await orgNameInput.inputValue();

      // Reload and verify value persists
      await page.reload();
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const reloadedValue = await orgNameInput.inputValue();
      expect(reloadedValue).toBe(currentValue);
    });
  });

  test.describe('Regular Admin - View Only', () => {
    test('should navigate to settings page', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should show View Only badge', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.getByText('View Only')).toBeVisible({ timeout: 5_000 });
    });

    test('should have disabled organization name input', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const orgNameInput = page.locator(selectors.settings.orgNameInput);
      await expect(orgNameInput).toBeDisabled();
    });

    test('should have disabled legal entity input', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const legalEntityInput = page.locator(selectors.settings.orgLegalEntityInput);
      await expect(legalEntityInput).toBeDisabled();
    });

    test('should not show add domain input', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const domainInput = page.locator(selectors.settings.domainInput);
      const isVisible = await domainInput.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('should have disabled validation mode selector', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const selectTrigger = page.locator(selectors.settings.validationModeSelect);
      await expect(selectTrigger).toBeDisabled();
    });

    test('should have disabled upload limit inputs', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.locator(selectors.settings.maxReportSizeInput)).toBeDisabled();
      await expect(page.locator(selectors.settings.maxAttachmentSizeInput)).toBeDisabled();
    });

    test('should have disabled security inputs', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.locator(selectors.settings.cookieTtlInput)).toBeDisabled();
      await expect(page.locator(selectors.settings.invitationExpiryInput)).toBeDisabled();
    });

    test('should have disabled notification switches', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const switches = page.locator('button[role="switch"]');
      const count = await switches.count();
      for (let i = 0; i < count; i++) {
        await expect(switches.nth(i)).toBeDisabled();
      }
    });

    test('should not show Save Settings button', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      const saveButton = page.locator(selectors.settings.saveButton);
      const isVisible = await saveButton.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('should still display current settings values (read-only)', async ({ adminPage: page }) => {
      await page.goto(`${BASE_URL}/admin/settings`);
      await expect(page.locator(selectors.settings.container)).toBeVisible({ timeout: 10_000 });

      // Should display org name value
      const orgNameInput = page.locator(selectors.settings.orgNameInput);
      const value = await orgNameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);

      // Should display at least one domain badge
      const domainBadge = page.locator('span:has-text("@")').filter({ hasText: '@' });
      await expect(domainBadge.first()).toBeVisible({ timeout: 5_000 });
    });
  });
});
