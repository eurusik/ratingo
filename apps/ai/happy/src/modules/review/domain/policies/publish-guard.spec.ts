import * as fc from 'fast-check';

import { PullRequestState } from '../entities/pull-request';

import { PublishBlockReason, decidePublishBlock } from './publish-guard';

const sha = fc.stringMatching(/^[0-9a-f]{40}$/);

describe('decidePublishBlock', () => {
  it('publishes only for an open, unmerged pull request still at the reviewed commit', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(PullRequestState.OPEN, PullRequestState.CLOSED),
        fc.boolean(),
        sha,
        sha,
        (state, merged, headSha, reviewedSha) => {
          const block = decidePublishBlock({ state, merged, headSha }, reviewedSha);
          const shouldPublish =
            state === PullRequestState.OPEN && !merged && headSha === reviewedSha;
          return (block === null) === shouldPublish;
        },
      ),
    );
  });

  it('names the reason, merged first, then closed, then a moved head', () => {
    const open = { state: PullRequestState.OPEN, merged: false, headSha: 'aaa' };
    expect(
      decidePublishBlock({ ...open, merged: true, state: PullRequestState.CLOSED }, 'aaa'),
    ).toBe(PublishBlockReason.MERGED);
    expect(decidePublishBlock({ ...open, state: PullRequestState.CLOSED }, 'aaa')).toBe(
      PublishBlockReason.CLOSED,
    );
    expect(decidePublishBlock(open, 'bbb')).toBe(PublishBlockReason.STALE_HEAD);
  });
});
