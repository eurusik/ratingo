const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3002',
  'http://localhost:3000',
  'https://new.ratingo.top',
  'https://ratingo.top',
];

export const VERCEL_PREVIEW_DEPLOYMENT_ORIGIN =
  /^https:\/\/ratingo-[a-z0-9]{9}-eurusik\.vercel\.app$/;

interface CorsOriginEnv {
  CORS_ORIGIN?: string;
  CORS_ALLOW_VERCEL_PREVIEWS?: string;
}

const explicitOrigins = (corsOrigin: string | undefined): string[] =>
  corsOrigin?.split(',').map((origin) => origin.trim()) ?? DEFAULT_CORS_ORIGINS;

export const resolveCorsOrigins = (env: CorsOriginEnv): (string | RegExp)[] => {
  const origins = explicitOrigins(env.CORS_ORIGIN);
  return env.CORS_ALLOW_VERCEL_PREVIEWS === 'true'
    ? [...origins, VERCEL_PREVIEW_DEPLOYMENT_ORIGIN]
    : origins;
};
