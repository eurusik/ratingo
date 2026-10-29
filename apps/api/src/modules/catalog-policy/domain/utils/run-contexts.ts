/**
 * Run Context Scope
 *
 * Determines which evaluation contexts an evaluation run must cover before it is complete.
 * Pure function: no I/O, no time.
 */

import {
  ACTIVE_EVALUATION_CONTEXTS,
  type EvaluationContextType,
} from '../constants/evaluation.constants';

/** Minimal run shape needed to resolve the context scope. */
export interface RunContextScopeInput {
  baselinePolicyVersion: number | null;
  targetPolicyVersion: number | null;
}

export interface RunContextScope {
  /**
   * Contexts every item must be evaluated in. `undefined` means "any single context"
   * (backfill runs, which evaluate exactly one context chosen at queue time).
   */
  requiredContexts: readonly EvaluationContextType[] | undefined;
  /** Number of evaluations expected per item. */
  contextsPerItem: number;
}

/**
 * Resolves the context scope of a run.
 *
 * - Prepare runs (target policy differs from the baseline) fan out to every active context.
 * - Backfill runs re-evaluate the already-active policy (baseline == target) for ONE context.
 */
export function resolveRunContextScope(run: RunContextScopeInput): RunContextScope {
  const isBackfill =
    run.baselinePolicyVersion !== null && run.baselinePolicyVersion === run.targetPolicyVersion;

  if (isBackfill) {
    return { requiredContexts: undefined, contextsPerItem: 1 };
  }

  return {
    requiredContexts: ACTIVE_EVALUATION_CONTEXTS,
    contextsPerItem: ACTIVE_EVALUATION_CONTEXTS.length,
  };
}
