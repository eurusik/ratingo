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

  it('lets the preview run without any credential', () => {
    expect(previewEnvSchema.safeParse({}).success).toBe(true);
  });
});
