import { expect, test } from './fixtures';

const MEDIA_LINK = 'a[href^="/movies/"], a[href^="/shows/"]';
const MOVIE_LINK = 'main a[href^="/movies/"]';

test('home page renders the hero and media rails', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expect(page.locator(MEDIA_LINK).first()).toBeVisible();
});

test('movie page renders its details and loads reviews from the API', async ({ page }) => {
  await page.goto('/browse/movies-trending');
  const href = await page.locator(MOVIE_LINK).first().getAttribute('href');
  expect(href, 'a movie link on the trending page').toBeTruthy();

  const reviewsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/reviews/media/'),
  );
  await page.goto(href!);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: /відгуки|reviews/i })).toBeVisible();
  expect((await reviewsResponse).ok()).toBe(true);
});

test('unknown route renders the 404 page', async ({ page }) => {
  const response = await page.goto('/smoke-test-missing-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /сторінку не знайдено|page not found/i })).toBeVisible();
});
