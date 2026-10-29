import { type AppRole } from '../common/runtime/app-role';

import { buildEnvSchema } from './env.schema';

const BASE_ENV = {
  DATABASE_URL: 'postgres://localhost:5432/ratingo',
  TMDB_API_KEY: 'tmdb',
  TRAKT_CLIENT_ID: 'trakt-id',
  TRAKT_CLIENT_SECRET: 'trakt-secret',
  OMDB_API_KEY: 'omdb',
};

const JWT_SECRETS = {
  ACCESS_TOKEN_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'r'.repeat(32),
};

const validate = (role: AppRole, env: Record<string, string>) =>
  buildEnvSchema(role).validate(env, { allowUnknown: true, abortEarly: true });

describe('buildEnvSchema', () => {
  it.each<AppRole>(['api', 'all'])('role "%s" requires the JWT secrets', (role) => {
    expect(validate(role, BASE_ENV).error?.message).toMatch(/ACCESS_TOKEN_SECRET/);
    expect(validate(role, { ...BASE_ENV, ...JWT_SECRETS }).error).toBeUndefined();
  });

  it.each<AppRole>(['api', 'all'])('role "%s" requires the OAuth secrets in production', (role) => {
    const { error } = validate(role, { ...BASE_ENV, ...JWT_SECRETS, NODE_ENV: 'production' });
    expect(error?.message).toMatch(/OAUTH_STATE_SECRET/);
  });

  it('role "api" applies the auth and throttle defaults', () => {
    const { value } = validate('api', { ...BASE_ENV, ...JWT_SECRETS });
    expect(value).toMatchObject({
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
      BCRYPT_SALT_ROUNDS: 12,
      THROTTLE_LIMIT: 600,
      PORT: 3001,
    });
  });

  it('role "worker" boots without JWT or OAuth secrets, even in production', () => {
    const { error, value } = validate('worker', { ...BASE_ENV, NODE_ENV: 'production' });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty('THROTTLE_LIMIT');
    expect(value).not.toHaveProperty('PORT');
  });

  it.each<AppRole>(['api', 'worker', 'all'])('role "%s" still requires DATABASE_URL', (role) => {
    const { DATABASE_URL: _omitted, ...env } = BASE_ENV;
    expect(validate(role, { ...env, ...JWT_SECRETS }).error?.message).toMatch(/DATABASE_URL/);
  });
});
