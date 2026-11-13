/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, RouteMatchCallback, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { Serwist, CacheFirst, NetworkOnly, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_FALLBACK_URL = '/~offline';
const CORS_IMAGE_FETCH: RequestInit = { mode: 'cors', credentials: 'omit' };
const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const TMDB_IMAGE_URL = /^https:\/\/img\.ratingo\.top\/tmdb\/.*/i;
const TVMAZE_IMAGE_URL = /^https:\/\/(static\.tvmaze\.com|img\.ratingo\.top\/tvmaze)\/.*/i;
const ANALYTICS_URL =
  /^https:\/\/(.*\.(google-analytics|analytics\.google|googletagmanager)\.com|va\.vercel-scripts\.com)\/.*/i;
const API_PATH_PREFIX = '/api/';

const isCrossOriginApiRequest: RouteMatchCallback = ({ url, sameOrigin }) =>
  !sameOrigin && url.pathname.startsWith(API_PATH_PREFIX);

const isDocumentRequest = ({ request }: { request: Request }) => request.destination === 'document';

function imageCacheRoute(matcher: RegExp, cacheName: string, maxEntries: number): RuntimeCaching {
  return {
    matcher,
    handler: new CacheFirst({
      cacheName,
      fetchOptions: CORS_IMAGE_FETCH,
      plugins: [
        new ExpirationPlugin({ maxEntries, maxAgeSeconds: ONE_WEEK_IN_SECONDS, purgeOnQuotaError: true }),
      ],
    }),
  };
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    imageCacheRoute(TMDB_IMAGE_URL, 'tmdb-images', 200),
    imageCacheRoute(TVMAZE_IMAGE_URL, 'tvmaze-images', 100),
    { matcher: ANALYTICS_URL, handler: new NetworkOnly() },
    { matcher: isCrossOriginApiRequest, handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_FALLBACK_URL, matcher: isDocumentRequest }],
  },
});

serwist.addEventListeners();
