import { type AllowedOrigin } from '../common/utils/allowed-origin.util';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3002',
  'http://localhost:3000',
  'https://new.ratingo.top',
  'https://ratingo.top',
];

export const VERCEL_PREVIEW_DEPLOYMENT_ORIGIN =
  /^https:\/\/ratingo-(?:storefront-|admin-)?[a-z0-9]{9}-eurusik\.vercel\.app$/;

interface CorsOriginEnv {
  CORS_ORIGIN?: string;
  CORS_ALLOW_VERCEL_PREVIEWS?: string;
}

interface OAuthReturnOriginEnv {
  OAUTH_RETURN_ORIGINS?: string;
  OAUTH_ALLOW_VERCEL_PREVIEWS?: string;
}

const parseOriginList = (value: string | undefined): string[] | undefined =>
  value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const withVercelPreviews = (
  origins: string[],
  allowVercelPreviews: string | undefined,
): AllowedOrigin[] =>
  allowVercelPreviews === 'true' ? [...origins, VERCEL_PREVIEW_DEPLOYMENT_ORIGIN] : origins;

export const resolveCorsOrigins = (env: CorsOriginEnv): AllowedOrigin[] =>
  withVercelPreviews(
    parseOriginList(env.CORS_ORIGIN) ?? DEFAULT_CORS_ORIGINS,
    env.CORS_ALLOW_VERCEL_PREVIEWS,
  );

export const resolveOAuthReturnOrigins = (env: OAuthReturnOriginEnv): AllowedOrigin[] =>
  withVercelPreviews(
    parseOriginList(env.OAUTH_RETURN_ORIGINS) ?? [],
    env.OAUTH_ALLOW_VERCEL_PREVIEWS,
  );
