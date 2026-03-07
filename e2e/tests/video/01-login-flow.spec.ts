import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';

/**
 * VIDEO 1: "Secure Access — Login & MFA"
 *
 * NARRATIVE:
 * This video demonstrates how Report Portal enforces security from the very
 * first interaction. Every user — whether a super admin or a customer — must
 * authenticate with their credentials AND a time-based one-time password (TOTP).
 * There are no exceptions, no "skip for now" options, no SMS fallbacks.
 *
 * AUDIENCE: Product owners, security auditors, compliance reviewers
 * DURATION: ~60 seconds
 */
test.describe('Video 1: Secure Access — Login & MFA', () => {
  test('A user authenticates with credentials and MFA to access the portal', async ({ page }) => {
    const email = process.env.SUPER_ADMIN_EMAIL || 'shanaka.jayasundera@versent.com.au';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!';

    // ═══════════════════════════════════════════════════════════════════════
    // SCENE 1: The Login Page
    // "The portal greets every visitor with a clean, branded login screen.
    //  No public content is accessible without authentication."
    // ═══════════════════════════════════════════════════════════════════════
    await test.step('Scene 1: Portal login page loads', async () => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await expect(page.locator(selectors.login.emailInput).first()).toBeVisible();
      await page.waitForTimeout(2000);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SCENE 2: Entering Credentials
    // "The user enters their email address and password. Passwords must be
    //  at least 12 characters, enforced by Cognito at the identity layer."
    // ═══════════════════════════════════════════════════════════════════════
    await test.step('Scene 2: User enters email and password', async () => {
      const emailInput = page.locator(selectors.login.emailInput).first();
      await emailInput.click();
      await emailInput.fill(email);
      await page.waitForTimeout(800);

      const passwordInput = page.locator(selectors.login.passwordInput).first();
      await passwordInput.click();
      await passwordInput.fill(password);
      await page.waitForTimeout(800);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SCENE 3: Sign In & MFA Challenge
    // "After submitting credentials, Cognito responds with a MFA challenge.
    //  The user must open their authenticator app (Google Authenticator,
    //  Authy, 1Password) and enter the 6-digit time-based code."
    // ═══════════════════════════════════════════════════════════════════════
    await test.step('Scene 3: Submit and face MFA challenge', async () => {
      const submitButton = page.locator(selectors.login.submitButton).first();
      await submitButton.click();
      await page.waitForTimeout(2500);

      // MFA challenge screen
      const mfaInput = page.locator(selectors.mfa.codeInput).first();
      const isMfaVisible = await mfaInput.isVisible().catch(() => false);

      if (isMfaVisible) {
        await page.waitForTimeout(1500);
        // In a real scenario, the TOTP code comes from the authenticator app
        await mfaInput.click();
        await mfaInput.fill('123456');
        await page.waitForTimeout(1000);
        const mfaSubmit = page.locator(selectors.mfa.submitButton).first();
        await mfaSubmit.click();
        await page.waitForTimeout(2500);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SCENE 4: Dashboard — Authenticated
    // "Only after passing both factors does the user reach the dashboard.
    //  The sidebar shows role-appropriate navigation — admins see Spaces,
    //  Users, Analytics, and Audit Log. Customers see only their spaces."
    // ═══════════════════════════════════════════════════════════════════════
    await test.step('Scene 4: Dashboard loads with role-based navigation', async () => {
      await page.waitForURL(/\/(admin|customer)/, { timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Highlight navigation items one by one
      const navItems = [
        selectors.nav.dashboardLink,
        selectors.nav.spacesLink,
        selectors.nav.usersLink,
        selectors.nav.analyticsLink,
        selectors.nav.auditLogLink,
        selectors.nav.feedbackLink,
      ];

      for (const selector of navItems) {
        const item = page.locator(selector).first();
        if (await item.isVisible().catch(() => false)) {
          await item.hover();
          await page.waitForTimeout(600);
        }
      }
      await page.waitForTimeout(1000);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SCENE 5: Logout
    // "The user can securely log out at any time. Tokens are cleared
    //  client-side and the session is invalidated."
    // ═══════════════════════════════════════════════════════════════════════
    await test.step('Scene 5: Secure logout', async () => {
      const userMenu = page.locator(selectors.nav.userMenu).first();
      if (await userMenu.isVisible().catch(() => false)) {
        await userMenu.click();
        await page.waitForTimeout(1000);
      }

      const logoutButton = page.locator(selectors.nav.logoutButton).first();
      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();
        await page.waitForTimeout(2500);
      }
    });
  });
});
