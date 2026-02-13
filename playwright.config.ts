import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // 1. One-time auth setup
    {
      name: 'setup',
      testDir: './e2e/fixtures',
      testMatch: 'auth.setup.ts',
    },

    // 2. Tests that require authentication
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*-auth\.spec\.ts/,
    },

    // 3. Auth guard tests (no saved auth)
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*-auth\.spec\.ts/,
    },
  ],
});
