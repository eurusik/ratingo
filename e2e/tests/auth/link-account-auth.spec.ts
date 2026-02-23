import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/auth.page';
import { SettingsPage } from '../../pages/settings.page';
import { getSecurityTab } from '../../helpers/i18n.helpers';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-data';

test.describe('Auth — OAuth account link/unlink callbacks', () => {
  test('should show success toast when ?linked=google is in URL', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.goto('/settings?linked=google');

    // Security tab should be auto-selected
    const securityTab = getSecurityTab(page);
    await expect(securityTab).toHaveAttribute('data-state', 'active', { timeout: 5_000 });

    // Sonner toast should appear with provider name
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /successfully connected google|google успішно підключено/i,
    });
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });

  test('should show error toast when ?linkError=ALREADY_LINKED is in URL', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.goto('/settings?linkError=ALREADY_LINKED&provider=google');

    // Security tab should be auto-selected
    const securityTab = getSecurityTab(page);
    await expect(securityTab).toHaveAttribute('data-state', 'active', { timeout: 5_000 });

    // Sonner error toast should appear
    const toast = page.locator('[data-sonner-toast][data-type="error"]').filter({
      hasText: /failed to connect|не вдалося підключити/i,
    });
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });

  test('should clean URL params after showing notification', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.goto('/settings?linked=google');

    // Wait for URL to be cleaned
    await page.waitForURL('**/settings', { timeout: 5_000 });
    expect(page.url()).toMatch(/\/settings$/);
  });

  test('should show connected accounts section in security tab', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.goToSecurityTab();

    // "Connected Accounts" heading should be visible
    await expect(
      page.getByRole('heading', { name: /connected accounts|підключені акаунти/i }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
