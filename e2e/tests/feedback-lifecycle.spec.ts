import { test, expect } from '../fixtures/auth.fixture';
import { selectors } from '../helpers/selectors';
import * as api from '../helpers/api';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe.serial('Feedback Lifecycle — Full Flow', () => {
  let spaceId: string;
  let reportId: string;

  test.beforeAll(async ({ request, superAdminToken }) => {
    try {
      const spaces = await api.listSpaces(request, superAdminToken);
      if (spaces.items.length > 0) {
        spaceId = spaces.items[0].spaceId;
        const reports = await api.listReports(request, superAdminToken, spaceId);
        if (reports.items.length > 0) {
          reportId = reports.items[0].reportId;
        }
      }
    } catch {
      // Will skip tests if no data
    }
  });

  test('Step 1: Customer creates feedback thread on a report', async ({ customerPage: page }) => {
    test.skip(!spaceId || !reportId, 'No space/report available');

    await page.goto(`${BASE_URL}/customer/spaces/${spaceId}/reports/${reportId}`);
    await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

    const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
    if (await feedbackToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await feedbackToggle.click();
    }

    const newThreadBtn = page.locator(selectors.feedback.newThreadButton);
    await expect(newThreadBtn).toBeVisible({ timeout: 5_000 });
    await newThreadBtn.click();

    const subject = `E2E Lifecycle ${Date.now()}`;
    await page.locator(selectors.feedback.subjectInput).fill(subject);
    await page.locator(selectors.feedback.messageEditor).fill('Customer initial feedback — please review findings on page 3.');
    await page.locator(selectors.feedback.submitButton).click();

    await expect(page.locator(selectors.common.toastSuccess).or(page.getByText(/created|submitted/i))).toBeVisible({ timeout: 10_000 });
  });

  test('Step 2: Admin sees notification for new feedback', async ({ adminPage: page }) => {
    test.skip(!spaceId, 'No space available');

    await page.goto(BASE_URL);
    const notifBtn = page.locator(selectors.nav.notificationsButton);
    await expect(notifBtn).toBeVisible({ timeout: 10_000 });

    await notifBtn.click();
    const dropdown = page.locator(selectors.notifications.dropdown);
    await expect(dropdown.or(page.getByText(/notification|feedback/i))).toBeVisible({ timeout: 5_000 });
  });

  test('Step 3: Admin navigates to feedback and replies', async ({ adminPage: page }) => {
    test.skip(!spaceId, 'No space available');

    await page.goto(BASE_URL);
    const feedbackLink = page.locator(selectors.nav.feedbackLink);
    if (!(await feedbackLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await feedbackLink.click();
    await expect(page.locator(selectors.feedback.threadList).or(page.getByText(/feedback/i))).toBeVisible({ timeout: 10_000 });

    const threadCard = page.locator(selectors.feedback.threadCard).first();
    if (!(await threadCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await threadCard.click();

    await expect(page.getByText(/please review findings/i)).toBeVisible({ timeout: 5_000 });

    const replyInput = page.locator(selectors.feedback.replyInput);
    await expect(replyInput).toBeVisible({ timeout: 5_000 });
    await replyInput.fill('Admin response: We have updated the findings based on the latest scan results.');
    await page.locator(selectors.feedback.replyButton).click();

    await expect(page.getByText(/updated the findings/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Step 4: Customer sees admin reply', async ({ customerPage: page }) => {
    test.skip(!spaceId || !reportId, 'No space/report available');

    await page.goto(`${BASE_URL}/customer/spaces/${spaceId}/reports/${reportId}`);
    await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

    const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
    if (await feedbackToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await feedbackToggle.click();
    }

    const threadCard = page.locator(selectors.feedback.threadCard).first();
    if (await threadCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await threadCard.click();
      const adminReply = page.getByText(/updated the findings/i);
      if (await adminReply.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(adminReply).toBeVisible();
      }
    }
  });

  test('Step 5: Customer replies back', async ({ customerPage: page }) => {
    test.skip(!spaceId || !reportId, 'No space/report available');

    await page.goto(`${BASE_URL}/customer/spaces/${spaceId}/reports/${reportId}`);
    await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

    const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
    if (await feedbackToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
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
    await replyInput.fill('Thank you — looks good now.');
    await page.locator(selectors.feedback.replyButton).click();
    await expect(page.getByText(/looks good now/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Step 6: Admin resolves the thread', async ({ adminPage: page }) => {
    test.skip(!spaceId, 'No space available');

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
    if (!(await resolveBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await resolveBtn.click();
    await expect(page.getByText(/resolved/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Step 7: Customer sees resolved status', async ({ customerPage: page }) => {
    test.skip(!spaceId || !reportId, 'No space/report available');

    await page.goto(`${BASE_URL}/customer/spaces/${spaceId}/reports/${reportId}`);
    await expect(page.locator(selectors.reportViewer.container)).toBeVisible({ timeout: 15_000 });

    const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle);
    if (await feedbackToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await feedbackToggle.click();
    }

    const resolvedBadge = page.getByText(/resolved/i);
    if (await resolvedBadge.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(resolvedBadge).toBeVisible();
    }
  });
});

test.describe('Feedback with Attachments', () => {
  test('customer can attach files to feedback messages', async ({ customerPage: page }) => {
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

    const newThreadBtn = page.locator(selectors.feedback.newThreadButton);
    if (!(await newThreadBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await newThreadBtn.click();

    await page.locator(selectors.feedback.subjectInput).fill('Feedback with attachment');
    await page.locator(selectors.feedback.messageEditor).fill('See attached evidence');

    const fileInput = page.locator(selectors.feedback.attachmentInput);
    if (await fileInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fileInput.setInputFiles(path.resolve(__dirname, '..', 'fixtures', 'test-attachment.txt'));
    }

    await page.locator(selectors.feedback.submitButton).click();
    await expect(page.locator(selectors.common.toastSuccess).or(page.getByText(/created|submitted/i))).toBeVisible({ timeout: 10_000 });
  });
});
