import { registerAs } from '@nestjs/config';

/**
 * Auth config.
 */
export default registerAs('auth', () => ({
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '30d',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  // OAuth exchange code pepper for HMAC-signing (separate from JWT secrets)
  exchangeCodePepper: process.env.OAUTH_EXCHANGE_CODE_PEPPER || 'dev-exchange-pepper',
  // Secret for HMAC-signing OAuth state cookies
  stateSecret: process.env.OAUTH_STATE_SECRET || 'dev-state-secret',
  // Frontend URL for OAuth redirects
  frontendUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002',
  // Cron pattern for OAuth exchange codes cleanup (default: daily at 3:00 AM UTC)
  exchangeCodeCleanupCron: process.env.OAUTH_EXCHANGE_CLEANUP_CRON || '0 3 * * *',
  // Whether running in production mode (used for secure cookies, etc.)
  isProduction: process.env.NODE_ENV === 'production',
}));
