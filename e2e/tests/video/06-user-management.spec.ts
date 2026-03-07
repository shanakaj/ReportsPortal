import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';

/**
 * VIDEO: "Access Control — User Management & Impersonation"
 *
 * NARRATIVE:
 *   The super admin manages the user directory: browsing users, filtering by
 *   role, and demonstrating the admin invitation flow (restricted to
 *   @versent.com.au). Then they impersonate a customer to see exactly what
 *   that customer sees — in read-only mode, with a clear banner indicating
 *   impersonation is active. Finally they exit impersonation and return to
 *   admin view.
 *
 * AUDIENCE: Security reviewers, operations managers, client success leads
 * DURATION: ~120 seconds
 */
test.describe('Demo: Access Control — User Management & Impersonation', () => {
  test('Super admin manages users, invites an admin, and impersonates a customer', async ({
    superAdminPage: page,
  }) => {
    // "The super admin needs to review the user directory, invite a new
    //  team member, and then step into a customer's shoes to verify their
    //  experience. Let's follow that journey."

    await test.step('Scene 1: Navigate to Users', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // "From the admin dashboard, the Users link in the sidebar
      //  opens the full user management console."
      const usersLink = page.locator(selectors.nav.usersLink).first();
      await usersLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const userTable = page.locator(selectors.userManagement.userTable).first();
      await expect(userTable).toBeVisible().catch(() => {});
    });

    // "The user table shows every account in the system — admins,
    //  super admins, and customers — with their roles and status."

    await test.step('Scene 2: Browse the user list', async () => {
      const userRows = page.locator(selectors.userManagement.userRow);
      const rowCount = await userRows.count();

      // Hover through each row so the viewer can read the details
      for (let i = 0; i < Math.min(rowCount, 6); i++) {
        await userRows.nth(i).scrollIntoViewIfNeeded();
        await userRows.nth(i).hover();
        await page.waitForTimeout(700);
      }

      await page.waitForTimeout(1000);
    });

    // "The admin filters the list to show only customers —
    //  useful when reviewing who has access to report spaces."

    await test.step('Scene 3: Filter by role (Customer)', async () => {
      const roleFilter = page.locator(selectors.userManagement.roleFilter).first();
      const isFilterVisible = await roleFilter.isVisible().catch(() => false);

      if (isFilterVisible) {
        await roleFilter.click();
        await page.waitForTimeout(1000);

        const customerOption = page.locator('[role="option"]:has-text("Customer"), option:has-text("Customer")').first();
        const isCustomerVisible = await customerOption.isVisible().catch(() => false);
        if (isCustomerVisible) {
          await customerOption.click();
          await page.waitForTimeout(2000);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // "Notice the table now shows only customer accounts.
      //  The admin can quickly assess who has portal access."
      await page.waitForTimeout(1000);
    });

    // "Now watch the admin invitation flow. Admin accounts are restricted
    //  to @versent.com.au email addresses — a domain-level security control
    //  that prevents accidental privilege escalation."

    await test.step('Scene 4: Open Invite Admin dialog and show domain restriction', async () => {
      const inviteAdminButton = page.locator(selectors.userManagement.inviteAdminButton).first();
      const isInviteVisible = await inviteAdminButton.isVisible().catch(() => false);

      if (isInviteVisible) {
        await inviteAdminButton.click();
        await page.waitForTimeout(1500);

        // Type a valid @versent.com.au email to show the expected flow
        const emailInput = page.locator(selectors.inviteUser.emailInput).first();
        const isEmailVisible = await emailInput.isVisible().catch(() => false);
        if (isEmailVisible) {
          await emailInput.click();
          await emailInput.fill('new.colleague@versent.com.au');
          await page.waitForTimeout(1500);

          // "The domain is accepted. But what if someone tries a
          //  non-Versent email? Let's see..."
          await emailInput.clear();
          await page.waitForTimeout(500);
          await emailInput.fill('external.user@gmail.com');
          await page.waitForTimeout(2000);

          // The UI should show a domain warning or validation error
        }

        // Cancel without sending — this is just a demonstration
        const cancelButton = page.locator(selectors.inviteUser.cancelButton).first();
        const isCancelVisible = await cancelButton.isVisible().catch(() => false);
        if (isCancelVisible) {
          await cancelButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
      }
    });

    // "Next: impersonation. This is the most powerful admin tool —
    //  and the most carefully controlled. The admin can see exactly
    //  what a customer sees, but in strict read-only mode."

    await test.step('Scene 5: Impersonate a customer', async () => {
      const viewAsButton = page.locator(selectors.userManagement.viewAsButton).first();
      const isViewAsVisible = await viewAsButton.isVisible().catch(() => false);

      if (isViewAsVisible) {
        await viewAsButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2500);

        // "A bright banner appears at the top of the screen —
        //  there's no ambiguity about what's happening."
        const banner = page.locator(selectors.impersonation.banner).first();
        const isBannerVisible = await banner.isVisible().catch(() => false);
        if (isBannerVisible) {
          await banner.hover();
          await page.waitForTimeout(2000);
        }
      }
    });

    // "The admin is now seeing the platform through the customer's eyes.
    //  Let's browse their spaces and confirm the read-only restriction."

    await test.step('Scene 6: Browse as the impersonated customer', async () => {
      const customerSpaces = page.locator(selectors.customerPortal.spaceList).first();
      const isSpacesVisible = await customerSpaces.isVisible().catch(() => false);

      if (isSpacesVisible) {
        await page.waitForTimeout(1500);

        // Browse through the customer's space cards
        const spaceCards = page.locator(selectors.customerPortal.spaceCard);
        const cardCount = await spaceCards.count();
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          await spaceCards.nth(i).scrollIntoViewIfNeeded();
          await spaceCards.nth(i).hover();
          await page.waitForTimeout(800);
        }
      }

      // "Notice that upload and invite buttons are disabled —
      //  impersonation is strictly read-only by design."
      const uploadButton = page.locator(selectors.spaceDetail.uploadButton).first();
      const isUploadVisible = await uploadButton.isVisible().catch(() => false);
      if (isUploadVisible) {
        await uploadButton.hover();
        await page.waitForTimeout(1200);
      }

      await page.waitForTimeout(1000);
    });

    // "Time to return to admin view. One click on the exit button
    //  and the impersonation session ends cleanly."

    await test.step('Scene 7: Exit impersonation and return to admin view', async () => {
      const exitButton = page.locator(selectors.impersonation.exitButton).first();
      const isExitVisible = await exitButton.isVisible().catch(() => false);

      if (isExitVisible) {
        await exitButton.hover();
        await page.waitForTimeout(800);
        await exitButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2500);
      }

      // "The banner is gone. The admin is back in their own context
      //  with full privileges restored."
      const dashboard = page.locator(selectors.dashboard.container).first();
      await expect(dashboard).toBeVisible().catch(() => {});
      await page.waitForTimeout(1000);
    });

    // "Finally, let's glance at the admin-level user actions available:
    //  disabling accounts and resetting MFA — powerful tools that are
    //  fully audited in the audit log we saw earlier."

    await test.step('Scene 8: Show user management actions (hover only)', async () => {
      // Navigate back to Users
      const usersLink = page.locator(selectors.nav.usersLink).first();
      const isUsersVisible = await usersLink.isVisible().catch(() => false);
      if (isUsersVisible) {
        await usersLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
      }

      // Hover over the Disable button to show it exists
      const disableButton = page.locator(selectors.userManagement.disableButton).first();
      const isDisableVisible = await disableButton.isVisible().catch(() => false);
      if (isDisableVisible) {
        await disableButton.hover();
        await page.waitForTimeout(1200);
      }

      // Hover over the Reset MFA button
      const resetMfaButton = page.locator(selectors.userManagement.resetMfaButton).first();
      const isResetVisible = await resetMfaButton.isVisible().catch(() => false);
      if (isResetVisible) {
        await resetMfaButton.hover();
        await page.waitForTimeout(1200);
      }

      // "User management, role-based access, domain-restricted invitations,
      //  and audited impersonation — the platform gives administrators
      //  powerful tools without compromising security."
      await page.waitForTimeout(2000);
    });
  });
});
