/**
 * Run Context Scope Tests
 */

import * as fc from 'fast-check';

import { ACTIVE_EVALUATION_CONTEXTS } from '../constants/evaluation.constants';

import { resolveRunContextScope } from './run-contexts';

describe('resolveRunContextScope', () => {
  it('should require every active context for prepare runs', () => {
    const scope = resolveRunContextScope({ baselinePolicyVersion: 1, targetPolicyVersion: 2 });

    expect(scope.requiredContexts).toEqual(ACTIVE_EVALUATION_CONTEXTS);
    expect(scope.contextsPerItem).toBe(ACTIVE_EVALUATION_CONTEXTS.length);
  });

  it('should require every active context when there is no baseline (first policy)', () => {
    const scope = resolveRunContextScope({ baselinePolicyVersion: null, targetPolicyVersion: 1 });

    expect(scope.contextsPerItem).toBe(ACTIVE_EVALUATION_CONTEXTS.length);
  });

  it('should expect a single context for backfill runs (baseline == target)', () => {
    const scope = resolveRunContextScope({ baselinePolicyVersion: 3, targetPolicyVersion: 3 });

    expect(scope.requiredContexts).toBeUndefined();
    expect(scope.contextsPerItem).toBe(1);
  });

  it('property: contextsPerItem always matches the required contexts length (or 1 when any)', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 50 }), { nil: null }),
        fc.option(fc.integer({ min: 0, max: 50 }), { nil: null }),
        (baseline, target) => {
          const scope = resolveRunContextScope({
            baselinePolicyVersion: baseline,
            targetPolicyVersion: target,
          });

          expect(scope.contextsPerItem).toBeGreaterThanOrEqual(1);
          expect(scope.contextsPerItem).toBe(scope.requiredContexts?.length ?? 1);
        },
      ),
    );
  });
});
