import fc from 'fast-check';

import { HAPPY_FOLLOW_UP_MAX_ATTEMPTS } from '../constants/happy.constants';
import type { HappyLookup, HappyResult } from '../entities/happy';

import { decideHappyFollowUp } from './happy-follow-up.policy';

const result = (checkedSha: string): HappyResult => ({
  status: 'reviewed',
  checkedSha,
  current: true,
  title: '',
  summary: '',
  skipReason: null,
  counts: { critical: 0, major: 0, minor: 0, nit: 0 },
  questions: [],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: null,
});

const found = (headSha: string, reviewPending: boolean, checked: string | null): HappyLookup => ({
  kind: 'found',
  headSha,
  reviewPending,
  result: checked === null ? null : result(checked),
});

describe('decideHappyFollowUp', () => {
  const at = (attempt: number) => ({ headSha: 'h1', attempt });

  it('delivers the result for the requested commit', () => {
    expect(decideHappyFollowUp(at(1), found('h1', false, 'h1'))).toBe('deliver');
  });

  it('waits while the review is pending', () => {
    expect(decideHappyFollowUp(at(1), found('h1', true, null))).toBe('wait');
    expect(decideHappyFollowUp(at(1), found('h1', true, 'old'))).toBe('wait');
  });

  it('stops when the head moved on and nothing was published for the requested one', () => {
    expect(decideHappyFollowUp(at(1), found('h2', true, null))).toBe('head_moved');
  });

  it('reports a finished job without a result only after a grace attempt', () => {
    expect(decideHappyFollowUp(at(1), found('h1', false, null))).toBe('wait');
    expect(decideHappyFollowUp(at(3), found('h1', false, null))).toBe('not_published');
  });

  it('waits through Happy outages and gives up at the limit', () => {
    expect(decideHappyFollowUp(at(2), null)).toBe('wait');
    expect(decideHappyFollowUp(at(HAPPY_FOLLOW_UP_MAX_ATTEMPTS), null)).toBe('give_up');
    expect(decideHappyFollowUp(at(HAPPY_FOLLOW_UP_MAX_ATTEMPTS), found('h1', true, null))).toBe(
      'give_up',
    );
  });

  it('reports a vanished pull request', () => {
    expect(decideHappyFollowUp(at(1), { kind: 'not_found' })).toBe('not_found');
  });

  it('never waits past the attempt limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: HAPPY_FOLLOW_UP_MAX_ATTEMPTS, max: 1000 }),
        fc.boolean(),
        (attempt, pending) =>
          decideHappyFollowUp({ headSha: 'h1', attempt }, found('h1', pending, null)) !== 'wait',
      ),
    );
  });
});
