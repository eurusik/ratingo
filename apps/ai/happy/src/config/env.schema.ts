import { z } from 'zod';

const DEFAULT_PORT = 3005;
const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
const DEFAULT_FAST_MODEL = 'stub:triage';
const DEFAULT_REVIEW_MODEL = 'stub:review';
const MIN_SERVICE_TOKEN_CHARS = 24;

const csvList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

const modelEnvSchema = z.object({
  AI_MODEL_FAST: z.string().min(1).default(DEFAULT_FAST_MODEL),
  AI_MODEL_REVIEW: z.string().min(1).default(DEFAULT_REVIEW_MODEL),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

const githubEnvSchema = z.object({
  GITHUB_API_URL: z.url().default(DEFAULT_GITHUB_API_URL),
  REDIS_URL: z.string().min(1).optional(),
});

export const cliEnvSchema = modelEnvSchema.extend(githubEnvSchema.shape).extend({
  GITHUB_TOKEN: z.string().min(1),
  HAPPY_ALLOWED_AUTHORS: csvList,
});

export const serviceEnvSchema = modelEnvSchema.extend(githubEnvSchema.shape).extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  GITHUB_TOKEN: z.string().min(1),
  HAPPY_ALLOWED_REPOS: csvList.refine((repos) => repos.length > 0, {
    message: 'at least one repository is required',
  }),
  HAPPY_ALLOWED_AUTHORS: csvList,
  HAPPY_SERVICE_TOKEN: z.string().min(MIN_SERVICE_TOKEN_CHARS).optional(),
});
