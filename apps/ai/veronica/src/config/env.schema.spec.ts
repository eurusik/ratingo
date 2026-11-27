import { previewEnvSchema, serviceEnvSchema } from './env.schema';

const VALID = {
  DATABASE_URL: 'postgres://u:p@h/db',
  REDIS_URL: 'redis://h:6379',
  GRAFANA_PROM_URL: 'https://grafana.example/prom',
  GRAFANA_PROM_TOKEN: 'a',
  TELEGRAM_BOT_TOKEN: 'b',
  TELEGRAM_CHAT_ID: '1',
};

describe('env schemas', () => {
  it('applies defaults for the port and the fast model', () => {
    const env = serviceEnvSchema.parse(VALID);
    expect(env.PORT).toBe(3004);
    expect(env.AI_MODEL_FAST).toBe('stub:digest');
  });

  it('requires every credential the service uses', () => {
    for (const key of Object.keys(VALID)) {
      const { [key as keyof typeof VALID]: _removed, ...rest } = VALID;
      expect(serviceEnvSchema.safeParse(rest).success).toBe(false);
    }
  });

  it('treats the reader database as optional and rejects an empty value', () => {
    expect(serviceEnvSchema.parse(VALID).AI_READER_DATABASE_URL).toBeUndefined();
    expect(
      serviceEnvSchema.parse({ ...VALID, AI_READER_DATABASE_URL: 'postgres://r:p@h/db' })
        .AI_READER_DATABASE_URL,
    ).toBe('postgres://r:p@h/db');
    expect(serviceEnvSchema.safeParse({ ...VALID, AI_READER_DATABASE_URL: '' }).success).toBe(
      false,
    );
  });

  it('treats the explorer database as optional and an empty value as not set', () => {
    expect(serviceEnvSchema.parse(VALID).AI_EXPLORER_DATABASE_URL).toBeUndefined();
    expect(
      serviceEnvSchema.parse({ ...VALID, AI_EXPLORER_DATABASE_URL: '' }).AI_EXPLORER_DATABASE_URL,
    ).toBeUndefined();
    expect(
      serviceEnvSchema.parse({ ...VALID, AI_EXPLORER_DATABASE_URL: 'postgres://e:p@h/db' })
        .AI_EXPLORER_DATABASE_URL,
    ).toBe('postgres://e:p@h/db');
  });

  it('treats the Anthropic key as optional and rejects an empty value', () => {
    expect(serviceEnvSchema.parse(VALID).ANTHROPIC_API_KEY).toBeUndefined();
    expect(serviceEnvSchema.parse({ ...VALID, ANTHROPIC_API_KEY: 'k' }).ANTHROPIC_API_KEY).toBe(
      'k',
    );
    expect(serviceEnvSchema.safeParse({ ...VALID, ANTHROPIC_API_KEY: '' }).success).toBe(false);
    expect(previewEnvSchema.parse({ ANTHROPIC_API_KEY: 'k' }).ANTHROPIC_API_KEY).toBe('k');
  });

  it('lets the preview run without any credential', () => {
    expect(previewEnvSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a comma separated list of user ids and rejects anything else', () => {
    const parse = (value: string) =>
      serviceEnvSchema.safeParse({ ...VALID, TELEGRAM_ALLOWED_USER_IDS: value }).success;
    expect(parse('1')).toBe(true);
    expect(parse('1, 22,333')).toBe(true);
    expect(parse('')).toBe(false);
    expect(parse('1,,2')).toBe(false);
    expect(parse('abc')).toBe(false);
    expect(parse('-5')).toBe(false);
  });

  it('accepts only an https webhook url', () => {
    const parse = (value: string) =>
      serviceEnvSchema.safeParse({ ...VALID, TELEGRAM_WEBHOOK_URL: value }).success;
    expect(parse('https://veronica.example/webhooks/telegram')).toBe(true);
    expect(parse('http://veronica.example/webhooks/telegram')).toBe(false);
    expect(parse('')).toBe(false);
    expect(serviceEnvSchema.parse(VALID).TELEGRAM_WEBHOOK_URL).toBeUndefined();
  });

  it('treats the GitHub read token as optional and defaults the repository', () => {
    const env = serviceEnvSchema.parse(VALID);
    expect(env.GITHUB_READ_TOKEN).toBeUndefined();
    expect(env.GITHUB_REPOSITORY).toBe('eurusik/ratingo');
    expect(serviceEnvSchema.safeParse({ ...VALID, GITHUB_READ_TOKEN: '' }).success).toBe(false);
    expect(serviceEnvSchema.safeParse({ ...VALID, GITHUB_REPOSITORY: 'not a repo' }).success).toBe(
      false,
    );
  });

  it('leaves Google Analytics off for an empty value instead of failing', () => {
    const env = serviceEnvSchema.parse({ ...VALID, GA_CREDENTIALS_JSON: '', GA_PROPERTY_ID: ' ' });
    expect(env.GA_CREDENTIALS_JSON).toBeUndefined();
    expect(env.GA_PROPERTY_ID).toBeUndefined();
    expect(serviceEnvSchema.parse({ ...VALID, GA_PROPERTY_ID: '515589933' }).GA_PROPERTY_ID).toBe(
      '515589933',
    );
  });

  it('leaves logs off when the Loki variables are missing or empty, and reads them when set', () => {
    const off = serviceEnvSchema.parse({ ...VALID, GRAFANA_LOKI_URL: '', GRAFANA_LOKI_USER: ' ' });
    expect(off.GRAFANA_LOKI_URL).toBeUndefined();
    expect(off.GRAFANA_LOKI_USER).toBeUndefined();
    expect(off.GRAFANA_LOKI_TOKEN).toBeUndefined();
    const on = serviceEnvSchema.parse({
      ...VALID,
      GRAFANA_LOKI_URL: 'https://logs.example.invalid',
      GRAFANA_LOKI_USER: '12345',
      GRAFANA_LOKI_TOKEN: 'glc_fake',
    });
    expect([on.GRAFANA_LOKI_URL, on.GRAFANA_LOKI_USER, on.GRAFANA_LOKI_TOKEN]).toEqual([
      'https://logs.example.invalid',
      '12345',
      'glc_fake',
    ]);
  });

  it('rejects a Loki URL that is not a URL', () => {
    expect(serviceEnvSchema.safeParse({ ...VALID, GRAFANA_LOKI_URL: 'logs-prod' }).success).toBe(
      false,
    );
  });

  it('reads the DUM-E address and token, and treats empty values as not set', () => {
    expect(serviceEnvSchema.parse(VALID).DUME_INTERNAL_URL).toBeUndefined();
    expect(
      serviceEnvSchema.parse({
        ...VALID,
        DUME_INTERNAL_URL: 'http://dume.railway.internal:3006',
        DUME_SERVICE_TOKEN: 'a-service-token-of-24-chars!',
      }),
    ).toMatchObject({
      DUME_INTERNAL_URL: 'http://dume.railway.internal:3006',
      DUME_SERVICE_TOKEN: 'a-service-token-of-24-chars!',
    });
    expect(
      serviceEnvSchema.parse({ ...VALID, DUME_INTERNAL_URL: '', DUME_SERVICE_TOKEN: ' ' }),
    ).toMatchObject({ DUME_INTERNAL_URL: undefined, DUME_SERVICE_TOKEN: undefined });
  });
});
