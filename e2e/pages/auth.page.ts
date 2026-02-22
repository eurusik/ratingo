import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import {
  getSignInButton,
  getAuthDialog,
} from '../helpers/i18n.helpers';

export class AuthPage extends BasePage {
  readonly signInButton: Locator;
  readonly dialog: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.signInButton = getSignInButton(page);
    this.dialog = getAuthDialog(page);
    this.errorAlert = this.dialog.locator('[role="alert"]');
  }

  async navigate() {
    await this.goto('/');
  }

  // ─── Dialog title / mode ─────────────────────────────────────────────────

  /** Heading element — disambiguates from submit button with same text. */
  get loginTitle(): Locator {
    return this.dialog.getByRole('heading', { name: /sign in|вхід/i });
  }

  get registerTitle(): Locator {
    return this.dialog.getByRole('heading', { name: /sign up|реєстрація/i });
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  async openLoginModal() {
    await this.signInButton.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  async fillLoginForm(email: string, password: string) {
    await this.dialog.locator('#email').fill(email);
    await this.dialog.locator('#password').fill(password);
  }

  async fillRegisterForm(data: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
  }) {
    await this.dialog.locator('#email').fill(data.email);
    await this.dialog.locator('#username').fill(data.username);
    await this.dialog.locator('#password').fill(data.password);
    await this.dialog.locator('#confirmPassword').fill(data.confirmPassword);
  }

  /** Click the submit button (type="submit") — safe from matching switch links. */
  async submit() {
    await this.dialog.locator('button[type="submit"]').click();
  }

  async switchToRegister() {
    // Inline <button type="button"> at bottom of login form
    await this.dialog
      .locator('button[type="button"]')
      .filter({ hasText: /^sign up$|^реєстрація$/i })
      .click();
    await this.registerTitle.waitFor({ state: 'visible' });
  }

  async switchToLogin() {
    // Inline <button type="button"> at bottom of register form
    await this.dialog
      .locator('button[type="button"]')
      .filter({ hasText: /^sign in$|^увійти$/i })
      .click();
    await this.loginTitle.waitFor({ state: 'visible' });
  }

  /** Full login flow: open modal → fill → submit → wait for close. */
  async login(email: string, password: string) {
    await this.openLoginModal();
    await this.fillLoginForm(email, password);
    await this.submit();
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  /** Returns field-level validation error elements inside the dialog. */
  get fieldErrors(): Locator {
    return this.dialog.locator('.text-xs.text-red-400');
  }
}
