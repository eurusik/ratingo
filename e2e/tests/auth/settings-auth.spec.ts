import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/auth.page';
import { SettingsPage } from '../../pages/settings.page';
import {
  getUserAvatarButton,
  getLogoutMenuItem,
  getSettingsLoginPrompt,
} from '../../helpers/i18n.helpers';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-data';

test.describe('Auth — Settings & logout', () => {
  test('unauthenticated settings page shows login prompt', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.navigate();

    await expect(getSettingsLoginPrompt(page)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tablist')).not.toBeVisible();
  });

  test('authenticated settings page shows tablist', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.navigate();

    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 5_000 });
  });

  test('wrong current password shows error on change password', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.goToSecurityTab();

    await settings.fillChangePasswordForm({
      currentPassword: 'WrongCurrentPass99',
      newPassword: 'NewSecurePass99',
      confirmPassword: 'NewSecurePass99',
    });
    await settings.submitChangePassword();

    // Expect error message (inline or alert)
    const errorVisible = await page
      .locator('[role="alert"], .text-red-400, .text-destructive')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('short new password shows validation error', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.goToSecurityTab();

    await settings.fillChangePasswordForm({
      currentPassword: TEST_PASSWORD,
      newPassword: '123',
      confirmPassword: '123',
    });
    await settings.submitChangePassword();

    const errorVisible = await page
      .locator('.text-red-400, .text-destructive, .text-xs.text-red-400')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('logout clears tokens and shows sign-in button', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    // Verify authenticated
    await expect(auth.signInButton).not.toBeVisible();

    // Open avatar dropdown and click logout
    const avatar = getUserAvatarButton(page);
    await avatar.click();
    const logoutItem = getLogoutMenuItem(page);
    await logoutItem.click();

    // After logout
    await expect(auth.signInButton).toBeVisible({ timeout: 5_000 });

    const accessToken = await page.evaluate(() =>
      localStorage.getItem('ratingo_access_token'),
    );
    expect(accessToken).toBeNull();

    const refreshToken = await page.evaluate(() =>
      localStorage.getItem('ratingo_refresh_token'),
    );
    expect(refreshToken).toBeNull();
  });

});
