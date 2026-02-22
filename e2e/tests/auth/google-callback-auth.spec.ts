import { test, expect } from '@playwright/test';
import { BasePage } from '../../pages/base.page';

const CALLBACK_URL = '/auth/callback/google';

test.describe('Auth — Google OAuth callback', () => {
  test('error=OAUTH_CANCELLED shows authentication failed heading', async ({ page }) => {
    const base = new BasePage(page);
    await base.goto(`${CALLBACK_URL}?error=OAUTH_CANCELLED`);

    await expect(
      page.getByRole('heading', { name: /authentication failed|помилка автентифікації/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('error=OAUTH_STATE_INVALID shows authentication failed heading', async ({ page }) => {
    const base = new BasePage(page);
    await base.goto(`${CALLBACK_URL}?error=OAUTH_STATE_INVALID`);

    await expect(
      page.getByRole('heading', { name: /authentication failed|помилка автентифікації/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('no code or error shows expired/error state', async ({ page }) => {
    const base = new BasePage(page);
    await base.goto(CALLBACK_URL);

    await expect(
      page.getByRole('heading', { name: /authentication failed|помилка автентифікації/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('error state shows try again button', async ({ page }) => {
    const base = new BasePage(page);
    await base.goto(`${CALLBACK_URL}?error=OAUTH_CANCELLED`);

    await expect(
      page.getByRole('button', { name: /try again|спробувати ще/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('try again navigates to home page', async ({ page }) => {
    const base = new BasePage(page);
    await base.goto(`${CALLBACK_URL}?error=OAUTH_CANCELLED`);

    await page.getByRole('button', { name: /try again|спробувати ще/i }).click();

    await page.waitForURL('**/', { timeout: 5_000 });
    expect(page.url()).toMatch(/\/$/);
  });
});
