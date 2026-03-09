import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';
import path from 'path';

/**
 * VIDEO 2: "Platform Management — Spaces & Reports"
 *
 * NARRATIVE:
 * Follow a super admin as they create a new customer space, upload an HTML
 * report, preview it in the secure iframe viewer, and invite a customer.
 * This demonstrates the core workflow that makes Report Portal valuable —
 * creating isolated, secure spaces for each customer where confidential
 * reports are delivered through CloudFront signed cookies.
 *
 * AUDIENCE: Product owners, delivery managers, prospective customers
 * DURATION: ~90 seconds
 */
test.describe('Video 2: Platform Management — Spaces & Reports', () => {
  const testSpaceName = 'acme-corp-assessment';

  test('A super admin creates a space, uploads a report, previews it, and invites a customer', async ({
    superAdminPage: page,
  }) => {

    // "Every engagement begins here — the admin dashboard.
    //  At a glance, the super admin sees how many spaces are active,
    //  how many users are on the platform, and what needs attention."

    await test.step('Scene 1: Dashboard overview — the command centre', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Let the viewer absorb the dashboard layout
      const dashboard = page.locator(selectors.dashboard.container).first();
      await expect(dashboard).toBeVisible().catch(() => false);
      await page.waitForTimeout(1500);

      // Hover over key metrics to draw attention
      const spaceCount = page.locator(selectors.dashboard.spaceCount).first();
      if (await spaceCount.isVisible().catch(() => false)) {
        await spaceCount.hover();
        await page.waitForTimeout(1000);
      }

      const userCount = page.locator(selectors.dashboard.userCount).first();
      if (await userCount.isVisible().catch(() => false)) {
        await userCount.hover();
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(1000);
    });

    // "Now let's navigate to the Spaces section. Each space is an isolated
    //  environment for a single customer — their reports, their users,
    //  their feedback threads. No cross-contamination, ever."

    await test.step('Scene 2: Navigate to Spaces — isolated customer environments', async () => {
      const spacesLink = page.locator(selectors.nav.spacesLink).first();
      await spacesLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Show the existing spaces list
      const spaceList = page.locator(selectors.spaceList.container).first();
      await expect(spaceList).toBeVisible().catch(() => false);
      await page.waitForTimeout(1000);

      // Hover over existing space cards to show the portfolio
      const existingSpaces = page.locator(selectors.spaceList.spaceCard);
      const spaceCount = await existingSpaces.count();
      for (let i = 0; i < Math.min(spaceCount, 3); i++) {
        await existingSpaces.nth(i).hover();
        await page.waitForTimeout(800);
      }

      await page.waitForTimeout(1000);
    });

    // "A new customer engagement has just been signed. Let's create their
    //  dedicated space — 'Acme Corp Assessment'. This takes seconds, not
    //  days of infrastructure provisioning."

    await test.step('Scene 3: Create a new space — "Acme Corp Assessment"', async () => {
      const createButton = page.locator(selectors.spaceList.createButton).first();
      await createButton.click();
      await page.waitForTimeout(1500);

      // Type the space name deliberately so the viewer can read it
      const nameInput = page.locator(selectors.createSpace.nameInput).first();
      await nameInput.click();
      await page.waitForTimeout(500);
      await nameInput.fill(testSpaceName);
      await page.waitForTimeout(1500);

      // Pause on the filled form — let the viewer see what's about to be created
      await page.waitForTimeout(1000);

      // Submit and watch the space come to life
      const submitButton = page.locator(selectors.createSpace.submitButton).first();
      await submitButton.click({ force: true });
      await page.waitForTimeout(2500);
    });

    // "The space is live. Now we need to deliver something valuable — a report.
    //  We'll upload a real architecture review report with accompanying
    //  diagrams. The platform supports multi-file uploads: an HTML report
    //  plus images referenced within it. Everything is stored in S3 and
    //  served through CloudFront with signed cookies."

    await test.step('Scene 4: Upload a real report with images', async () => {
      // Navigate into the space if we're still on the list
      const spaceCard = page.locator(selectors.spaceList.spaceCard).filter({
        hasText: testSpaceName,
      }).first();
      const isCardVisible = await spaceCard.isVisible().catch(() => false);
      if (isCardVisible) {
        await spaceCard.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
      }

      const uploadButton = page.locator(selectors.spaceDetail.uploadButton).first();
      const isUploadVisible = await uploadButton.isVisible().catch(() => false);

      if (isUploadVisible) {
        await uploadButton.click();
        await page.waitForTimeout(1500);

        // Upload the HTML report along with its image assets
        const fileInput = page.locator(selectors.spaceDetail.uploadFileInput).first();
        const isFileInputPresent = await fileInput.count() > 0;

        if (isFileInputPresent) {
          const fixturesDir = path.resolve(__dirname, '../../fixtures/reports');
          await fileInput.setInputFiles([
            path.join(fixturesDir, 'architecture-review.html'),
            path.join(fixturesDir, 'spider-chart.png'),
            path.join(fixturesDir, 'platform-architecture.png'),
          ]);
          await page.waitForTimeout(2000);

          // "Notice the upload panel shows the HTML file plus 2 images.
          //  The platform will upload all files under the same report ID
          //  so relative image references resolve correctly."
          await page.waitForTimeout(1500);
        }
      }

      // Wait for upload to complete (progress bar)
      await page.waitForTimeout(3000);
    });

    // "The report is uploaded. Let's preview it exactly as the customer will
    //  see it — rendered inside the secure iframe viewer. The content is
    //  served via CloudFront with signed cookies, so this URL cannot be
    //  shared or accessed outside the portal session."

    await test.step('Scene 5: Preview the report in the secure iframe viewer', async () => {
      const reportCard = page.locator(selectors.spaceDetail.reportCard).first();
      const isReportVisible = await reportCard.isVisible().catch(() => false);

      if (isReportVisible) {
        await reportCard.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Let the iframe content render fully
        const iframe = page.locator(selectors.reportViewer.iframe).first();
        if (await iframe.isVisible().catch(() => false)) {
          await page.waitForTimeout(2500);
        }

        // Go back to the space detail
        await page.goBack();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
      }
    });

    // "The report is ready for the customer. Now we invite them. We type
    //  their email address, and Cognito handles the invitation — the customer
    //  receives a temporary password and is guided through MFA setup on
    //  first login. For this demo, we'll cancel without sending."

    await test.step('Scene 6: Invite a customer to the space', async () => {
      const inviteButton = page.locator(selectors.spaceDetail.inviteButton).first();
      const isInviteVisible = await inviteButton.isVisible().catch(() => false);

      if (isInviteVisible) {
        await inviteButton.click();
        await page.waitForTimeout(1500);

        // Type the customer email slowly for the viewer
        const emailInput = page.locator(selectors.inviteUser.emailInput).first();
        if (await emailInput.isVisible().catch(() => false)) {
          await emailInput.click();
          await page.waitForTimeout(500);
          await emailInput.fill('sarah.chen@acmecorp.com');
          await page.waitForTimeout(2000);
        }

        // Pause on the filled dialog so the viewer understands the workflow
        await page.waitForTimeout(1000);

        // Cancel — this is a demo, not a live invitation
        const cancelButton = page.locator(selectors.inviteUser.cancelButton).first();
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1500);
      }
    });

    // "And there it is — the new Acme Corp space in our portfolio. From
    //  creation to report delivery to customer invitation, the entire
    //  workflow took under two minutes. No infrastructure tickets,
    //  no manual S3 bucket policies, no shared credentials."

    await test.step('Scene 7: Return to Spaces — the portfolio view', async () => {
      const spacesLink = page.locator(selectors.nav.spacesLink).first();
      await spacesLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the new space to highlight it
      const searchInput = page.locator(selectors.spaceList.searchInput).first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.click();
        await searchInput.fill('Acme');
        await page.waitForTimeout(2000);
      }

      // Hover over the new space card — the final proof
      const newSpace = page.locator(selectors.spaceList.spaceCard).filter({
        hasText: testSpaceName,
      }).first();
      if (await newSpace.isVisible().catch(() => false)) {
        await newSpace.hover();
        await page.waitForTimeout(2000);
      }

      await page.waitForTimeout(1500);
    });
  });
});
