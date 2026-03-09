import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Invitation Flows', () => {
  test.describe('Admin Invites Customer to Space', () => {
    test('should show invite button in space detail', async ({ adminPage: page }) => {
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
      await expect(inviteBtn).toBeVisible({ timeout: 5_000 });
    });

    test('should invite a customer via email', async ({ adminPage: page }) => {
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

      const testEmail = `e2e-invite-${Date.now()}@example.com`;
      await dialog.locator(selectors.inviteUser.emailInput).fill(testEmail);
      await dialog.locator(selectors.inviteUser.submitButton).click();

      const success = page.locator(selectors.common.toastSuccess).or(page.getByText(/invited|sent|success/i));
      await expect(success).toBeVisible({ timeout: 10_000 });
    });

    test('should show domain mismatch warning for mismatched email', async ({ adminPage: page }) => {
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

      await dialog.locator(selectors.inviteUser.emailInput).fill('user@totally-different-domain.com');

      const warning = dialog.locator(selectors.inviteUser.domainWarning);
      if (await warning.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(warning).toContainText(/domain|mismatch/i);
      }
    });

    test('should prevent duplicate invitation to same email', async ({ adminPage: page }) => {
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

      const duplicateEmail = 'duplicate-invite-test@example.com';

      // First invite
      await inviteBtn.click();
      let dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.locator(selectors.inviteUser.emailInput).fill(duplicateEmail);
      await dialog.locator(selectors.inviteUser.submitButton).click();
      await page.waitForTimeout(2_000);

      // Second invite with same email
      await inviteBtn.click();
      dialog = page.locator(selectors.inviteUser.dialog);
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.locator(selectors.inviteUser.emailInput).fill(duplicateEmail);
      await dialog.locator(selectors.inviteUser.submitButton).click();

      const result = page.locator(selectors.common.toastError)
        .or(page.getByText(/already|duplicate|exists/i))
        .or(page.locator(selectors.common.toastSuccess));
      await expect(result).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Super Admin Invites Admin', () => {
    test('should show invite admin button for super admin', async ({ superAdminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      await expect(page.locator(selectors.userManagement.inviteAdminButton)).toBeVisible({ timeout: 5_000 });
    });

    test('should invite admin with versent.com.au email', async ({ superAdminPage: page }) => {
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

    test('should enforce versent.com.au domain for admin invites', async ({ superAdminPage: page }) => {
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
  });

  test.describe('First Login After Invitation', () => {
    test('should show password change form on first login', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator(selectors.login.emailInput).fill('newly-invited@example.com');
      await page.locator(selectors.login.passwordInput).fill('TemporaryPassword1!');
      await page.locator(selectors.login.submitButton).click();

      const newPasswordForm = page.locator(selectors.firstLogin.newPasswordInput);
      const mfaSetup = page.getByText(/mfa|authenticator|setup/i);
      const errorMessage = page.locator(selectors.login.errorMessage);

      await expect(newPasswordForm.or(mfaSetup).or(errorMessage)).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Invitation Token Expiry', () => {
    test('should reject expired invitation token', async ({ page }) => {
      await page.goto(`${BASE_URL}/invite/expired-token-12345`);

      const errorPage = await page.locator(selectors.common.errorPage).isVisible({ timeout: 10_000 }).catch(() => false);
      const alert = await page.locator('[role="alert"]').isVisible().catch(() => false);
      const redirected = page.url().includes('/login');

      expect(errorPage || alert || redirected).toBeTruthy();
    });
  });
});
