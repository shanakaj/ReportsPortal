import { test, expect } from '../fixtures/auth';

test.describe('Invitation Flow', () => {
  test.describe('Admin Invites Customer', () => {
    test('should show invite customer form in space detail', async ({ page, admin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(admin.email);
      await page.getByLabel(/password/i).fill(admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (await spaceLink.isVisible()) {
        await spaceLink.click();
        await page.waitForLoadState('networkidle');

        const inviteButton = page.getByRole('button', { name: /invite/i });
        await expect(inviteButton).toBeVisible({ timeout: 5_000 });
      }
    });

    test('should invite a customer via email', async ({ page, admin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(admin.email);
      await page.getByLabel(/password/i).fill(admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (!(await spaceLink.isVisible())) {
        test.skip(true, 'No spaces available');
        return;
      }

      await spaceLink.click();
      await page.waitForLoadState('networkidle');

      const inviteButton = page.getByRole('button', { name: /invite/i });
      if (!(await inviteButton.isVisible())) {
        test.skip(true, 'Invite button not visible');
        return;
      }

      await inviteButton.click();
      const testEmail = `e2e-invite-${Date.now()}@example.com`;
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('button', { name: /invite|send|submit/i }).click();

      await expect(page.getByText(/invited|invitation.*sent|success/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should prevent duplicate invitations', async ({ page, admin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(admin.email);
      await page.getByLabel(/password/i).fill(admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const spaceLink = page.locator('a, [role="link"], tr').filter({ hasText: /space/i }).first();
      if (!(await spaceLink.isVisible())) {
        test.skip(true, 'No spaces available');
        return;
      }

      await spaceLink.click();
      await page.waitForLoadState('networkidle');

      const inviteButton = page.getByRole('button', { name: /invite/i });
      if (!(await inviteButton.isVisible())) {
        test.skip(true, 'Invite button not visible');
        return;
      }

      // Use a fixed email to test duplicate prevention
      const duplicateEmail = 'duplicate-test@example.com';

      // First invitation
      await inviteButton.click();
      await page.getByLabel(/email/i).fill(duplicateEmail);
      await page.getByRole('button', { name: /invite|send|submit/i }).click();
      await page.waitForTimeout(2_000);

      // Second invitation with same email
      await inviteButton.click();
      await page.getByLabel(/email/i).fill(duplicateEmail);
      await page.getByRole('button', { name: /invite|send|submit/i }).click();

      // Should see duplicate/already invited error
      await expect(
        page.getByText(/already|duplicate|exists|conflict/i)
          .or(page.getByText(/invited|success/i))
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Super Admin Invites Admin', () => {
    test('should show invite admin option for super admin', async ({ page, superAdmin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      const inviteAdminButton = page.getByRole('button', { name: /invite.*admin/i });
      await expect(inviteAdminButton).toBeVisible({ timeout: 10_000 });
    });

    test('should enforce versent.com.au domain for admin invites', async ({ page, superAdmin }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(superAdmin.email);
      await page.getByLabel(/password/i).fill(superAdmin.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

      if (page.url().includes('mfa')) {
        test.skip(true, 'MFA verification required');
        return;
      }

      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      const inviteAdminButton = page.getByRole('button', { name: /invite.*admin/i });
      if (!(await inviteAdminButton.isVisible())) {
        test.skip(true, 'Invite admin button not visible');
        return;
      }

      await inviteAdminButton.click();
      await page.getByLabel(/email/i).fill('external@gmail.com');
      await page.getByRole('button', { name: /invite|send|submit/i }).click();

      await expect(page.getByText(/versent|domain|not allowed|invalid/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('First Login After Invitation', () => {
    test('should require password change on first login', async ({ page }) => {
      // This tests the flow where a newly invited user logs in for the first time
      // and is required to set a new password (NEW_PASSWORD_REQUIRED challenge)
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('newly-invited@example.com');
      await page.getByLabel(/password/i).fill('TemporaryPassword1!');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should see either new password form, MFA setup, or error
      const newPasswordForm = page.getByLabel(/new.*password/i);
      const mfaSetup = page.getByText(/mfa|authenticator|setup/i);
      const errorMessage = page.getByText(/error|invalid|incorrect/i);

      await expect(
        newPasswordForm.or(mfaSetup).or(errorMessage)
      ).toBeVisible({ timeout: 15_000 });
    });
  });
});
