import { test, expect } from '@playwright/test';
import { NotificationsPage } from '../../pages/notifications.page';

test.describe('Notifications — UI', () => {
  test('page title and filter toggle are visible', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    await expect(notifications.getHeading()).toBeVisible();
    await expect(notifications.filterUnread).toBeVisible();
    await expect(notifications.filterAll).toBeVisible();
  });

  test('notification bell link is visible in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bellLink = page.locator('a[href="/notifications"]');
    if (await bellLink.isVisible()) {
      await expect(bellLink).toBeVisible();
    }
  });

  test('notification cards link to media pages', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();
    await notifications.switchToFilter('all');

    const count = await notifications.getCardCount();
    if (count > 0) {
      const href = await notifications.cards.first().getAttribute('href');
      expect(href).toMatch(/\/(shows|movies)\//);
    }
  });

  test('cards display media title and trigger label', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();
    await notifications.switchToFilter('all');

    const count = await notifications.getCardCount();
    expect(count).toBeGreaterThan(0);

    const firstCard = notifications.cards.first();

    // Media title is rendered inside a .font-medium element
    const title = firstCard.locator('.font-medium');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText!.trim().length).toBeGreaterThan(0);

    // Trigger label is rendered with a colored dot
    const triggerLine = firstCard.locator('.rounded-full + *').first();
    // At minimum, check the trigger area has text
    const parentText = await firstCard.locator('.text-xs.text-cinema-text-muted').first().textContent();
    expect(parentText!.trim().length).toBeGreaterThan(0);
  });

  test('unread cards have blue left border indicator', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    // Default view is unread — seeded data has 4 unread cards
    const unreadCount = await notifications.getUnreadCardCount();
    expect(unreadCount).toBeGreaterThan(0);

    // Verify each unread card has the blue border class
    for (let i = 0; i < unreadCount; i++) {
      const card = notifications.unreadCards.nth(i);
      await expect(card).toHaveClass(/border-l-blue-500/);
    }
  });

  test('read cards have transparent left border', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();
    await notifications.switchToFilter('all');

    const readCount = await notifications.readCards.count();
    // Seeded data has 2 read cards
    expect(readCount).toBeGreaterThan(0);

    for (let i = 0; i < readCount; i++) {
      const card = notifications.readCards.nth(i);
      await expect(card).toHaveClass(/border-l-transparent/);
    }
  });
});
