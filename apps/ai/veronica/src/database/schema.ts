import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  text,
  date,
} from 'drizzle-orm/pg-core';

export const aiSchema = pgSchema('ai');

export const runs = aiSchema.table('runs', {
  id: text('id').primaryKey(),
  agent: text('agent').notNull(),
  task: text('task'),
  trigger: text('trigger').notNull(),
  model: text('model').notNull(),
  status: text('status').notNull(),
  stopReason: text('stop_reason'),
  stopDetail: text('stop_detail'),
  startedAtMs: bigint('started_at_ms', { mode: 'number' }).notNull(),
  finishedAtMs: bigint('finished_at_ms', { mode: 'number' }),
  turns: integer('turns').notNull(),
  usage: jsonb('usage').notNull(),
  costUsd: doublePrecision('cost_usd').notNull(),
  toolCalls: jsonb('tool_calls').notNull(),
});

export const digestDeliveries = aiSchema.table('digest_deliveries', {
  digestDate: date('digest_date', { mode: 'string' }).primaryKey(),
  status: text('status').notNull(),
  claimedAtMs: bigint('claimed_at_ms', { mode: 'number' }).notNull(),
  sentAtMs: bigint('sent_at_ms', { mode: 'number' }),
  silent: boolean('silent'),
  runId: text('run_id'),
});
