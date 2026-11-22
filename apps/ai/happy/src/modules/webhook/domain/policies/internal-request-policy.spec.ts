import * as fc from 'fast-check';

import { PullRequestState } from '../../../review/public';
import { InternalSkipReason } from '../constants/webhook.constants';

import { decideInternalRequest } from './internal-request-policy';

const CONFIG = { repositoryName: 'acme/shop', allowedAuthors: ['trusted-bot'] };

const pull = (overrides: Partial<Parameters<typeof decideInternalRequest>[0]> = {}) => ({
  state: PullRequestState.OPEN,
  merged: false,
  headRepository: 'acme/shop',
  author: 'alice',
  ...overrides,
});

describe('decideInternalRequest', () => {
  it('accepts an open pull request from the same repository', () => {
    expect(decideInternalRequest(pull(), CONFIG)).toBeNull();
  });

  it('rejects merged and closed pull requests', () => {
    expect(
      decideInternalRequest(pull({ merged: true, state: PullRequestState.CLOSED }), CONFIG),
    ).toBe(InternalSkipReason.MERGED);
    expect(decideInternalRequest(pull({ state: PullRequestState.CLOSED }), CONFIG)).toBe(
      InternalSkipReason.CLOSED,
    );
  });

  it('rejects forks unless the author is allowlisted, ignoring letter case of the repository', () => {
    expect(decideInternalRequest(pull({ headRepository: 'eve/shop' }), CONFIG)).toBe(
      InternalSkipReason.UNTRUSTED_FORK,
    );
    expect(
      decideInternalRequest(pull({ headRepository: 'eve/shop', author: 'trusted-bot' }), CONFIG),
    ).toBeNull();
    expect(decideInternalRequest(pull({ headRepository: 'ACME/Shop' }), CONFIG)).toBeNull();
    expect(decideInternalRequest(pull({ headRepository: null }), CONFIG)).toBe(
      InternalSkipReason.UNTRUSTED_FORK,
    );
  });

  it('never accepts a merged pull request, whatever else is true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(PullRequestState.OPEN, PullRequestState.CLOSED),
        fc.string(),
        fc.option(fc.string(), { nil: null }),
        (state, author, headRepository) =>
          decideInternalRequest({ state, merged: true, author, headRepository }, CONFIG) ===
          InternalSkipReason.MERGED,
      ),
    );
  });
});
