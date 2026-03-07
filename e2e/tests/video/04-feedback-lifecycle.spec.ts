import { test, expect } from '../../fixtures/auth.fixture';
import { selectors } from '../../helpers/selectors';

/**
 * VIDEO 4: "Collaboration — Feedback Lifecycle"
 *
 * NARRATIVE:
 * Watch the complete feedback loop between admin and customer. An admin
 * opens the feedback inbox, reads a customer question, writes a detailed
 * reply with revenue breakdown data, and resolves the thread. This
 * demonstrates the built-in collaboration that eliminates the need for
 * separate email threads — every conversation stays attached to the
 * report, in context, with a full audit trail.
 *
 * AUDIENCE: Delivery managers, compliance officers, customer success leads
 * DURATION: ~75 seconds
 */
test.describe('Video 4: Collaboration — Feedback Lifecycle', () => {
  test('An admin reads customer feedback, replies with data, and resolves the thread', async ({
    superAdminPage: page,
  }) => {

    // "The feedback inbox is where collaboration happens. Unlike email,
    //  every thread here is tied to a specific report inside a specific
    //  customer space. There is no ambiguity about context, no forwarded
    //  chains, no 'which version are you looking at?' confusion."

    await test.step('Scene 1: Navigate to the feedback inbox', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Click the Feedback link in the sidebar
      const feedbackLink = page.locator(selectors.nav.feedbackLink).first();
      await feedbackLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Let the viewer see the inbox layout
      const inbox = page.locator(selectors.feedback.inboxContainer).first();
      await expect(inbox).toBeVisible().catch(() => false);
      await page.waitForTimeout(1500);
    });

    // "The inbox supports filtering by status. Let's focus on open threads —
    //  these are the conversations that need attention. Resolved threads
    //  are archived but always accessible for audit purposes."

    await test.step('Scene 2: Filter by status — show open threads', async () => {
      const statusFilter = page.locator(selectors.feedback.inboxStatusFilter).first();
      const isFilterVisible = await statusFilter.isVisible().catch(() => false);

      if (isFilterVisible) {
        await statusFilter.click();
        await page.waitForTimeout(1500);

        // Select "Open" to narrow down
        const openOption = page.locator('text=Open').first();
        if (await openOption.isVisible().catch(() => false)) {
          await openOption.click();
          await page.waitForTimeout(2000);
        }
      }

      // Also show the space filter to highlight multi-space capability
      const spaceFilter = page.locator(selectors.feedback.inboxSpaceFilter).first();
      if (await spaceFilter.isVisible().catch(() => false)) {
        await spaceFilter.hover();
        await page.waitForTimeout(1000);
      }

      // Hover over visible threads to show the queue
      const threads = page.locator(selectors.feedback.threadItem);
      const threadCount = await threads.count();
      for (let i = 0; i < Math.min(threadCount, 3); i++) {
        await threads.nth(i).hover();
        await page.waitForTimeout(700);
      }

      await page.waitForTimeout(1000);
    });

    // "Here's one from a customer asking about Q3 revenue figures. Let's
    //  open it. The thread shows the original message, the author, the
    //  timestamp, and the report it's attached to. Full context without
    //  switching windows."

    await test.step('Scene 3: Open a feedback thread — read the conversation', async () => {
      const threadItem = page.locator(selectors.feedback.threadItem).first();
      const isThreadVisible = await threadItem.isVisible().catch(() => false);

      if (isThreadVisible) {
        await threadItem.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Show the message list — the conversation history
        const messageList = page.locator(selectors.feedback.messageList).first();
        await expect(messageList).toBeVisible().catch(() => false);
        await page.waitForTimeout(1000);

        // Scroll through messages so the viewer can read them
        const messages = page.locator(selectors.feedback.messageItem);
        const messageCount = await messages.count();
        for (let i = 0; i < Math.min(messageCount, 5); i++) {
          await messages.nth(i).scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
        }

        await page.waitForTimeout(1000);
      }
    });

    // "The admin has the data ready. They compose a detailed reply with
    //  the revenue breakdown the customer requested — Product A at $52K,
    //  Product B at $48K, Product C at $42K. This reply becomes part of
    //  the permanent record, attached to the report forever."

    await test.step('Scene 4: Compose a detailed reply with revenue data', async () => {
      const replyInput = page.locator(selectors.feedback.replyInput).first();
      const isReplyVisible = await replyInput.isVisible().catch(() => false);

      if (isReplyVisible) {
        await replyInput.click();
        await page.waitForTimeout(1000);

        // Type a substantive, data-rich reply
        await replyInput.fill(
          'Great question, Sarah.\n\n' +
          'Here is the Q3 revenue breakdown by product line:\n\n' +
          '  Product A: $52K (+18% YoY) — driven by enterprise tier upgrades\n' +
          '  Product B: $48K (+12% YoY) — steady growth from existing accounts\n' +
          '  Product C: $42K (+15% YoY) — new market segment traction\n\n' +
          'The "moderate growth" label in the executive summary reflects our ' +
          'conservative forecasting methodology — the 15% aggregate is strong ' +
          'but within our expected range given the Q2 pipeline.\n\n' +
          'Happy to schedule a call before your board presentation if you need ' +
          'additional context on any of these figures.'
        );

        // Pause so the viewer can read the composed reply
        await page.waitForTimeout(2500);
      }
    });

    // "One click to send. The customer will see the reply immediately
    //  in their portal — no email delay, no spam filter risk, no
    //  attachment size limits."

    await test.step('Scene 5: Submit the reply', async () => {
      const replySubmit = page.locator(selectors.feedback.replySubmit).first();
      const isSubmitVisible = await replySubmit.isVisible().catch(() => false);

      if (isSubmitVisible) {
        await replySubmit.click();
        await page.waitForTimeout(2500);

        // Show the reply now appearing in the message list
        const messages = page.locator(selectors.feedback.messageItem);
        const lastMessage = messages.last();
        if (await lastMessage.isVisible().catch(() => false)) {
          await lastMessage.scrollIntoViewIfNeeded();
          await page.waitForTimeout(2000);
        }
      }
    });

    // "The question has been answered. The admin marks the thread as
    //  resolved. A green 'Resolved' badge appears, and the thread moves
    //  out of the active queue. But it never disappears — every
    //  conversation is preserved for compliance and audit purposes."

    await test.step('Scene 6: Resolve the thread — close the loop', async () => {
      const resolveButton = page.locator(selectors.feedback.resolveButton).first();
      const isResolveVisible = await resolveButton.isVisible().catch(() => false);

      if (isResolveVisible) {
        await resolveButton.click();
        await page.waitForTimeout(1500);

        // Confirm resolution if a dialog appears
        const confirmButton = page.locator(selectors.common.confirmYes).first();
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(1500);
        }

        // Show the resolved badge — the visual proof that the loop is closed
        const resolvedBadge = page.locator(selectors.feedback.resolvedBadge).first();
        await expect(resolvedBadge).toBeVisible().catch(() => false);
        await page.waitForTimeout(2500);
      }

      // Final pause — let the resolved state sink in
      await page.waitForTimeout(1500);
    });
  });
});
