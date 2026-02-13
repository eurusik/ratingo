import type { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  getHeading(): Locator {
    return this.page.locator('h1');
  }

  async getBodyText(): Promise<string> {
    return (await this.page.textContent('body')) ?? '';
  }
}
