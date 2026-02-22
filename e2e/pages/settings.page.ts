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
      await this.autoSubscribeToggle.waitFor({ state: 'visible', timeout: 5_000 });
    }
  }

  async toggleAutoSubscribe() {
    const currentState = await this.autoSubscribeToggle.getAttribute('aria-checked');
    await this.autoSubscribeToggle.click();
    // Wait for the toggle state to actually change
    const expectedState = currentState === 'true' ? 'false' : 'true';
    await this.page.waitForFunction(
      ({ id, expected }) => document.getElementById(id)?.getAttribute('aria-checked') === expected,
      { id: 'autoSubscribeOnWatch', expected: expectedState },
      { timeout: 5_000 },
    );
  }

  async getAutoSubscribeState(): Promise<string | null> {
    return this.autoSubscribeToggle.getAttribute('aria-checked');
  }

  // ─── Security ────────────────────────────────────────────────────────────

  async goToSecurityTab() {
    await this.securityTab.click();
    await this.page.locator('#currentPassword').waitFor({ state: 'visible', timeout: 5_000 });
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
