import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { getPrivacyTab, getSecurityTab } from '../helpers/i18n.helpers';

export class SettingsPage extends BasePage {
  readonly privacyTab: Locator;
  readonly securityTab: Locator;
  readonly autoSubscribeToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.privacyTab = getPrivacyTab(page);
    this.securityTab = getSecurityTab(page);
    this.autoSubscribeToggle = page.locator('#autoSubscribeOnWatch');
  }

  async navigate() {
    await this.goto('/settings');
  }

  // ─── Privacy ─────────────────────────────────────────────────────────────

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

  // ─── Security ────────────────────────────────────────────────────────────

  async goToSecurityTab() {
    await this.securityTab.click();
    await this.page.waitForTimeout(300);
  }

  async fillChangePasswordForm(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    await this.page.locator('#currentPassword').fill(data.currentPassword);
    await this.page.locator('#newPassword').fill(data.newPassword);
    await this.page.locator('#confirmPassword').fill(data.confirmPassword);
  }

  async submitChangePassword() {
    await this.page
      .getByRole('button', { name: /change password|змінити пароль/i })
      .click();
  }
}
