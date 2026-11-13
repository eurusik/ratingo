import { buildRevision } from '@/shared/config';

const OFFLINE_FALLBACK_URL = '/~offline';

export const serviceWorkerRouteOptions = {
  swSrc: 'src/app/service-worker/sw.ts',
  additionalPrecacheEntries: [{ url: OFFLINE_FALLBACK_URL, revision: buildRevision() }],
  useNativeEsbuild: true,
};
