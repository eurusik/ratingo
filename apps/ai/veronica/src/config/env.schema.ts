import { z } from 'zod';

const DEFAULT_PORT = 3004;
const DEFAULT_FAST_MODEL = 'stub:digest';

const grafanaEnvSchema = z.object({
  GRAFANA_PROM_URL: z.url().optional(),
  GRAFANA_PROM_TOKEN: z.string().min(1).optional(),
});

const modelEnvSchema = z.object({
  AI_MODEL_FAST: z.string().min(1).default(DEFAULT_FAST_MODEL),
});

export const previewEnvSchema = grafanaEnvSchema.extend(modelEnvSchema.shape);

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
});
