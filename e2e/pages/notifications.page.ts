import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { getFilterToggle, getMarkAllReadButton } from '../helpers/i18n.helpers';

export class NotificationsPage extends BasePage {
  readonly filterUnread: Locator;
  readonly filterAll: Locator;
  readonly markAllReadButton: Locator;
  readonly cards: Locator;
  readonly unreadCards: Locator;
  readonly readCards: Locator;

  constructor(page: Page) {
    super(page);
    this.filterUnread = getFilterToggle(page, 'unread');
    this.filterAll = getFilterToggle(page, 'all');
    this.markAllReadButton = getMarkAllReadButton(page);
    this.cards = page.locator(
      'a[href^="/shows/"], a[href^="/movies/"]',
    );
    this.unreadCards = page.locator(
      'a[href^="/shows/"].border-l-blue-500, a[href^="/movies/"].border-l-blue-500',
    );
    this.readCards = page.locator(
      'a[href^="/shows/"].border-l-transparent, a[href^="/movies/"].border-l-transparent',
    );
  }

  async navigate() {
    await this.goto('/notifications');
  }

  async switchToFilter(filter: 'unread' | 'all') {
    const toggle = filter === 'unread' ? this.filterUnread : this.filterAll;
    if (await toggle.isVisible()) {
      await toggle.click();
      await this.page.waitForTimeout(500);
    }
  }

  async markAllAsRead() {
    if (await this.markAllReadButton.isVisible()) {
      await this.markAllReadButton.click();
    }
  }

  async getCardCount(): Promise<number> {
    return this.cards.count();
  }

  async getUnreadCardCount(): Promise<number> {
    return this.unreadCards.count();
  }

  async hasEmptyState(): Promise<boolean> {
    const body = await this.getBodyText();
    return /немає|no |сповіщен|notification|caught/i.test(body);
  }

  getToast(): Locator {
    return this.page.locator('[data-sonner-toast]');
  }

  getUndoButton(): Locator {
    return this.page.locator('[data-sonner-toast] button', {
      hasText: /undo|скасувати/i,
    });
  }
}
