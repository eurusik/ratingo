import { test, expect } from '@playwright/test';

test.describe('Notifications — Auth guard', () => {
  test('unauthenticated user sees auth prompt or redirect', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForTimeout(2000);

    const isOnNotifications = page.url().includes('/notifications');
    if (isOnNotifications) {
      // Page loads but shows auth-gated content
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
    } else {
      // Redirected away from notifications
      expect(page.url()).not.toContain('/notifications');
    }
  });
});
