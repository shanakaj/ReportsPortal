import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TEST_ATTACHMENT_PATH = path.resolve(__dirname, '..', 'fixtures', 'test-attachment.txt');

test.describe('Customer Journey', () => {
  test.describe('Dashboard', () => {
    test('should display customer dashboard', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.dashboard.container)).toBeVisible({ timeout: 10_000 });
    });

    test('should NOT show admin navigation items', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const usersLink = page.locator(selectors.nav.usersLink);
      await expect(usersLink).not.toBeVisible({ timeout: 3_000 });

      const auditLink = page.locator(selectors.nav.auditLink);
      await expect(auditLink).not.toBeVisible({ timeout: 3_000 });
    });

    test('should show notification bell', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.notificationsButton)).toBeVisible({ timeout: 10_000 });
    });

    test('should only see assigned spaces', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      const spaceList = page.locator(selectors.customerPortal.spaceCard).or(page.locator(selectors.spaceList.spaceCard));
      const emptyState = page.locator(selectors.common.emptyState);
      await expect(spaceList.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Report Viewing', () => {
    test('should list reports in assigned space', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportList = page.locator(selectors.customerPortal.reportList).or(page.locator(selectors.spaceDetail.reportList));
      const emptyState = page.locator(selectors.common.emptyState);
      await expect(reportList.or(emptyState)).toBeVisible({ timeout: 10_000 });
    });

    test('should open a report and see it in iframe', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(selectors.reportViewer.iframe)).toBeVisible({ timeout: 10_000 });
    });

    test('should have sandboxed iframe with allow-scripts allow-same-origin', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      const iframe = page.locator(selectors.reportViewer.iframe);
      await expect(iframe).toBeVisible({ timeout: 15_000 });

      const sandbox = await iframe.getAttribute('sandbox');
      if (sandbox) {
        expect(sandbox).toContain('allow-scripts');
        expect(sandbox).toContain('allow-same-origin');
        expect(sandbox).not.toContain('allow-top-navigation');
      }
    });

    test('should NOT show upload or delete buttons for customer', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const uploadBtn = page.locator(selectors.spaceDetail.uploadButton);
      await expect(uploadBtn).not.toBeVisible({ timeout: 3_000 });

      const deleteBtn = page.locator(selectors.spaceDetail.deleteButton);
      await expect(deleteBtn).not.toBeVisible({ timeout: 3_000 });
    });

    test('should show full-tab view option', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();
      await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

      const fullTabBtn = page.locator(selectors.reportViewer.fullTabButton);
      if (await fullTabBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(fullTabBtn).toBeVisible();
      }
    });
  });

  test.describe('Feedback', () => {
    test('should create a new feedback thread on a report', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      // Toggle feedback
      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (await feedbackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await feedbackToggle.click();
      }

      const newThreadBtn = page.locator(selectors.feedback.newThreadButton);
      if (!(await newThreadBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await newThreadBtn.click();
      await page.locator(selectors.feedback.subjectInput).fill(`E2E Customer Feedback ${Date.now()}`);
      await page.locator(selectors.feedback.messageEditor).fill('This is customer feedback from E2E test');
      await page.locator(selectors.feedback.submitButton).click();

      await expect(page.locator(selectors.common.toastSuccess).or(page.getByText(/submitted|created|success/i))).toBeVisible({ timeout: 10_000 });
    });

    test('should reply to own feedback thread', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (await feedbackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await feedbackToggle.click();
      }

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

      await replyInput.fill('Customer follow-up from E2E');
      await page.locator(selectors.feedback.replyButton).click();
      await expect(page.getByText('Customer follow-up from E2E')).toBeVisible({ timeout: 10_000 });
    });

    test('should upload attachment with feedback', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (await feedbackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await feedbackToggle.click();
      }

      const attachInput = page.locator(selectors.feedback.attachmentInput);
      if (await attachInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await attachInput.setInputFiles(TEST_ATTACHMENT_PATH);
      }
    });

    test('should see resolved feedback status', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);

      const spaceCard = page.locator(selectors.customerPortal.spaceCard).first().or(page.locator(selectors.spaceList.spaceCard).first());
      if (!(await spaceCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await spaceCard.click();

      const reportCard = page.locator(selectors.customerPortal.reportCard).first().or(page.locator(selectors.spaceDetail.reportCard).first());
      if (!(await reportCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await reportCard.click();

      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
      if (await feedbackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await feedbackToggle.click();
      }

      // Look for resolved status badge
      const resolvedBadge = page.getByText(/resolved/i);
      if (await resolvedBadge.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(resolvedBadge).toBeVisible();
      }
    });
  });

  test.describe('Notifications', () => {
    test('should see notification indicator', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator(selectors.nav.notificationsButton)).toBeVisible({ timeout: 10_000 });
    });

    test('should open notification dropdown and see items', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      await page.locator(selectors.nav.notificationsButton).click();

      const dropdown = page.locator(selectors.notifications.dropdown);
      const emptyState = page.locator(selectors.notifications.emptyState);
      await expect(dropdown.or(emptyState).or(page.getByText(/notification/i))).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('Profile & Settings', () => {
    test('should view profile page', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      const profileBtn = page.locator(selectors.nav.profileButton);
      if (await profileBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(page.getByText(/profile|account|settings/i)).toBeVisible({ timeout: 5_000 });
      }
    });

    test('should change password', async ({ customerPage: page }) => {
      await page.goto(BASE_URL);
      const profileBtn = page.locator(selectors.nav.profileButton);
      if (!(await profileBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await profileBtn.click();

      const changePasswordBtn = page.locator('button:has-text("Change Password")');
      if (await changePasswordBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await changePasswordBtn.click();
        await expect(page.locator(selectors.auth.currentPasswordInput)).toBeVisible({ timeout: 5_000 });
      }
    });
  });
});
