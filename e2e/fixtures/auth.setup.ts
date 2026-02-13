/**
 * Auth setup project — logs in once and saves storageState.
 * All authenticated tests reuse the saved state.
 */
import { test as setup, expect } from '@playwright/test';
import { API_URL, TEST_EMAIL, TEST_PASSWORD, AUTH_FILE } from './test-data';

setup('authenticate test user', async ({ page, request }) => {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const { accessToken, refreshToken } = body.data;

  // Inject tokens into localStorage
  await page.goto('/');
  await page.evaluate(
    (tokens) => {
      localStorage.setItem('ratingo_access_token', tokens.accessToken);
      localStorage.setItem('ratingo_refresh_token', tokens.refreshToken);
    },
    { accessToken, refreshToken },
  );

  await page.context().storageState({ path: AUTH_FILE });
});
