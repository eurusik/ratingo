import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  pgEnum,
  uuid,
  primaryKey,
} from 'drizzle-orm/pg-core';

import { mediaItems } from './media';

export const eligibilityStatusEnum = pgEnum('eligibility_status', [
  'pending',
  'eligible',
  'ineligible',
  'review',
]);

export const evaluationRunStatusEnum = pgEnum('evaluation_run_status', [
  'running',
  'prepared',
  'failed',
  'cancelled',
  'promoted',
  // Legacy values - kept for backward compatibility during migration
  'pending', // @deprecated - use 'running'
  'completed', // @deprecated - use 'prepared'
  'success', // @deprecated - use 'prepared'
]);

// Evaluation context enum for context-aware policy evaluation
export const evaluationContextEnum = pgEnum('evaluation_context', [
  'catalog',
  'trending',
  'homepage',
  'now_playing',
  'new_digital',
  'search',
]);

// --- CATALOG POLICY ENGINE ---

/**
 * PolicyConfig type for catalog_policies.policy jsonb field
 */
export interface PolicyConfig {
  allowedCountries: string[];
  blockedCountries: string[];
  blockedCountryMode: 'ANY' | 'MAJORITY';
  allowedLanguages: string[];
  blockedLanguages: string[];
  globalProviders: string[];
  breakoutRules: BreakoutRule[];
  eligibilityMode: 'STRICT' | 'RELAXED';
  homepage: {
    minRelevanceScore: number;
  };
}

export interface BreakoutRule {
  id: string;
  name: string;
  priority: number;
  requirements: {
    minImdbVotes?: number;
    minTraktVotes?: number;
    minQualityScoreNormalized?: number;
    requireAnyOfProviders?: string[];
    requireAnyOfRatingsPresent?: ('imdb' | 'metacritic' | 'rt' | 'trakt')[];
    originCountries?: string[];
  };
}

/**
 * CATALOG POLICIES (Versioned)
 * Stores versioned catalog filtering policies
 */
export const catalogPolicies = pgTable(
  'catalog_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: integer('version').notNull(),
    isActive: boolean('is_active').default(false).notNull(),
    policy: jsonb('policy').$type<PolicyConfig>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    activatedAt: timestamp('activated_at'),
  },
  (t) => ({
    versionIdx: index('catalog_policies_version_idx').on(t.version),
    // Partial index for fast active policy lookup (used by new-episodes query CTE)
    // Note: Partial unique index ensuring only one active policy is created via raw SQL migration:
    // CREATE UNIQUE INDEX catalog_policies_single_active ON catalog_policies ((1)) WHERE is_active = true;
    activeIdx: index('catalog_policies_active_idx')
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  }),
);

/**
 * MEDIA CATALOG EVALUATIONS
 * Stores evaluation results for each media item based on catalog policy.
 *
 * Key invariant: (media_item_id, policy_version, context) = unique evaluation
 * This enables storing evaluation history per policy version AND per display context.
 * Same item can have different eligibility for catalog vs trending vs homepage.
 */
export const mediaCatalogEvaluations = pgTable(
  'media_catalog_evaluations',
  {
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    status: eligibilityStatusEnum('status').default('pending').notNull(),
    reasons: text('reasons').array().default([]).notNull(),
    relevanceScore: integer('relevance_score').default(0).notNull(),
    policyVersion: integer('policy_version').default(0).notNull(), // 0 = no policy / pending seed
    breakoutRuleId: text('breakout_rule_id'),
    evaluatedAt: timestamp('evaluated_at'), // NULL for pending, set when actually evaluated
    // Links evaluation to specific run for accurate counter aggregation
    // NULL for legacy evaluations or manual updates
    runId: uuid('run_id').references(() => catalogEvaluationRuns.id, { onDelete: 'set null' }),
    // Display surface context for this evaluation
    // Same item can have different eligibility per context (e.g., PENDING for catalog, ELIGIBLE for trending)
    context: evaluationContextEnum('context').default('catalog').notNull(),
  },
  (t) => ({
    // Composite primary key: (media_item_id, policy_version, context)
    pk: primaryKey({ columns: [t.mediaItemId, t.policyVersion, t.context] }),
    statusIdx: index('media_catalog_eval_status_idx').on(t.status),
    statusRelevanceIdx: index('media_catalog_eval_status_relevance_idx').on(
      t.status,
      t.relevanceScore,
    ),
    policyVersionIdx: index('media_catalog_eval_policy_version_idx').on(t.policyVersion),
    runIdIdx: index('media_catalog_eval_run_id_idx').on(t.runId),
    // Context-based indexes (added in migration 0029)
    contextIdx: index('media_catalog_eval_context_idx').on(t.context),
    contextStatusIdx: index('media_catalog_eval_context_status_idx').on(
      t.context,
      t.status,
      t.relevanceScore,
    ),
    // Additional indexes added via migration 0014:
    // - media_catalog_eval_policy_status_relevance_idx (policy_version, status, relevance_score DESC)
    // - media_catalog_eval_item_version_idx (media_item_id, policy_version DESC)
    // Unique constraint for idempotent upserts per run (added in migration 0019)
  }),
);

/**
 * CATALOG EVALUATION RUNS
 * Tracks RE_EVALUATE_CATALOG job runs for monitoring and resumability
 * Extended for Policy Activation Flow (Prepare → Promote)
 */
export const catalogEvaluationRuns = pgTable(
  'catalog_evaluation_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    policyVersion: integer('policy_version').notNull(),
    status: evaluationRunStatusEnum('status').default('pending').notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
    cursor: text('cursor'),
    counters: jsonb('counters')
      .$type<{
        processed: number;
        eligible: number;
        ineligible: number;
        review: number;
        reasonBreakdown: Record<string, number>;
      }>()
      .default({
        processed: 0,
        eligible: 0,
        ineligible: 0,
        review: 0,
        reasonBreakdown: {},
      }),
    // Policy Activation Flow fields
    targetPolicyId: uuid('target_policy_id').references(() => catalogPolicies.id),
    targetPolicyVersion: integer('target_policy_version'),
    /** Version of active policy when run was created (for diff calculation) */
    baselinePolicyVersion: integer('baseline_policy_version'),
    totalReadySnapshot: integer('total_ready_snapshot').default(0),
    snapshotCutoff: timestamp('snapshot_cutoff'),
    processed: integer('processed').default(0),
    eligible: integer('eligible').default(0),
    ineligible: integer('ineligible').default(0),
    pending: integer('pending').default(0),
    errors: integer('errors').default(0),
    errorSample: jsonb('error_sample')
      .$type<
        Array<{
          mediaItemId: string;
          error: string;
          stack?: string;
          timestamp: string;
        }>
      >()
      .default([]),
    promotedAt: timestamp('promoted_at'),
    promotedBy: text('promoted_by'),
  },
  (t) => ({
    policyVersionIdx: index('catalog_eval_runs_policy_version_idx').on(t.policyVersion),
    statusIdx: index('catalog_eval_runs_status_idx').on(t.status),
    targetPolicyIdx: index('catalog_eval_runs_target_policy_idx').on(t.targetPolicyId),
    // Note: Partial unique index for running runs created via raw SQL migration
  }),
);
