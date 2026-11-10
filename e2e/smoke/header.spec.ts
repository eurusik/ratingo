import { expect, test } from './fixtures';

const GOOGLE_OAUTH = /^https:\/\/accounts\.google\.com\//;

test('search dialog returns results from the API', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /знайти фільм або серіал|find a movie or show/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').fill('Дюна');

  await expect(dialog.getByRole('option').first()).toBeVisible();
});

test('sign-in dialog starts the Google OAuth redirect', async ({ page }) => {
  await page.route(GOOGLE_OAUTH, (route) => route.abort());
  await page.goto('/');

  await page.getByRole('button', { name: /^увійти$|^sign in$/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: /email/i })).toBeVisible();

  const oauthRedirect = page.waitForRequest(GOOGLE_OAUTH);
  await dialog.getByRole('button', { name: /google/i }).click();
  await oauthRedirect;
});
