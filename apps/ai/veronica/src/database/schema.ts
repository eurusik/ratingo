import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  text,
  date,
  index,
  timestamp,
  uuid,
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

export const chatExchanges = aiSchema.table(
  'chat_exchanges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id),
    chatId: text('chat_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    route: text('route').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    outcome: text('outcome').notNull(),
    flaggedNumbers: jsonb('cut_numbers').notNull(),
    toolNames: jsonb('tool_names').notNull(),
    toolCalls: jsonb('tool_calls'),
  },
  (table) => [
    index('chat_exchanges_chat_created_idx').on(table.chatId, table.createdAt),
    index('chat_exchanges_created_idx').on(table.createdAt),
  ],
);
