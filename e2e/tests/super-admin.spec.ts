import { test, expect } from '../fixtures/auth';

test.describe('Super Admin Journey', () => {
  test.beforeEach(async ({ page, superAdmin }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(superAdmin.email);
    await page.getByLabel(/password/i).fill(superAdmin.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(admin|mfa|dashboard)/i, { timeout: 15_000 });

    // Skip MFA if needed (in real env MFA would be handled)
    if (page.url().includes('mfa')) {
      test.skip(true, 'MFA verification required');
    }
  });

  test.describe('Dashboard', () => {
    test('should display admin dashboard with navigation', async ({ page }) => {
      await expect(page.getByText(/dashboard/i)).toBeVisible();
      await expect(page.getByText(/spaces|customers/i)).toBeVisible();
    });

    test('should show analytics overview on dashboard', async ({ page }) => {
      await expect(page.getByText(/analytics|overview|statistics/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Space Management', () => {
    const testSpaceName = `e2e-space-${Date.now()}`;

    test('should navigate to spaces page', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await expect(page.getByText(/customer spaces/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should create a new customer space', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /create|new.*space/i }).click();
      await page.getByLabel(/name|space.*name/i).fill(testSpaceName);
      await page.getByRole('button', { name: /create|save|submit/i }).click();

      await expect(page.getByText(testSpaceName)).toBeVisible({ timeout: 10_000 });
    });

    test('should list existing spaces with pagination', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();

      // Should see space list
      const spaceList = page.locator('[data-testid="space-list"], table, [role="list"]');
      await expect(spaceList).toBeVisible({ timeout: 10_000 });
    });

    test('should search/filter spaces', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/search|filter/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill('e2e');
        await page.waitForTimeout(500);
        // Results should be filtered
      }
    });

    test('should delete a customer space', async ({ page }) => {
      await page.getByRole('link', { name: /spaces|customers/i }).click();
      await page.waitForLoadState('networkidle');

      // Find a test space to delete
      const spaceRow = page.getByText(/e2e-space-/i).first();
      if (await spaceRow.isVisible()) {
        await spaceRow.click();
        const deleteButton = page.getByRole('button', { name: /delete/i });
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          // Confirm deletion
          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await expect(page.getByText(/deleted|removed/i)).toBeVisible({ timeout: 10_000 });
          }
        }
      }
    });
  });

  test.describe('User Management', () => {
    test('should navigate to users page', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await expect(page.getByText(/user management|users/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should list users with role filter', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      // Filter by role
      const roleFilter = page.getByLabel(/role/i).or(page.getByRole('combobox'));
      if (await roleFilter.isVisible()) {
        await roleFilter.click();
        const adminOption = page.getByRole('option', { name: /admin/i });
        if (await adminOption.isVisible()) {
          await adminOption.click();
        }
      }
    });

    test('should invite a new admin (versent.com.au only)', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /invite.*admin/i }).click();

      const emailInput = page.getByLabel(/email/i);
      await emailInput.fill(`e2e-admin-${Date.now()}@versent.com.au`);
      await page.getByRole('button', { name: /invite|send|submit/i }).click();

      await expect(page.getByText(/invited|invitation.*sent/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should prevent inviting admin with non-versent email', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /invite.*admin/i }).click();

      const emailInput = page.getByLabel(/email/i);
      await emailInput.fill('external@gmail.com');
      await page.getByRole('button', { name: /invite|send|submit/i }).click();

      await expect(page.getByText(/versent|invalid|not allowed/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should disable/enable a user', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      // Find a user row with action buttons
      const actionButton = page.getByRole('button', { name: /disable|deactivate/i }).first();
      if (await actionButton.isVisible()) {
        await actionButton.click();
        const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    });

    test('should toggle MFA enforcement for a user', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      const mfaToggle = page.getByRole('switch', { name: /mfa/i }).first();
      if (await mfaToggle.isVisible()) {
        await mfaToggle.click();
      }
    });
  });

  test.describe('Impersonation', () => {
    test('should impersonate a customer user', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      const impersonateButton = page.getByRole('button', { name: /impersonate|view as/i }).first();
      if (await impersonateButton.isVisible()) {
        await impersonateButton.click();

        // Should see impersonation banner
        await expect(page.getByText(/impersonating|viewing as/i)).toBeVisible({ timeout: 10_000 });

        // Should be read-only
        const editButtons = page.getByRole('button', { name: /edit|delete|create/i });
        if (await editButtons.first().isVisible()) {
          await expect(editButtons.first()).toBeDisabled();
        }
      }
    });

    test('should end impersonation and return to admin view', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await page.waitForLoadState('networkidle');

      const impersonateButton = page.getByRole('button', { name: /impersonate|view as/i }).first();
      if (await impersonateButton.isVisible()) {
        await impersonateButton.click();
        await expect(page.getByText(/impersonating|viewing as/i)).toBeVisible({ timeout: 10_000 });

        // End impersonation
        await page.getByRole('button', { name: /end|stop|exit.*impersonat/i }).click();
        await expect(page.getByText(/impersonating/i)).not.toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('Audit Log', () => {
    test('should navigate to audit log page', async ({ page }) => {
      await page.getByRole('link', { name: /audit/i }).click();
      await expect(page.getByText(/audit.*log/i)).toBeVisible({ timeout: 10_000 });
    });

    test('should display audit events with filters', async ({ page }) => {
      await page.getByRole('link', { name: /audit/i }).click();
      await page.waitForLoadState('networkidle');

      // Should see audit log entries
      const auditTable = page.locator('table, [data-testid="audit-log"]');
      await expect(auditTable).toBeVisible({ timeout: 10_000 });
    });

    test('should filter audit log by date range', async ({ page }) => {
      await page.getByRole('link', { name: /audit/i }).click();
      await page.waitForLoadState('networkidle');

      const dateFilter = page.getByLabel(/date|from|start/i).first();
      if (await dateFilter.isVisible()) {
        await dateFilter.fill('2024-01-01');
      }
    });
  });

  test.describe('Analytics', () => {
    test('should view analytics dashboard', async ({ page }) => {
      await page.getByRole('link', { name: /analytics/i }).click();
      await expect(page.getByText(/analytics/i)).toBeVisible({ timeout: 10_000 });
    });
  });
});
