import { expect, test } from './fixtures';

const SHOW_LINK = 'main a[href^="/shows/"]';
const MOVIE_LINK = 'main a[href^="/movies/"]';
const PHONE = { width: 360, height: 780 };

test('home lists both shows and movies', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /тренд|trending/i }).first()).toBeVisible();
  await expect(page.locator(SHOW_LINK).first()).toBeVisible();
  await expect(page.locator(MOVIE_LINK).first()).toBeAttached();
});

test('home fits a 360px phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  await expect(page.locator(SHOW_LINK).first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
