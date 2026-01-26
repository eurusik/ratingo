/**
 * Domain Types Index
 *
 * Exports domain types for the catalog-policy module.
 */

export { type PolicyEngineInput, type NormalizedOffer } from './policy.types';

export {
  DEFAULT_DIFF_SAMPLE_SIZE,
  type DiffCounts,
  type DiffSample,
  type ReasonBreakdown,
  type DiffReport,
} from './diff.types';

export { type DryRunMode } from './dry-run.types';

export { type AggregatedCounters, type FinalizeResult, type RunAnomaly } from './run.types';
