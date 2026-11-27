import { z } from 'zod';

const DEFAULT_REVIEW_MODEL = 'stub:review';
const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
const DEFAULT_REPOSITORY = 'eurusik/ratingo';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const optionalText = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const envSchema = z.object({
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
});
