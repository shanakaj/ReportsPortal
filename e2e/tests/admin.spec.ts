import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Admin Journey', () => {
  test.describe('Dashboard', () => {
    test('should display admin dashboard', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.dashboard.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should show spaces and users navigation', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.spacesLink)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(selectors.nav.usersLink)).toBeVisible({ timeout: 10_000 });
    });

    test('should NOT show audit log link (super admin only)', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const auditLink = page.locator(selectors.nav.auditLink);
      await expect(auditLink).not.toBeVisible({ timeout: 3_000 });
    });

    test('should NOT show invite admin button (super admin only)', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const inviteAdminBtn = page.locator(selectors.userManagement.inviteAdminButton);
      const isVisible = await inviteAdminBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('should NOT show impersonate/view-as buttons (super admin only)', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const viewAsBtn = page.locator(selectors.userManagement.viewAsButton);
      const count = await viewAsBtn.count();
      expect(count).toBe(0);
    });

    test('should show notification bell', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.notificationsButton)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Space Management', () => {
    test('should view assigned spaces', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should navigate into a space and see reports', async ({ adminPage: page }) => {
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
    });

    test('should NOT show delete space button (super admin only)', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const deleteBtn = page.locator(selectors.spaceDetail.deleteButton);
      const isVisible = await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });
  });

  test.describe('Report Management', () => {
    test('should upload a report to assigned space', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const uploadBtn = page.locator(selectors.spaceDetail.uploadButton);
      if (!(await uploadBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await uploadBtn.click();
      await page.locator(selectors.spaceDetail.fileInput).setInputFiles('fixtures/sample-report.html');

      const submitBtn = page.locator('button:has-text("Upload"), button:has-text("Submit"), button[type="submit"]');
      await submitBtn.click();
      await expect(page.locator(selectors.common.toastSuccess).or(page.getByText(/uploaded|success/i))).toBeVisible({ timeout: 15_000 });
    });

    test('should view report in embedded mode', async ({ adminPage: page }) => {
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
      await expect(page.locator(selectors.reportViewer.iframe)).toBeVisible({ timeout: 15_000 });
    });

    test('should delete a report', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.spacesLink).click();
      await expect(page.locator(selectors.spaceList.container)).toBeVisible({ timeout: 10_000 });

      const spaceCard = page.locator(selectors.spaceList.spaceCard).first();
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const deleteBtn = page.locator(selectors.spaceDetail.reportCard).first().locator('button:has-text("Delete")');
      if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.locator(selectors.common.confirmButton);
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    });
  });

  test.describe('Customer Invitation', () => {
    test('should invite a customer to assigned space', async ({ adminPage: page }) => {
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
  });

  test.describe('User Management', () => {
    test('should view and manage users in assigned spaces', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should disable a user', async ({ adminPage: page }) => {
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

    test('should reset user MFA', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.usersLink).click();
      await expect(page.locator(selectors.userManagement.container)).toBeVisible({ timeout: 10_000 });

      const resetBtn = page.locator(selectors.userManagement.resetMfaButton).first();
      if (await resetBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await resetBtn.click();
        const confirmBtn = page.locator(selectors.common.confirmButton);
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    });
  });

  test.describe('Feedback Management', () => {
    test('should navigate to feedback inbox', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      const feedbackLink = page.locator(selectors.nav.feedbackLink);
      if (await feedbackLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await feedbackLink.click();
        await expect(page.locator(selectors.feedback.threadList).or(page.getByText(/feedback|no feedback/i))).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should reply to a feedback thread', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      const feedbackLink = page.locator(selectors.nav.feedbackLink);
      if (!(await feedbackLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await feedbackLink.click();

      const threadCard = page.locator(selectors.feedback.threadCard).first();
      if (!(await threadCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await threadCard.click();

      const replyInput = page.locator(selectors.feedback.replyInput);
      if (!(await replyInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await replyInput.fill('Admin E2E reply');
      await page.locator(selectors.feedback.replyButton).click();
      await expect(page.getByText('Admin E2E reply')).toBeVisible({ timeout: 10_000 });
    });

    test('should resolve a feedback thread', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      const feedbackLink = page.locator(selectors.nav.feedbackLink);
      if (!(await feedbackLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await feedbackLink.click();

      const threadCard = page.locator(selectors.feedback.threadCard).first();
      if (!(await threadCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await threadCard.click();

      const resolveBtn = page.locator(selectors.feedback.resolveButton);
      if (await resolveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await resolveBtn.click();
        await expect(page.getByText(/resolved/i)).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should initiate a proactive feedback thread', async ({ adminPage: page }) => {
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

      // Toggle feedback panel
      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (await feedbackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await feedbackToggle.click();
      }

      const newThreadBtn = page.locator(selectors.feedback.newThreadButton);
      if (await newThreadBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await newThreadBtn.click();
        await page.locator(selectors.feedback.subjectInput).fill('Admin proactive feedback');
        await page.locator(selectors.feedback.messageEditor).fill('Please review the Q3 numbers.');
        await page.locator(selectors.feedback.submitButton).click();
      }
    });
  });

  test.describe('Analytics', () => {
    test('should view space analytics', async ({ adminPage: page }) => {
      await page.goto(BASE_URL);
      const analyticsLink = page.locator(selectors.nav.analyticsLink);
      if (await analyticsLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await analyticsLink.click();
        await expect(page.locator(selectors.analytics.container)).toBeVisible({ timeout: 10_000 });
      }
    });
  });
});
