import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/auth.page';
import { TEST_EMAIL } from '../../fixtures/test-data';

const UNIQUE_EMAIL = () => `e2e+${Date.now()}@ratingo.test`;
const UNIQUE_USERNAME = () => `e2euser${Date.now()}`;
const VALID_PASSWORD = 'TestPass99';

test.describe('Auth — Register flow', () => {
  test('switching to register shows register title', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.switchToRegister();
    await expect(auth.registerTitle).toBeVisible();
  });

  test('successful registration closes modal and stores tokens', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.switchToRegister();

    await auth.fillRegisterForm({
      email: UNIQUE_EMAIL(),
      username: UNIQUE_USERNAME(),
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    await auth.submit();

    await expect(auth.dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(auth.signInButton).not.toBeVisible();

    const accessToken = await page.evaluate(() =>
      localStorage.getItem('ratingo_access_token'),
    );
    expect(accessToken).toBeTruthy();
  });

  test('empty fields show validation errors', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.switchToRegister();
    await auth.submit();

    await expect(auth.fieldErrors.first()).toBeVisible({ timeout: 3_000 });
  });

  test('password mismatch shows validation error', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.switchToRegister();

    await auth.fillRegisterForm({
      email: UNIQUE_EMAIL(),
      username: UNIQUE_USERNAME(),
      password: VALID_PASSWORD,
      confirmPassword: 'DifferentPass99',
    });
    await auth.submit();

    await expect(auth.fieldErrors.first()).toBeVisible({ timeout: 3_000 });
  });

  test('existing email shows API error alert', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.switchToRegister();

    await auth.fillRegisterForm({
      email: TEST_EMAIL,
      username: UNIQUE_USERNAME(),
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    await auth.submit();

    await expect(auth.errorAlert).toBeVisible({ timeout: 5_000 });
    await expect(auth.dialog).toBeVisible(); // modal stays open
  });

  test('short username shows validation error', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.switchToRegister();

    await auth.fillRegisterForm({
      email: UNIQUE_EMAIL(),
      username: 'ab',
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    await auth.submit();

    await expect(auth.fieldErrors.first()).toBeVisible({ timeout: 3_000 });
  });
});
