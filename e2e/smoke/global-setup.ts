import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { protectionBypassHeaders, SMOKE_STORAGE_STATE } from './protection-bypass';

const VERCEL_LOGIN = /^https:\/\/vercel\.com\//;

async function openTarget(baseURL: string, bypassSecret: string | undefined): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      extraHTTPHeaders: bypassSecret ? protectionBypassHeaders(bypassSecret) : {},
    });
    const response = await context.request.get(baseURL);
    if (VERCEL_LOGIN.test(response.url())) {
      throw new Error(
        `${baseURL} is behind Vercel Deployment Protection: set a valid VERCEL_AUTOMATION_BYPASS_SECRET`,
      );
    }
    if (!response.ok()) {
      throw new Error(`${baseURL} answered HTTP ${response.status()}`);
    }
    await context.storageState({ path: SMOKE_STORAGE_STATE });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    throw new Error('Smoke tests need a base URL: set BASE_URL');
  }
  fs.mkdirSync(path.dirname(SMOKE_STORAGE_STATE), { recursive: true });
  await openTarget(baseURL, process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
}
