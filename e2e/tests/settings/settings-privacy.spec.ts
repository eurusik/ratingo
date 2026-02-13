import { test, expect } from '@playwright/test';
import { SettingsPage } from '../../pages/settings.page';

test.describe('Settings — Privacy', () => {
  test('autoSubscribeOnWatch toggle is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.goToPrivacyTab();

    await expect(settings.autoSubscribeToggle).toBeVisible();
  });

  test('autoSubscribeOnWatch toggle can be switched', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.goToPrivacyTab();

    await expect(settings.autoSubscribeToggle).toBeVisible();
    const initial = await settings.getAutoSubscribeState();

    await settings.toggleAutoSubscribe();
    const toggled = await settings.getAutoSubscribeState();
    expect(toggled).not.toBe(initial);

    // Restore
    await settings.toggleAutoSubscribe();
    const restored = await settings.getAutoSubscribeState();
    expect(restored).toBe(initial);
  });
});
