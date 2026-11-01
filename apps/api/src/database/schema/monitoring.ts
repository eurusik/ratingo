import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const keyHealthChecks = pgTable(
  'key_health_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider', { enum: ['tmdb', 'trakt', 'mdblist', 'omdb', 's3'] }).notNull(),
    status: text('status', { enum: ['valid', 'degraded', 'invalid', 'unknown'] }).notNull(),
    statusCode: integer('status_code'),
    latencyMs: integer('latency_ms'),
    detail: text('detail'),
    quotaRemaining: integer('quota_remaining'),
    quotaLimit: integer('quota_limit'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (t) => ({
    providerCheckedIdx: index('key_health_checks_provider_checked_idx').on(
      t.provider,
      t.checkedAt.desc(),
    ),
  }),
);
