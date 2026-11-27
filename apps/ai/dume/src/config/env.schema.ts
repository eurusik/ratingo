import { z } from 'zod';

const DEFAULT_REVIEW_MODEL = 'stub:review';
const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
const DEFAULT_REPOSITORY = 'eurusik/ratingo';
const DEFAULT_PORT = 3006;
const DEFAULT_MAX_INVESTIGATIONS_PER_DAY = 10;
const MIN_SERVICE_TOKEN_CHARS = 24;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const optionalText = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

const baseEnvShape = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AI_MODEL_REVIEW: z.preprocess(emptyToUndefined, z.string().min(1).default(DEFAULT_REVIEW_MODEL)),
  ANTHROPIC_API_KEY: optionalText,
  REDIS_URL: optionalText,
  GITHUB_REPOSITORY: z.preprocess(
    emptyToUndefined,
    z.string().regex(REPOSITORY_PATTERN).default(DEFAULT_REPOSITORY),
  ),
  GITHUB_READ_TOKEN: optionalText,
  GITHUB_API_URL: z.preprocess(emptyToUndefined, z.url().default(DEFAULT_GITHUB_API_URL)),
  DUME_LOCAL_CHECKOUT: optionalText,
  GRAFANA_LOKI_URL: optionalUrl,
  GRAFANA_LOKI_USER: optionalText,
  GRAFANA_LOKI_TOKEN: optionalText,
  GRAFANA_PROM_URL: optionalUrl,
  GRAFANA_PROM_TOKEN: optionalText,
  AI_READER_DATABASE_URL: optionalText,
  AI_EXPLORER_DATABASE_URL: optionalText,
};

export const envSchema = z.object(baseEnvShape);

export const serviceEnvSchema = z
  .object({
    ...baseEnvShape,
    PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(DEFAULT_PORT)),
    REDIS_URL: z.string().min(1),
    DUME_SERVICE_TOKEN: z.preprocess(
      emptyToUndefined,
      z.string().min(MIN_SERVICE_TOKEN_CHARS).optional(),
    ),
    DUME_MAX_INVESTIGATIONS_PER_DAY: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(DEFAULT_MAX_INVESTIGATIONS_PER_DAY),
    ),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;
    const missing = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (env.ANTHROPIC_API_KEY === undefined) {
      missing('ANTHROPIC_API_KEY', 'is required in production');
    }
    if (env.DUME_SERVICE_TOKEN === undefined) {
      missing('DUME_SERVICE_TOKEN', 'is required in production');
    }
    if (env.AI_MODEL_REVIEW.startsWith('stub:')) {
      missing('AI_MODEL_REVIEW', 'must name a real model in production, not a stub');
    }
  });
