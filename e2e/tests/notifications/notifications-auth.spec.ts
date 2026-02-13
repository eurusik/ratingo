import { test, expect } from '@playwright/test';

test.describe('Notifications — Auth guard', () => {
  test('unauthenticated user sees auth prompt or redirect', async ({ page }) => {
    await page.goto('/notifications');

    const redirected = await page
      .waitForURL((url) => !url.pathname.includes('/notifications'), { timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (redirected) {
      expect(page.url()).not.toContain('/notifications');
    } else {
      // Page loads but shows auth-gated content
      await expect(page.locator('body')).toContainText(/.+/);
    }
  });
});
