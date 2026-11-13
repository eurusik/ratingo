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

  it('accepts only "true" or "false" for CORS_ALLOW_VERCEL_PREVIEWS', () => {
    const env = { ...BASE_ENV, ...JWT_SECRETS };
    expect(validate('api', { ...env, CORS_ALLOW_VERCEL_PREVIEWS: 'true' }).error).toBeUndefined();
    expect(validate('api', { ...env, CORS_ALLOW_VERCEL_PREVIEWS: 'yes' }).error?.message).toMatch(
      /CORS_ALLOW_VERCEL_PREVIEWS/,
    );
  });

  it('accepts OAUTH_RETURN_ORIGINS only as a comma-separated list of origins', () => {
    const env = { ...BASE_ENV, ...JWT_SECRETS };
    const withOrigins = (value: string) => validate('api', { ...env, OAUTH_RETURN_ORIGINS: value });

    expect(withOrigins('https://dev.ratingo.top').error).toBeUndefined();
    expect(
      withOrigins('https://dev.ratingo.top, http://localhost:3002,https://admin.ratingo.top').error,
    ).toBeUndefined();
    [
      'dev.ratingo.top',
      'https://dev.ratingo.top/',
      'https://a.test,,https://b.test',
      'https://Dev.ratingo.top',
      'https://dev.ratingo.top?x=1',
    ].forEach((value) => expect(withOrigins(value).error?.message).toMatch(/OAUTH_RETURN_ORIGINS/));
  });

  it('accepts only https OAUTH_RETURN_ORIGINS in production', () => {
    const prodEnv = {
      ...BASE_ENV,
      ...JWT_SECRETS,
      NODE_ENV: 'production',
      OAUTH_STATE_SECRET: 's'.repeat(32),
      OAUTH_EXCHANGE_CODE_PEPPER: 'p'.repeat(32),
    };
    const withOrigins = (value: string) =>
      validate('api', { ...prodEnv, OAUTH_RETURN_ORIGINS: value });

    expect(withOrigins('https://admin.ratingo.top').error).toBeUndefined();
    expect(withOrigins('https://admin.ratingo.top,http://localhost:3000').error?.message).toMatch(
      /OAUTH_RETURN_ORIGINS/,
    );
  });

  it('forbids OAUTH_ALLOW_VERCEL_PREVIEWS=true in production', () => {
    const env = { ...BASE_ENV, ...JWT_SECRETS };
    const prodEnv = {
      ...env,
      NODE_ENV: 'production',
      OAUTH_STATE_SECRET: 's'.repeat(32),
      OAUTH_EXCHANGE_CODE_PEPPER: 'p'.repeat(32),
    };

    expect(validate('api', { ...env, OAUTH_ALLOW_VERCEL_PREVIEWS: 'true' }).error).toBeUndefined();
    expect(validate('api', { ...env, OAUTH_ALLOW_VERCEL_PREVIEWS: 'yes' }).error?.message).toMatch(
      /OAUTH_ALLOW_VERCEL_PREVIEWS/,
    );
    expect(
      validate('api', { ...prodEnv, OAUTH_ALLOW_VERCEL_PREVIEWS: 'false' }).error,
    ).toBeUndefined();
    expect(
      validate('api', { ...prodEnv, OAUTH_ALLOW_VERCEL_PREVIEWS: 'true' }).error?.message,
    ).toMatch(/OAUTH_ALLOW_VERCEL_PREVIEWS/);
  });
});
