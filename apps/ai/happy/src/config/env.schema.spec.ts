import { cliEnvSchema, serviceEnvSchema } from './env.schema';

const SERVICE = { GITHUB_TOKEN: 't', HAPPY_ALLOWED_REPOS: 'acme/shop, acme/api' };

describe('env schemas', () => {
  it('applies defaults and parses the repository list', () => {
    const env = serviceEnvSchema.parse(SERVICE);
    expect(env.PORT).toBe(3005);
    expect(env.AI_MODEL_FAST).toBe('stub:triage');
    expect(env.AI_MODEL_REVIEW).toBe('stub:review');
    expect(env.HAPPY_ALLOWED_REPOS).toEqual(['acme/shop', 'acme/api']);
    expect(env.HAPPY_ALLOWED_AUTHORS).toEqual([]);
  });

  it('requires a token and at least one repository', () => {
    expect(serviceEnvSchema.safeParse({ HAPPY_ALLOWED_REPOS: 'a/b' }).success).toBe(false);
    expect(serviceEnvSchema.safeParse({ GITHUB_TOKEN: 't' }).success).toBe(false);
    expect(serviceEnvSchema.safeParse({ ...SERVICE, HAPPY_ALLOWED_REPOS: ' , ' }).success).toBe(
      false,
    );
  });

  it('rejects a short service token and an empty Anthropic key', () => {
    expect(serviceEnvSchema.safeParse({ ...SERVICE, HAPPY_SERVICE_TOKEN: 'short' }).success).toBe(
      false,
    );
    expect(serviceEnvSchema.safeParse({ ...SERVICE, ANTHROPIC_API_KEY: '' }).success).toBe(false);
  });

  it('treats Redis as optional and rejects an empty URL', () => {
    expect(serviceEnvSchema.parse(SERVICE).REDIS_URL).toBeUndefined();
    expect(serviceEnvSchema.parse({ ...SERVICE, REDIS_URL: 'redis://h:6379' }).REDIS_URL).toBe(
      'redis://h:6379',
    );
    expect(serviceEnvSchema.safeParse({ ...SERVICE, REDIS_URL: '' }).success).toBe(false);
  });

  it('lets the CLI run with only a GitHub token', () => {
    expect(cliEnvSchema.safeParse({ GITHUB_TOKEN: 't' }).success).toBe(true);
    expect(cliEnvSchema.safeParse({}).success).toBe(false);
  });
});
