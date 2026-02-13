import { test, expect } from '@playwright/test';
import { NotificationsPage } from '../../pages/notifications.page';

test.describe('Notifications — Filters', () => {
  test('filter toggle switches between unread and all', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    await notifications.switchToFilter('all');
    expect(page.url()).toContain('/notifications');

    await notifications.switchToFilter('unread');
    expect(page.url()).toContain('/notifications');
  });

  test('empty state shows when no notifications match filter', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    // On unread or all — should see either cards or empty state
    const count = await notifications.getCardCount();
    if (count === 0) {
      expect(await notifications.hasEmptyState()).toBe(true);
    }
  });

  test('unread filter shows only unread cards', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    // Default view is "unread"
    const unreadCount = await notifications.getCardCount();
    expect(unreadCount).toBeGreaterThan(0);

    // All visible cards should be unread (blue border)
    const blueCount = await notifications.getUnreadCardCount();
    expect(blueCount).toBe(unreadCount);
  });

  test('all filter shows more cards than unread', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    const unreadCount = await notifications.getCardCount();

    await notifications.switchToFilter('all');
    const allCount = await notifications.getCardCount();

    // Seeded data: 4 unread + 2 read = 6 total
    expect(allCount).toBeGreaterThanOrEqual(unreadCount);
    expect(allCount).toBeGreaterThan(unreadCount);
  });

  test('mark all as read removes unread indicators', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    // Verify we have unread cards and the button is visible
    const unreadBefore = await notifications.getUnreadCardCount();
    expect(unreadBefore).toBeGreaterThan(0);
    await expect(notifications.markAllReadButton).toBeVisible();

    // Click mark all as read
    await notifications.markAllAsRead();

    // Optimistic update: unread view should now show empty state
    // (because all cards were marked as read client-side)
    await expect(notifications.getToast()).toBeVisible({ timeout: 3000 });

    // Switch to "all" to see cards are now read
    await notifications.switchToFilter('all');
    await page.waitForTimeout(500);

    const unreadAfter = await notifications.unreadCards.count();
    expect(unreadAfter).toBe(0);

    // Undo before the 5s timeout to restore state for other tests
    const undoButton = notifications.getUndoButton();
    if (await undoButton.isVisible()) {
      await undoButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('undo restores unread state after mark all as read', async ({ page }) => {
    const notifications = new NotificationsPage(page);
    await notifications.navigate();

    const unreadBefore = await notifications.getUnreadCardCount();
    expect(unreadBefore).toBeGreaterThan(0);

    // Mark all as read
    await notifications.markAllAsRead();
    await expect(notifications.getToast()).toBeVisible({ timeout: 3000 });

    // Click undo
    const undoButton = notifications.getUndoButton();
    await expect(undoButton).toBeVisible({ timeout: 3000 });
    await undoButton.click();
    await page.waitForTimeout(500);

    // Unread cards should be restored
    const unreadAfter = await notifications.getUnreadCardCount();
    expect(unreadAfter).toBe(unreadBefore);
  });
});
