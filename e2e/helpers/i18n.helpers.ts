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

// ─── Auth ──────────────────────────────────────────────────────────────────────

export function getSignInButton(page: Page): Locator {
  return page.getByRole('button', { name: /^sign in$|^увійти$/i });
}

export function getAuthDialog(page: Page): Locator {
  return page.getByRole('dialog');
}

export function getLogoutMenuItem(page: Page): Locator {
  return page.getByRole('menuitem', { name: /sign out|вийти/i });
}

export function getUserAvatarButton(page: Page): Locator {
  // Avatar uses DropdownMenu (aria-haspopup="menu"), not the notifications popover
  return page.locator('header button.rounded-full[aria-haspopup="menu"]');
}

export function getSettingsLoginPrompt(page: Page): Locator {
  return page.getByText(/sign in to save|увійдіть щоб зберігати/i);
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export function getSecurityTab(page: Page): Locator {
  return page.getByRole('tab', { name: /security|безпека/i });
}
