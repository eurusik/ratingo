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
}));
