/**
 * Language-resilient selector helpers.
 * All locators match both Ukrainian and English UI text.
 */
import type { Page, Locator } from '@playwright/test';

export function getFilterToggle(page: Page, filter: 'unread' | 'all'): Locator {
  const pattern =
    filter === 'unread' ? /unread|непрочитані/i : /^all$|^усі$|^всі$/i;
  return page.getByRole('radio', { name: pattern });
}

export function getPrivacyTab(page: Page): Locator {
  return page.getByRole('tab', { name: /privacy|приватність/i });
}

export function getAutoSubscribeLabel(page: Page): Locator {
  return page.locator('text=/auto.*subscri|автопідпис/i');
}

export function getMarkAllReadButton(page: Page): Locator {
  return page.getByRole('button', { name: /mark all|прочитати/i });
}
