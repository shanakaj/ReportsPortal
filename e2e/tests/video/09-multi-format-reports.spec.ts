import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';
import path from 'path';

/**
 * VIDEO 9: "Multi-Format Reports — Upload, View, and Download"
 *
 * NARRATIVE:
 * This video demonstrates the portal's ability to handle multiple report formats.
 * An admin uploads an HTML report with accompanying images, a standalone PDF,
 * and views each format using the appropriate viewer. The video shows how the
 * portal adapts its UI — file type icons, inline viewers for HTML/PDF/images,
 * and download prompts for office documents.
 *
 * AUDIENCE: Product owners, delivery managers, customers evaluating the portal
 * DURATION: ~90 seconds
 */
test.describe('Video 9: Multi-Format Reports — Upload, View, and Download', () => {
  test('Admin uploads multi-format reports and views them appropriately', async ({
    superAdminPage: page,
  }) => {
    const fixturesDir = path.resolve(__dirname, '../../fixtures/reports');

    // =====================================================================
    // SCENE 1: Navigate to a space
    // "The admin opens a customer space to upload reports. The portal
    //  supports multiple formats — HTML with images, PDF, and more."
    // =====================================================================
    await test.step('Scene 1: Navigate to a space', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const spacesLink = page.locator(selectors.nav.spacesLink).first();
      if (await spacesLink.isVisible().catch(() => false)) {
        await spacesLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
      }

      const firstSpace = page.locator(selectors.spaceList.spaceCard).first();
      if (await firstSpace.isVisible().catch(() => false)) {
        await firstSpace.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
    });

    // =====================================================================
    // SCENE 2: Upload HTML report with image assets
    // "First, an HTML architecture review with two supporting diagrams.
    //  The admin selects all three files — the portal recognises the HTML
    //  as the main report and the PNGs as supporting assets."
    // =====================================================================
    await test.step('Scene 2: Upload HTML report with image assets', async () => {
      const uploadButton = page.locator(selectors.spaceDetail.uploadButton).first();
      const isUploadVisible = await uploadButton.isVisible().catch(() => false);

      if (isUploadVisible) {
        await uploadButton.click();
        await page.waitForTimeout(1000);

        const fileInput = page.locator(selectors.spaceDetail.uploadFileInput).first();
        const isFileInputPresent = await fileInput.count() > 0;

        if (isFileInputPresent) {
          // Upload HTML + images together
          await fileInput.setInputFiles([
            path.join(fixturesDir, 'architecture-review.html'),
            path.join(fixturesDir, 'spider-chart.png'),
            path.join(fixturesDir, 'platform-architecture.png'),
          ]);
          await page.waitForTimeout(3000);

          // Look for the upload/submit button and click it
          const submitButton = page.locator('button:has-text("Upload Report")').first();
          if (await submitButton.isVisible().catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(4000);
          }
        }

        await page.waitForTimeout(1500);
      }
    });

    // =====================================================================
    // SCENE 3: Upload a PDF report
    // "Next, a standalone PDF security assessment. The admin drags it
    //  into the upload area — no images needed for PDF reports."
    // =====================================================================
    await test.step('Scene 3: Upload a PDF report', async () => {
      const uploadButton = page.locator(selectors.spaceDetail.uploadButton).first();
      const isUploadVisible = await uploadButton.isVisible().catch(() => false);

      if (isUploadVisible) {
        await uploadButton.click();
        await page.waitForTimeout(1000);

        const fileInput = page.locator(selectors.spaceDetail.uploadFileInput).first();
        const isFileInputPresent = await fileInput.count() > 0;

        if (isFileInputPresent) {
          await fileInput.setInputFiles(
            path.join(fixturesDir, 'security-assessment.pdf'),
          );
          await page.waitForTimeout(2000);

          const submitButton = page.locator('button:has-text("Upload Report")').first();
          if (await submitButton.isVisible().catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(3000);
          }
        }

        await page.waitForTimeout(1500);
      }
    });

    // =====================================================================
    // SCENE 4: Review the report list — file type icons
    // "Back in the space view, each report shows a distinctive icon.
    //  HTML reports get the document icon, PDFs get the red file icon.
    //  Only the main report files appear — supporting images are hidden."
    // =====================================================================
    await test.step('Scene 4: Review report list with file type icons', async () => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const reportCards = page.locator(selectors.spaceDetail.reportCard);
      const reportCount = await reportCards.count();
      for (let i = 0; i < Math.min(reportCount, 5); i++) {
        await reportCards.nth(i).hover();
        await page.waitForTimeout(800);
      }
      await page.waitForTimeout(1500);
    });

    // =====================================================================
    // SCENE 5: View the HTML report in embedded viewer
    // "The admin clicks the eye icon to view the HTML report embedded.
    //  The architecture diagrams render correctly because the supporting
    //  images were uploaded alongside the HTML."
    // =====================================================================
    await test.step('Scene 5: View HTML report in embedded viewer', async () => {
      // Find the HTML report row and click view
      const viewButton = page.locator('button[title="View embedded"]').first();
      if (await viewButton.isVisible().catch(() => false)) {
        await viewButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Show the embedded report
        const iframe = page.locator('iframe').first();
        if (await iframe.isVisible().catch(() => false)) {
          await page.waitForTimeout(2000);
        }

        // Navigate back
        await page.goBack();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
      }
    });

    // =====================================================================
    // SCENE 6: Open PDF in new tab
    // "For the PDF report, the admin clicks the external link icon.
    //  The browser natively renders the PDF in a new tab — no plugins
    //  or third-party viewers required."
    // =====================================================================
    await test.step('Scene 6: Open PDF report', async () => {
      // Find a report row with PDF icon and click open
      const openButtons = page.locator('button[title="Open in new tab"]');
      const count = await openButtons.count();

      if (count > 0) {
        // Hover over the button to show intent
        await openButtons.first().hover();
        await page.waitForTimeout(1000);

        // We don't actually open a new tab in the video (would split focus)
        // Instead, show the action is available
        await page.waitForTimeout(1500);
      }
    });

    // =====================================================================
    // SCENE 7: Upload area shows format guidance
    // "The upload area clearly communicates supported formats: HTML, PDF,
    //  Word, Excel, and PowerPoint. HTML reports can include images for
    //  rich, diagram-heavy assessments."
    // =====================================================================
    await test.step('Scene 7: Show format guidance in upload area', async () => {
      const uploadButton = page.locator(selectors.spaceDetail.uploadButton).first();
      if (await uploadButton.isVisible().catch(() => false)) {
        await uploadButton.click();
        await page.waitForTimeout(2000);

        // The upload dropzone text should mention supported formats
        const dropzone = page.locator('text=HTML, PDF, Word, Excel, PowerPoint');
        if (await dropzone.isVisible().catch(() => false)) {
          await page.waitForTimeout(2000);
        }

        // Close by pressing Escape or clicking away
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }

      // "The portal handles every format a consulting engagement might produce —
      //  from rich HTML assessments with embedded diagrams, to PDF executive
      //  summaries, to spreadsheets and slide decks. Each format gets the
      //  right viewer or a clean download experience."
    });
  });
});
