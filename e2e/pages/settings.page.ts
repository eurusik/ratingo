import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { getPrivacyTab } from '../helpers/i18n.helpers';

export class SettingsPage extends BasePage {
  readonly privacyTab: Locator;
  readonly autoSubscribeToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.privacyTab = getPrivacyTab(page);
    this.autoSubscribeToggle = page.locator('#autoSubscribeOnWatch');
  }

  async navigate() {
    await this.goto('/settings');
  }

  async goToPrivacyTab() {
    if (await this.privacyTab.isVisible()) {
      await this.privacyTab.click();
      await this.page.waitForTimeout(500);
    }
  }

  async toggleAutoSubscribe() {
    await this.autoSubscribeToggle.click();
    await this.page.waitForTimeout(1000);
  }

  async getAutoSubscribeState(): Promise<string | null> {
    return this.autoSubscribeToggle.getAttribute('aria-checked');
  }
}
