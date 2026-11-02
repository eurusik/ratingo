import * as Joi from 'joi';

import { type AppRole, runsHttp } from '../common/runtime/app-role';

/**
 * Duration format regex for TTL validation (e.g., 15m, 7d, 1h, 30s, 100ms).
 */
const DURATION_RE = /^\d+\s*(ms|s|m|h|d)$/i;

const sharedEnvKeys = {
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis (BullMQ)
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // TMDB
  TMDB_API_KEY: Joi.string().required(),
  TMDB_API_URL: Joi.string().uri().default('https://api.themoviedb.org/3'),

  // Trakt
  TRAKT_CLIENT_ID: Joi.string().required(),
  TRAKT_CLIENT_SECRET: Joi.string().required(),

  // OMDb
  OMDB_API_KEY: Joi.string().required(),

  // MDBList (optional — used only for Rotten Tomatoes ratings backfill;
  // pipeline no-ops when key is absent)
  MDBLIST_API_KEY: Joi.string().optional(),
  MDBLIST_API_URL: Joi.string().uri().optional(),

  WEB_REVALIDATE_ORIGIN: Joi.string().uri().optional(),
  WEB_REVALIDATE_SECRET: Joi.string().min(32).optional(),
};

const httpEnvKeys = {
  // Server
  PORT: Joi.number().default(3001),

  // Auth (REQUIRED for security)
  ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.string().pattern(DURATION_RE).default('15m'),
  REFRESH_TOKEN_TTL: Joi.string().pattern(DURATION_RE).default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),
  // OAuth state/exchange secrets: required in production (auth.config.ts only has dev fallbacks)
  OAUTH_STATE_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', { is: 'production', then: Joi.required(), otherwise: Joi.optional() }),
  OAUTH_EXCHANGE_CODE_PEPPER: Joi.string()
    .min(32)
    .when('NODE_ENV', { is: 'production', then: Joi.required(), otherwise: Joi.optional() }),

  // Rate Limiting
  THROTTLE_LIMIT: Joi.number().default(600),
};

export const buildEnvSchema = (role: AppRole): Joi.ObjectSchema =>
  Joi.object({
    ...sharedEnvKeys,
    ...(runsHttp(role) ? httpEnvKeys : {}),
  });
