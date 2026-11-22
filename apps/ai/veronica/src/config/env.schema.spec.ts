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
});
