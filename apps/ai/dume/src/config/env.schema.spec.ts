import { envSchema, serviceEnvSchema } from './env.schema';

const PRODUCTION = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://localhost:6379',
  ANTHROPIC_API_KEY: 'sk-test',
  AI_MODEL_REVIEW: 'anthropic:claude-sonnet-5-5',
  DUME_SERVICE_TOKEN: 'a-service-token-of-24-chars!',
};

const issuesOf = (env: Record<string, string>): string[] => {
  const result = serviceEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
};

describe('serviceEnvSchema', () => {
  it('accepts a complete production environment and fills the defaults', () => {
    const env = serviceEnvSchema.parse(PRODUCTION);

    expect(env.PORT).toBe(3006);
    expect(env.DUME_MAX_INVESTIGATIONS_PER_DAY).toBe(10);
  });

  it.each(['ANTHROPIC_API_KEY', 'DUME_SERVICE_TOKEN', 'REDIS_URL'] as const)(
    'refuses production without %s',
    (name) => {
      const { [name]: _removed, ...rest } = PRODUCTION;

      expect(issuesOf(rest)).toContain(name);
    },
  );

  it('refuses a stub model in production', () => {
    expect(issuesOf({ ...PRODUCTION, AI_MODEL_REVIEW: 'stub:review' })).toContain('AI_MODEL_REVIEW');
  });

  it('refuses a token shorter than 24 characters', () => {
    expect(issuesOf({ ...PRODUCTION, DUME_SERVICE_TOKEN: 'short' })).toContain('DUME_SERVICE_TOKEN');
  });

  it('lets a development environment run with the stub model and no token, but still needs Redis', () => {
    expect(issuesOf({ NODE_ENV: 'development', REDIS_URL: 'redis://localhost:6379' })).toEqual([]);
    expect(issuesOf({ NODE_ENV: 'development' })).toEqual(['REDIS_URL']);
  });

  it('reads the day cap from the environment', () => {
    expect(
      serviceEnvSchema.parse({ ...PRODUCTION, DUME_MAX_INVESTIGATIONS_PER_DAY: '3' })
        .DUME_MAX_INVESTIGATIONS_PER_DAY,
    ).toBe(3);
  });
});

describe('envSchema for the command line', () => {
  it('needs no service variables', () => {
    expect(envSchema.safeParse({}).success).toBe(true);
  });
});
