import { cliEnvSchema, serviceEnvSchema } from './env.schema';

const SERVICE = {
  GITHUB_APP_ID: '12345',
  GITHUB_APP_PRIVATE_KEY: 'key',
  GITHUB_WEBHOOK_SECRET: 'a-webhook-secret-16',
  REDIS_URL: 'redis://h:6379',
  HAPPY_ALLOWED_REPOS: 'acme/shop, acme/api',
};

describe('env schemas', () => {
  it('applies defaults and parses the repository list', () => {
    const env = serviceEnvSchema.parse(SERVICE);
    expect(env.PORT).toBe(3005);
    expect(env.AI_MODEL_FAST).toBe('stub:triage');
    expect(env.AI_MODEL_REVIEW).toBe('stub:review');
    expect(env.HAPPY_ALLOWED_REPOS).toEqual(['acme/shop', 'acme/api']);
    expect(env.HAPPY_ALLOWED_AUTHORS).toEqual([]);
  });

  it.each(['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET', 'REDIS_URL'])(
    'requires %s',
    (name) => {
      const { [name as keyof typeof SERVICE]: _removed, ...rest } = SERVICE;
      expect(serviceEnvSchema.safeParse(rest).success).toBe(false);
    },
  );

  it('requires at least one repository', () => {
    expect(serviceEnvSchema.safeParse({ ...SERVICE, HAPPY_ALLOWED_REPOS: ' , ' }).success).toBe(
      false,
    );
  });

  it('rejects a short webhook secret, short service token and empty Anthropic key', () => {
    expect(serviceEnvSchema.safeParse({ ...SERVICE, GITHUB_WEBHOOK_SECRET: 'short' }).success).toBe(
      false,
    );
    expect(serviceEnvSchema.safeParse({ ...SERVICE, HAPPY_SERVICE_TOKEN: 'short' }).success).toBe(
      false,
    );
    expect(serviceEnvSchema.safeParse({ ...SERVICE, ANTHROPIC_API_KEY: '' }).success).toBe(false);
  });

  it('keeps Redis optional for the CLI and lets it run with only a GitHub token', () => {
    expect(cliEnvSchema.parse({ GITHUB_TOKEN: 't' }).REDIS_URL).toBeUndefined();
    expect(cliEnvSchema.safeParse({ GITHUB_TOKEN: 't', REDIS_URL: '' }).success).toBe(false);
    expect(cliEnvSchema.safeParse({}).success).toBe(false);
  });
});
