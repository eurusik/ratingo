import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/auth.page';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-data';

test.describe('Auth — Login flow', () => {
  test('sign-in button is visible for unauthenticated user', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await expect(auth.signInButton).toBeVisible();
  });

  test('clicking sign-in opens modal in login mode', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await expect(auth.dialog).toBeVisible();
    await expect(auth.loginTitle).toBeVisible();
  });

  test('successful login closes modal and hides sign-in button', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);
    await expect(auth.dialog).not.toBeVisible();
    await expect(auth.signInButton).not.toBeVisible();
  });

  test('successful login stores tokens in localStorage', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.login(TEST_EMAIL, TEST_PASSWORD);

    const accessToken = await page.evaluate(() =>
      localStorage.getItem('ratingo_access_token'),
    );
    expect(accessToken).toBeTruthy();

    const refreshToken = await page.evaluate(() =>
      localStorage.getItem('ratingo_refresh_token'),
    );
    expect(refreshToken).toBeTruthy();
  });

  test('invalid credentials show error alert', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.fillLoginForm(TEST_EMAIL, 'WrongPassword99');
    await auth.submit();

    await expect(auth.errorAlert).toBeVisible({ timeout: 5_000 });
    await expect(auth.dialog).toBeVisible(); // modal stays open
  });

  test('empty form shows field validation error', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.submit();

    await expect(auth.fieldErrors.first()).toBeVisible({ timeout: 3_000 });
  });

  test('short password shows validation error', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await auth.fillLoginForm('valid@example.com', '123');
    await auth.submit();

    await expect(auth.fieldErrors.first()).toBeVisible({ timeout: 3_000 });
  });

  test('can switch between login and register tabs', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.openLoginModal();
    await expect(auth.loginTitle).toBeVisible();

    await auth.switchToRegister();
    await expect(auth.registerTitle).toBeVisible();

    await auth.switchToLogin();
    await expect(auth.loginTitle).toBeVisible();
  });
});
