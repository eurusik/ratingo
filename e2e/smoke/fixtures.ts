import { test as base, expect, type Request } from '@playwright/test';

const API_RESOURCE_TYPES = new Set(['fetch', 'xhr']);
const IGNORED_HOSTS = /google-analytics\.com|googletagmanager\.com|accounts\.google\.com/;
const NAVIGATION_ABORT = 'net::ERR_ABORTED';

const isBrokenApiCall = (request: Request): boolean =>
  API_RESOURCE_TYPES.has(request.resourceType()) &&
  !IGNORED_HOSTS.test(request.url()) &&
  request.failure()?.errorText !== NAVIGATION_ABORT;

export const test = base.extend<{ failedApiCalls: string[] }>({
  failedApiCalls: [
    async ({ page }, use) => {
      const failed: string[] = [];
      page.on('requestfailed', (request) => {
        if (isBrokenApiCall(request)) {
          failed.push(`${request.method()} ${request.url()} → ${request.failure()?.errorText}`);
        }
      });
      await use(failed);
      expect(failed, 'browser API calls that failed (CORS or network)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
