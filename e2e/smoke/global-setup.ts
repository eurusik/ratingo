import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { SMOKE_STORAGE_STATE } from './storage-state';

async function openTarget(baseURL: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const response = await context.request.get(baseURL);
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
  await openTarget(baseURL);
}
