import fc from 'fast-check';

import type { HappyResult } from '../entities/happy';

import { satisfiesReviewMode } from './happy-review-satisfaction.policy';

const result = (overrides: Partial<HappyResult>): HappyResult => ({
  kind: 'review',
  checklist: null,
  status: 'reviewed',
  checkedSha: 'h1',
  current: true,
  title: '',
  summary: '',
  skipReason: null,
  counts: { critical: 0, major: 0, minor: 0, nit: 0 },
  questions: [],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: null,
  review: null,
  ...overrides,
});

const fullScope = {
  mode: 'full' as const,
  baseSha: null,
  fullReason: null,
  files: 3,
  statusCounts: { new: 0, stillOpen: 0, resolved: 0, needsRecheck: 0 },
};

describe('satisfiesReviewMode', () => {
  it('accepts any result when the mode is auto', () => {
    expect(satisfiesReviewMode(result({}), 'auto')).toBe(true);
  });

  it('wants a full scope from an ordinary review when the mode is full', () => {
    expect(satisfiesReviewMode(result({ review: null }), 'full')).toBe(false);
    expect(
      satisfiesReviewMode(result({ review: { ...fullScope, mode: 'incremental' } }), 'full'),
    ).toBe(false);
    expect(satisfiesReviewMode(result({ review: fullScope }), 'full')).toBe(true);
  });

  it('counts a release checklist and a skipped result as done for a full request', () => {
    expect(
      satisfiesReviewMode(result({ kind: 'release_checklist', status: 'checklist' }), 'full'),
    ).toBe(true);
    expect(satisfiesReviewMode(result({ status: 'skipped' }), 'full')).toBe(true);
  });

  it('never rejects a result that cannot have a review scope, whatever else it carries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auto', 'full'),
        fc.boolean(),
        fc.string(),
        (mode, current, title) =>
          satisfiesReviewMode(
            result({ kind: 'release_checklist', status: 'checklist', current, title }),
            mode,
          ),
      ),
    );
  });
});
