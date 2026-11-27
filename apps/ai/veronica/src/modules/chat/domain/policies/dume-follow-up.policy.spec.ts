import { DUME_DEADLINE_MS, DumeFollowUpAction } from '../constants/dume.constants';
import { DumeFailureReason, DumeState } from '../entities/dume';
import { NOW_MS, answeredView, failedView, queuedView } from '../../testing/dume.testing';

import { decideDumeFollowUp } from './dume-follow-up.policy';

const followUp = { createdAtMs: NOW_MS - 60_000 };
const found = (request: ReturnType<typeof answeredView>) => ({ kind: 'found', request }) as const;

describe('decideDumeFollowUp', () => {
  it('delivers an answered and a failed request', () => {
    expect(decideDumeFollowUp(followUp, found(answeredView()), NOW_MS)).toBe(
      DumeFollowUpAction.DELIVER,
    );
    expect(decideDumeFollowUp(followUp, found(failedView(DumeFailureReason.TIMEOUT)), NOW_MS)).toBe(
      DumeFollowUpAction.DELIVER,
    );
  });

  it.each([DumeState.QUEUED, DumeState.RUNNING])('waits while the request is %s', (state) => {
    expect(decideDumeFollowUp(followUp, found(queuedView({ state })), NOW_MS)).toBe(
      DumeFollowUpAction.WAIT,
    );
  });

  it('waits when DUM-E cannot be reached, until the deadline', () => {
    expect(decideDumeFollowUp(followUp, null, NOW_MS)).toBe(DumeFollowUpAction.WAIT);
    expect(decideDumeFollowUp({ createdAtMs: NOW_MS - DUME_DEADLINE_MS }, null, NOW_MS)).toBe(
      DumeFollowUpAction.GIVE_UP,
    );
  });

  it('gives up on a request that is still not finished at the deadline', () => {
    expect(
      decideDumeFollowUp({ createdAtMs: NOW_MS - DUME_DEADLINE_MS }, found(queuedView()), NOW_MS),
    ).toBe(DumeFollowUpAction.GIVE_UP);
  });

  it('still delivers a finished answer found after the deadline', () => {
    expect(
      decideDumeFollowUp(
        { createdAtMs: NOW_MS - DUME_DEADLINE_MS * 2 },
        found(answeredView()),
        NOW_MS,
      ),
    ).toBe(DumeFollowUpAction.DELIVER);
  });

  it('reports a request DUM-E does not know', () => {
    expect(decideDumeFollowUp(followUp, { kind: 'not_found' }, NOW_MS)).toBe(
      DumeFollowUpAction.NOT_FOUND,
    );
  });
});
