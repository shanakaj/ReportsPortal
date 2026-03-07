import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';

/**
 * VIDEO 3: "Customer Experience — Report Access & Feedback"
 *
 * NARRATIVE:
 * See the portal through a customer's eyes. After logging in, a customer
 * finds their assigned spaces, opens a report served via CloudFront signed
 * cookies, and submits feedback with a question about the report content.
 * This end-to-end flow shows how customers interact with the reports
 * delivered to them — securely, intuitively, and without friction.
 *
 * AUDIENCE: Customer success leads, UX reviewers, prospective customers
 * DURATION: ~90 seconds
 */
test.describe('Video 3: Customer Experience — Report Access & Feedback', () => {
  test('A customer browses their spaces, reads a report, and submits feedback', async ({
    customerPage: page,
  }) => {

    // "When a customer logs in, they land on their personal dashboard.
    //  There is no admin clutter — just 'My Spaces', showing only the
    //  engagements they have been invited to. The interface is calm,
    //  focused, and purpose-built for report consumption."

    await test.step('Scene 1: Customer dashboard — "My Spaces"', async () => {
      await page.goto('/customer');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Let the viewer see the customer-facing layout
      const spaceList = page.locator(selectors.customerPortal.spaceList).first();
      await expect(spaceList).toBeVisible().catch(() => false);
      await page.waitForTimeout(1500);

      // Show the welcome message if present
      const welcome = page.locator(selectors.dashboard.welcomeMessage).first();
      if (await welcome.isVisible().catch(() => false)) {
        await page.waitForTimeout(1500);
      }

      await page.waitForTimeout(1000);
    });

    // "Let's browse the assigned spaces. Each card represents a separate
    //  customer engagement. The customer can only see spaces they have
    //  been explicitly invited to — there is no way to discover or
    //  access another customer's content."

    await test.step('Scene 2: Browse assigned spaces — hover to explore', async () => {
      await page.goto('/customer/spaces');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Hover over each space card to build visual interest
      const spaceCards = page.locator(selectors.customerPortal.spaceCard);
      const count = await spaceCards.count();

      for (let i = 0; i < Math.min(count, 4); i++) {
        await spaceCards.nth(i).hover();
        await page.waitForTimeout(800);
      }

      await page.waitForTimeout(1000);
    });

    // "The customer clicks into their space. Inside, they find all the
    //  reports that have been published for this engagement — security
    //  assessments, compliance reviews, architecture diagrams. Each
    //  report is a self-contained HTML document."

    await test.step('Scene 3: Open a space — the report library', async () => {
      const firstSpace = page.locator(selectors.customerPortal.spaceCard).first();
      const isSpaceVisible = await firstSpace.isVisible().catch(() => false);

      if (isSpaceVisible) {
        await firstSpace.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Show the report browser with available reports
        const reportBrowser = page.locator(selectors.customerPortal.reportBrowser).first();
        await expect(reportBrowser).toBeVisible().catch(() => false);
        await page.waitForTimeout(1000);

        // Hover over report cards to show the collection
        const reportCards = page.locator(selectors.customerPortal.reportCard);
        const reportCount = await reportCards.count();
        for (let i = 0; i < Math.min(reportCount, 3); i++) {
          await reportCards.nth(i).hover();
          await page.waitForTimeout(700);
        }

        await page.waitForTimeout(1000);
      }
    });

    // "Now for the key moment — the customer opens a report. The HTML
    //  content loads inside a secure iframe. Behind the scenes, CloudFront
    //  signed cookies authenticate this request. The report URL is
    //  time-limited and tied to this session. Copy the URL and paste it
    //  in another browser? Access denied."

    await test.step('Scene 4: View report in the secure embedded iframe', async () => {
      const reportCard = page.locator(selectors.customerPortal.reportCard).first();
      const isReportVisible = await reportCard.isVisible().catch(() => false);

      if (isReportVisible) {
        await reportCard.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Let the iframe render fully — this is the money shot
        const iframe = page.locator(selectors.reportViewer.iframe).first();
        if (await iframe.isVisible().catch(() => false)) {
          await page.waitForTimeout(2500);
        }
      }
    });

    // "For a distraction-free reading experience, the customer can switch
    //  to full-tab view. The floating toolbar stays tucked at the edge,
    //  ready when needed but never in the way. This is how you read a
    //  40-page security assessment without eye strain."

    await test.step('Scene 5: Full-tab view with floating toolbar', async () => {
      const fullTabButton = page.locator(selectors.reportViewer.openFullTabButton).first();
      const isFullTabVisible = await fullTabButton.isVisible().catch(() => false);

      if (isFullTabVisible) {
        await fullTabButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2500);

        // Show the floating toolbar
        const toolbar = page.locator(selectors.reportViewer.floatingToolbar).first();
        if (await toolbar.isVisible().catch(() => false)) {
          await toolbar.hover();
          await page.waitForTimeout(1500);
        }

        // Navigate back to the portal view
        const backButton = page.locator(selectors.reportViewer.backToPortalButton).first();
        if (await backButton.isVisible().catch(() => false)) {
          await backButton.click();
          await page.waitForTimeout(1500);
        } else {
          await page.goBack();
          await page.waitForTimeout(1500);
        }
      }
    });

    // "The customer has a question about the Q3 revenue figures in the
    //  report. Instead of composing a separate email — which could be
    //  forwarded, lost, or sent to the wrong thread — they use the
    //  built-in feedback panel. The question stays attached to the
    //  report, in context, with a full audit trail."

    await test.step('Scene 6: Submit feedback — "Question about Q3 revenue figures"', async () => {
      // Open the feedback panel
      const feedbackToggle = page.locator(selectors.reportViewer.feedbackToggle).first();
      const isFeedbackVisible = await feedbackToggle.isVisible().catch(() => false);

      if (isFeedbackVisible) {
        await feedbackToggle.click();
        await page.waitForTimeout(1500);

        // Start a new thread
        const newThread = page.locator(selectors.feedback.newThreadButton).first();
        if (await newThread.isVisible().catch(() => false)) {
          await newThread.click();
          await page.waitForTimeout(1000);
        }

        // Type the subject — a real question a customer would ask
        const subjectInput = page.locator(selectors.feedback.subjectInput).first();
        if (await subjectInput.isVisible().catch(() => false)) {
          await subjectInput.click();
          await page.waitForTimeout(500);
          await subjectInput.fill('Question about Q3 revenue figures');
          await page.waitForTimeout(1500);
        }

        // Compose the message with genuine detail
        const messageEditor = page.locator(selectors.feedback.messageEditor).first();
        if (await messageEditor.isVisible().catch(() => false)) {
          await messageEditor.click();
          await page.waitForTimeout(500);
          await messageEditor.fill(
            'Hi team,\n\n' +
            'I noticed the Q3 revenue figures show a 15% year-over-year increase, ' +
            'but the executive summary mentions "moderate growth." Could you provide ' +
            'a breakdown by product line so I can reconcile these numbers for my board presentation?\n\n' +
            'Specifically interested in Product A and Product C contributions.\n\n' +
            'Thanks!'
          );
          await page.waitForTimeout(2000);
        }

        // Pause so the viewer can read the composed message
        await page.waitForTimeout(1500);

        // Submit the feedback
        const submitButton = page.locator(selectors.feedback.submitButton).first();
        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
          await page.waitForTimeout(2500);
        }
      }
    });

    // "Finally, the customer checks their notification bell. The portal
    //  keeps a running log of updates — new reports uploaded, feedback
    //  replies, resolved threads. No need to check email; everything
    //  lives inside the portal."

    await test.step('Scene 7: Check the notification bell', async () => {
      const notifBell = page.locator(selectors.nav.notificationBell).first();
      const isNotifVisible = await notifBell.isVisible().catch(() => false);

      if (isNotifVisible) {
        await notifBell.click();
        await page.waitForTimeout(2000);

        // Show notification dropdown contents
        const dropdown = page.locator(selectors.notifications.dropdown).first();
        if (await dropdown.isVisible().catch(() => false)) {
          // Hover over notification items
          const items = page.locator(selectors.notifications.item);
          const itemCount = await items.count();
          for (let i = 0; i < Math.min(itemCount, 3); i++) {
            await items.nth(i).hover();
            await page.waitForTimeout(700);
          }
          await page.waitForTimeout(1500);
        }

        // Close the dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1500);
      }
    });
  });
});
