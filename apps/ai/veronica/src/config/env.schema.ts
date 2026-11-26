import { z } from 'zod';

const DEFAULT_PORT = 3004;
const DEFAULT_FAST_MODEL = 'stub:digest';

const grafanaEnvSchema = z.object({
  GRAFANA_PROM_URL: z.url().optional(),
  GRAFANA_PROM_TOKEN: z.string().min(1).optional(),
});

const productStatsEnvSchema = z.object({
  AI_READER_DATABASE_URL: z.string().min(1).optional(),
});

const modelEnvSchema = z.object({
  AI_MODEL_FAST: z.string().min(1).default(DEFAULT_FAST_MODEL),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

const DEFAULT_GITHUB_REPOSITORY = 'eurusik/ratingo';

const changesEnvSchema = z.object({
  GITHUB_READ_TOKEN: z.string().min(1).optional(),
  GITHUB_REPOSITORY: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default(DEFAULT_GITHUB_REPOSITORY),
});

const happyEnvSchema = z.object({
  HAPPY_INTERNAL_URL: z.string().min(1).optional(),
  HAPPY_SERVICE_TOKEN: z.string().min(1).optional(),
});

const unsetWhenEmpty = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value));

const lokiEnvSchema = z.object({
  GRAFANA_LOKI_URL: unsetWhenEmpty.pipe(z.url().optional()),
  GRAFANA_LOKI_USER: unsetWhenEmpty,
  GRAFANA_LOKI_TOKEN: unsetWhenEmpty,
});

const analyticsEnvSchema = z.object({
  GA_CREDENTIALS_JSON: unsetWhenEmpty,
  GA_PROPERTY_ID: unsetWhenEmpty,
});

const USER_ID_LIST = /^\d+(\s*,\s*\d+)*$/;

const chatEnvSchema = z.object({
  TELEGRAM_ALLOWED_USER_IDS: z.string().regex(USER_ID_LIST).optional(),
  TELEGRAM_WEBHOOK_URL: z
    .url()
    .refine((value) => value.startsWith('https://'))
    .optional(),
});

export const previewEnvSchema = grafanaEnvSchema
  .extend(modelEnvSchema.shape)
  .extend(productStatsEnvSchema.shape);

export const serviceEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GRAFANA_PROM_URL: z.url(),
  GRAFANA_PROM_TOKEN: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  ...modelEnvSchema.shape,
  ...productStatsEnvSchema.shape,
  ...chatEnvSchema.shape,
  ...changesEnvSchema.shape,
  ...happyEnvSchema.shape,
  ...analyticsEnvSchema.shape,
  ...lokiEnvSchema.shape,
});
