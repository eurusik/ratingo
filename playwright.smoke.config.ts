import { defineConfig, devices } from '@playwright/test';

import { SMOKE_STORAGE_STATE } from './e2e/smoke/protection-bypass';

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e/smoke',
  outputDir: './e2e/test-results/smoke',
  globalSetup: './e2e/smoke/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: isCi ? 1 : 0,
  workers: isCi ? 4 : undefined,
  reporter: isCi
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report/smoke' }]]
    : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.BASE_URL ?? 'http://localhost:3002',
    locale: 'uk-UA',
    storageState: SMOKE_STORAGE_STATE,
    screenshot: 'only-on-failure',
    trace: isCi ? 'off' : 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
});
