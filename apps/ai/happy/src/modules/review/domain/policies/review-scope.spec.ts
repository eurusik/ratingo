import * as fc from 'fast-check';

import {
  ComparisonState,
  FullReviewReason,
  RequestedMode,
  ReviewMode,
} from '../entities/review-scope';

import {
  planReviewScope,
  PreviousReviewKind,
  resolveScope,
  type PreviousReview,
} from './review-scope';

const previousArb: fc.Arbitrary<PreviousReview> = fc.oneof(
  fc.constant<PreviousReview>({ kind: PreviousReviewKind.NONE }),
  fc.constant<PreviousReview>({ kind: PreviousReviewKind.UNREADABLE }),
  fc.record({
    kind: fc.constant(PreviousReviewKind.STATE),
    reviewedSha: fc.stringMatching(/^[0-9a-f]{40}$/),
    complete: fc.boolean(),
    findings: fc.constant([]),
  }),
);

describe('planReviewScope', () => {
  it('always does a full review with the reason "requested" when asked', () => {
    fc.assert(
      fc.property(previousArb, (previous) => {
        expect(planReviewScope(RequestedMode.FULL, previous)).toEqual({
          action: 'full',
          reason: FullReviewReason.REQUESTED,
        });
      }),
    );
  });

  it('records why a full review is chosen when automatic mode cannot go incremental', () => {
    expect(planReviewScope(RequestedMode.AUTO, { kind: PreviousReviewKind.NONE })).toEqual({
      action: 'full',
      reason: FullReviewReason.NO_PREVIOUS,
    });
    expect(planReviewScope(RequestedMode.AUTO, { kind: PreviousReviewKind.UNREADABLE })).toEqual({
      action: 'full',
      reason: FullReviewReason.PREVIOUS_UNREADABLE,
    });
    expect(
      planReviewScope(RequestedMode.AUTO, {
        kind: PreviousReviewKind.STATE,
        reviewedSha: 'a',
        complete: false,
        findings: [],
      }),
    ).toEqual({ action: 'full', reason: FullReviewReason.PREVIOUS_INCOMPLETE });
  });

  it('compares against the last reviewed commit only when the previous review was complete', () => {
    fc.assert(
      fc.property(previousArb, (previous) => {
        const step = planReviewScope(RequestedMode.AUTO, previous);
        const expectsCompare = previous.kind === PreviousReviewKind.STATE && previous.complete;
        expect(step.action === 'compare').toBe(expectsCompare);
        if (step.action === 'compare' && previous.kind === PreviousReviewKind.STATE) {
          expect(step.baseSha).toBe(previous.reviewedSha);
        }
      }),
    );
  });
});

describe('resolveScope', () => {
  it('goes incremental only when the last reviewed commit is an ancestor of the head', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[0-9a-f]{40}$/),
        fc.constantFrom(...Object.values(ComparisonState)),
        (baseSha, comparison) => {
          const scope = resolveScope(baseSha, comparison);
          expect(scope.mode === ReviewMode.INCREMENTAL).toBe(comparison === ComparisonState.AHEAD);
          if (scope.mode === ReviewMode.INCREMENTAL) expect(scope.baseSha).toBe(baseSha);
        },
      ),
    );
  });

  it('names a rewritten history and a failed compare differently', () => {
    expect(resolveScope('a', ComparisonState.DIVERGED)).toEqual({
      mode: ReviewMode.FULL,
      reason: FullReviewReason.HISTORY_REWRITTEN,
    });
    expect(resolveScope('a', ComparisonState.FAILED)).toEqual({
      mode: ReviewMode.FULL,
      reason: FullReviewReason.COMPARE_FAILED,
    });
  });
});
