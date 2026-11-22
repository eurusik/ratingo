import { BASE_EVAL_CASES } from './base-cases';
import { MIGRATION_PROD_STATE_SAFE_CASES } from './check-cases/migration-prod-state-safe';
import { UPSERT_PRESERVES_ON_DEGRADED_INPUT_CASES } from './check-cases/upsert-preserves-on-degraded-input';
import { BULLMQ_JOBID_AND_PAYLOAD_CASES } from './check-cases/bullmq-jobid-and-payload';
import { SIDE_EFFECT_AFTER_CLAIM_CASES } from './check-cases/side-effect-after-claim';
import { READ_THEN_WRITE_RACE_CASES } from './check-cases/read-then-write-race';
import { EXTERNAL_CALL_RESILIENCE_AND_QUOTA_CASES } from './check-cases/external-call-resilience-and-quota';
import { QUERY_SCOPING_AND_DUPLICATES_CASES } from './check-cases/query-scoping-and-duplicates';
import { DTO_INPUT_TRUST_CASES } from './check-cases/dto-input-trust';
import { USER_MEDIA_TRANSITION_SIDE_EFFECTS_CASES } from './check-cases/user-media-transition-side-effects';
import { AIR_DATE_NULL_AND_TIME_BASIS_CASES } from './check-cases/air-date-null-and-time-basis';
import { SSR_CACHE_AND_MEMORY_CASES } from './check-cases/ssr-cache-and-memory';
import { MUTATION_CACHE_COHERENCE_CASES } from './check-cases/mutation-cache-coherence';
import type { EvalCase } from './eval-case';
import { LARGE_PR_EVAL_CASES } from './large-pr-cases';

export const CHECK_EVAL_CASES: readonly EvalCase[] = [
  ...MIGRATION_PROD_STATE_SAFE_CASES,
  ...UPSERT_PRESERVES_ON_DEGRADED_INPUT_CASES,
  ...BULLMQ_JOBID_AND_PAYLOAD_CASES,
  ...SIDE_EFFECT_AFTER_CLAIM_CASES,
  ...READ_THEN_WRITE_RACE_CASES,
  ...EXTERNAL_CALL_RESILIENCE_AND_QUOTA_CASES,
  ...QUERY_SCOPING_AND_DUPLICATES_CASES,
  ...DTO_INPUT_TRUST_CASES,
  ...USER_MEDIA_TRANSITION_SIDE_EFFECTS_CASES,
  ...AIR_DATE_NULL_AND_TIME_BASIS_CASES,
  ...SSR_CACHE_AND_MEMORY_CASES,
  ...MUTATION_CACHE_COHERENCE_CASES,
];

export const EVAL_CASES: readonly EvalCase[] = [
  ...BASE_EVAL_CASES,
  ...CHECK_EVAL_CASES,
  ...LARGE_PR_EVAL_CASES,
];
