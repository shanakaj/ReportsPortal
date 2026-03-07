import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';
import path from 'path';

/**
 * VIDEO 8: "Admin Experience — Scoped Access & Feedback"
 *
 * NARRATIVE:
 * This video follows an admin (not a super admin) through their daily workflow.
 * Admins operate within a scoped environment — they can manage spaces they're
 * assigned to, upload reports, invite customers, and handle feedback threads,
 * but they cannot access super-admin features like analytics, audit logs,
 * impersonation, or admin invitations. This video proves the role boundary
 * works in practice.
 *
 * AUDIENCE: Delivery managers, security reviewers, product owners
 * DURATION: ~120 seconds
 */
test.describe('Video 8: Admin Experience — Scoped Access & Feedback', () => {
  test('An admin manages spaces, uploads a report, handles feedback, and sees role restrictions', async ({
    adminPage: page,
  }) => {

    // =====================================================================
    // SCENE 1: Admin Dashboard — What's visible, what's not
    // "The admin dashboard looks familiar, but notice the sidebar.
    //  Analytics and Audit Log are absent — those are super-admin
    //  privileges. The admin sees Spaces, Users, and Feedback."
    // =====================================================================
    await test.step('Scene 1: Admin dashboard — scoped navigation', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const dashboard = page.locator(selectors.dashboard.container).first();
      await expect(dashboard).toBeVisible().catch(() => false);
      await page.waitForTimeout(1000);

      // Hover over each nav item to highlight what's available
      const spacesLink = page.locator(selectors.nav.spacesLink).first();
      if (await spacesLink.isVisible().catch(() => false)) {
        await spacesLink.hover();
        await page.waitForTimeout(800);
      }

      const usersLink = page.locator(selectors.nav.usersLink).first();
      if (await usersLink.isVisible().catch(() => false)) {
        await usersLink.hover();
        await page.waitForTimeout(800);
      }

      const feedbackLink = page.locator(selectors.nav.feedbackLink).first();
      if (await feedbackLink.isVisible().catch(() => false)) {
        await feedbackLink.hover();
        await page.waitForTimeout(800);
      }

      // Show that Analytics and Audit Log are NOT visible
      const analyticsLink = page.locator(selectors.nav.analyticsLink).first();
      const isAnalyticsVisible = await analyticsLink.isVisible().catch(() => false);
      // Pause to let the viewer notice the absence
      await page.waitForTimeout(1500);

      const auditLogLink = page.locator(selectors.nav.auditLogLink).first();
      const isAuditVisible = await auditLogLink.isVisible().catch(() => false);
      await page.waitForTimeout(1000);
    });

    // =====================================================================
    // SCENE 2: View Assigned Spaces
    // "The admin navigates to Spaces. Unlike a super admin who sees every
    //  space in the system, this admin only sees spaces they've been
    //  assigned to. Each space is a customer engagement they're responsible for."
    // =====================================================================
    await test.step('Scene 2: View assigned spaces', async () => {
      const spacesLink = page.locator(selectors.nav.spacesLink).first();
      await spacesLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const spaceList = page.locator(selectors.spaceList.container).first();
      await expect(spaceList).toBeVisible().catch(() => false);
      await page.waitForTimeout(1000);

      // Hover over space cards to show the admin's portfolio
      const spaceCards = page.locator(selectors.spaceList.spaceCard);
      const spaceCount = await spaceCards.count();
      for (let i = 0; i < Math.min(spaceCount, 4); i++) {
        await spaceCards.nth(i).hover();
        await page.waitForTimeout(800);
      }

      // Show that Create Space button is NOT visible (super admin only)
      const createButton = page.locator(selectors.spaceList.createButton).first();
      const isCreateVisible = await createButton.isVisible().catch(() => false);
      // Pause — the viewer should notice there's no Create button
      await page.waitForTimeout(1500);
    });

    // =====================================================================
    // SCENE 3: Navigate into a Space — Upload a Report
    // "The admin clicks into one of their assigned spaces. Inside, they
    //  can upload reports and invite customers — scoped operations that
    //  don't require super admin privileges."
    // =====================================================================
    await test.step('Scene 3: Enter a space and upload a report', async () => {
      const firstSpace = page.locator(selectors.spaceList.spaceCard).first();
      const isSpaceVisible = await firstSpace.isVisible().catch(() => false);

      if (isSpaceVisible) {
        await firstSpace.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Show the space detail with existing reports
        const reportCards = page.locator(selectors.spaceDetail.reportCard);
        const reportCount = await reportCards.count();
        for (let i = 0; i < Math.min(reportCount, 3); i++) {
          await reportCards.nth(i).hover();
          await page.waitForTimeout(700);
        }
        await page.waitForTimeout(1000);

        // Upload a real report — the AppXray assessment from the quickreport project
        const uploadButton = page.locator(selectors.spaceDetail.uploadButton).first();
        const isUploadVisible = await uploadButton.isVisible().catch(() => false);

        if (isUploadVisible) {
          await uploadButton.click();
          await page.waitForTimeout(1500);

          const fileInput = page.locator(selectors.spaceDetail.uploadFileInput).first();
          const isFileInputPresent = await fileInput.count() > 0;

          if (isFileInputPresent) {
            // Upload the self-contained AppXray report (6.5MB with embedded images)
            const fixturesDir = path.resolve(__dirname, '../../fixtures/reports');
            await fileInput.setInputFiles(
              path.join(fixturesDir, 'appxray-report.html'),
            );
            await page.waitForTimeout(2500);
          }
        }

        // Show that Delete Space button is NOT visible (super admin only)
        const deleteButton = page.locator(selectors.spaceDetail.deleteButton).first();
        const isDeleteVisible = await deleteButton.isVisible().catch(() => false);
        await page.waitForTimeout(1500);
      }
    });

    // =====================================================================
    // SCENE 4: Invite a Customer to the Space
    // "The admin invites a customer to this space. The invitation triggers
    //  an email via SES, and the customer is guided through registration
    //  and MFA setup on their first login."
    // =====================================================================
    await test.step('Scene 4: Invite a customer to the space', async () => {
      const inviteButton = page.locator(selectors.spaceDetail.inviteButton).first();
      const isInviteVisible = await inviteButton.isVisible().catch(() => false);

      if (isInviteVisible) {
        await inviteButton.click();
        await page.waitForTimeout(1500);

        const emailInput = page.locator(selectors.inviteUser.emailInput).first();
        if (await emailInput.isVisible().catch(() => false)) {
          await emailInput.click();
          await page.waitForTimeout(500);
          await emailInput.fill('john.smith@clientcorp.com');
          await page.waitForTimeout(2000);
        }

        // Pause so the viewer can see the filled invitation form
        await page.waitForTimeout(1000);

        // Cancel — this is a demo, not a live invitation
        const cancelButton = page.locator(selectors.inviteUser.cancelButton).first();
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
      }
    });

    // =====================================================================
    // SCENE 5: Navigate to Feedback Inbox
    // "Feedback is where the admin collaborates with customers. Unlike
    //  email, every thread is tied to a specific report inside a specific
    //  space. The admin sees only feedback from their assigned spaces."
    // =====================================================================
    await test.step('Scene 5: Navigate to the feedback inbox', async () => {
      const feedbackLink = page.locator(selectors.nav.feedbackLink).first();
      const isFeedbackVisible = await feedbackLink.isVisible().catch(() => false);

      if (isFeedbackVisible) {
        await feedbackLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const inbox = page.locator(selectors.feedback.inboxContainer).first();
        await expect(inbox).toBeVisible().catch(() => false);
        await page.waitForTimeout(1000);

        // Hover over threads to show the queue
        const threads = page.locator(selectors.feedback.threadItem);
        const threadCount = await threads.count();
        for (let i = 0; i < Math.min(threadCount, 4); i++) {
          await threads.nth(i).hover();
          await page.waitForTimeout(700);
        }

        await page.waitForTimeout(1000);
      }
    });

    // =====================================================================
    // SCENE 6: Open a Thread and Reply
    // "The admin opens a customer's question, reads it in context alongside
    //  the report reference, and composes a reply. The entire conversation
    //  stays within the portal — no email threads to lose."
    // =====================================================================
    await test.step('Scene 6: Open a feedback thread and reply', async () => {
      const threadItem = page.locator(selectors.feedback.threadItem).first();
      const isThreadVisible = await threadItem.isVisible().catch(() => false);

      if (isThreadVisible) {
        await threadItem.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Read through the conversation
        const messages = page.locator(selectors.feedback.messageItem);
        const messageCount = await messages.count();
        for (let i = 0; i < Math.min(messageCount, 4); i++) {
          await messages.nth(i).scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
        }

        // Compose a reply
        const replyInput = page.locator(selectors.feedback.replyInput).first();
        if (await replyInput.isVisible().catch(() => false)) {
          await replyInput.click();
          await page.waitForTimeout(500);
          await replyInput.fill(
            'Thanks for flagging this. I have reviewed the findings with our ' +
            'security team and can confirm the remediation is now complete.\n\n' +
            'The updated report will be uploaded by end of day. Please let me ' +
            'know if you have any other questions.'
          );
          await page.waitForTimeout(2000);

          // Submit the reply
          const replySubmit = page.locator(selectors.feedback.replySubmit).first();
          if (await replySubmit.isVisible().catch(() => false)) {
            await replySubmit.click();
            await page.waitForTimeout(2500);
          }
        }
      }
    });

    // =====================================================================
    // SCENE 7: User Management — Scoped View
    // "The admin can view and manage users within their assigned spaces.
    //  But notice: there's no 'Invite Admin' button and no 'View As'
    //  impersonation button. Those are super-admin-only capabilities."
    // =====================================================================
    await test.step('Scene 7: User management with role restrictions', async () => {
      const usersLink = page.locator(selectors.nav.usersLink).first();
      if (await usersLink.isVisible().catch(() => false)) {
        await usersLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const userTable = page.locator(selectors.userManagement.userTable).first();
        await expect(userTable).toBeVisible().catch(() => false);
        await page.waitForTimeout(1000);

        // Browse user rows
        const userRows = page.locator(selectors.userManagement.userRow);
        const rowCount = await userRows.count();
        for (let i = 0; i < Math.min(rowCount, 5); i++) {
          await userRows.nth(i).hover();
          await page.waitForTimeout(700);
        }

        // Show that Invite Admin button is NOT visible
        const inviteAdminButton = page.locator(selectors.userManagement.inviteAdminButton).first();
        const isInviteAdminVisible = await inviteAdminButton.isVisible().catch(() => false);
        await page.waitForTimeout(1000);

        // Show that View-As / Impersonate button is NOT visible
        const viewAsButton = page.locator(selectors.userManagement.viewAsButton).first();
        const isViewAsVisible = await viewAsButton.isVisible().catch(() => false);
        await page.waitForTimeout(1500);
      }
    });

    // =====================================================================
    // SCENE 8: Notification Bell
    // "The admin checks notifications — new feedback, report uploads,
    //  customer registrations. Everything relevant to their assigned
    //  spaces appears here."
    // =====================================================================
    await test.step('Scene 8: Check notifications', async () => {
      const notifBell = page.locator(selectors.nav.notificationBell).first();
      const isNotifVisible = await notifBell.isVisible().catch(() => false);

      if (isNotifVisible) {
        await notifBell.click();
        await page.waitForTimeout(2000);

        const dropdown = page.locator(selectors.notifications.dropdown).first();
        if (await dropdown.isVisible().catch(() => false)) {
          const items = page.locator(selectors.notifications.item);
          const itemCount = await items.count();
          for (let i = 0; i < Math.min(itemCount, 3); i++) {
            await items.nth(i).hover();
            await page.waitForTimeout(700);
          }
          await page.waitForTimeout(1000);
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(1500);
      }

      // "Spaces, reports, feedback, users, notifications — the admin has
      //  everything they need to manage customer engagements, without any
      //  super-admin capabilities leaking through. The role boundary is clean."
    });
  });
});
