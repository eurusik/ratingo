import { OFFLINE_ROUTE, buildRevision } from '@/shared/config';

const UNPRECACHED_FILES = ['**/node_modules/**/*', 'public/screenshots/**'];

export const serviceWorkerRouteOptions = {
  swSrc: 'src/app/service-worker/sw.ts',
  additionalPrecacheEntries: [{ url: OFFLINE_ROUTE, revision: buildRevision() }],
  globIgnores: UNPRECACHED_FILES,
  useNativeEsbuild: true,
};
