const LOCAL_API_ORIGIN = 'http://localhost:3001';
const TRAILING_SLASHES = /\/+$/;

function withoutTrailingSlashes(url: string): string {
  return url.replace(TRAILING_SLASHES, '');
}

const API_ORIGIN = withoutTrailingSlashes(process.env.NEXT_PUBLIC_API_URL || LOCAL_API_ORIGIN);

export const API_BASE_URL = `${API_ORIGIN}/api`;

const LEGACY_ADMIN_URL = 'https://ratingo.top/admin';

export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || LEGACY_ADMIN_URL;

const PRODUCTION_HOST = 'ratingo.top';

export const SITE_URL = withoutTrailingSlashes(
  process.env.NEXT_PUBLIC_APP_URL?.trim() || `https://${PRODUCTION_HOST}`,
);

export const IS_PRODUCTION_SITE =
  process.env.VERCEL_ENV === 'production' &&
  process.env.VERCEL_PROJECT_PRODUCTION_URL === PRODUCTION_HOST;

const DEFAULT_GA_MEASUREMENT_ID = 'G-MPY73Y7DBB';

export const GA_MEASUREMENT_ID = IS_PRODUCTION_SITE
  ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID
  : null;

export const SERVICE_WORKER_ENABLED = process.env.NODE_ENV === 'production';

export function buildRevision(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomUUID();
}
