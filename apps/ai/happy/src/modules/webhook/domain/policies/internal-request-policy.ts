import { PullRequestState, type PullRequest } from '../../../review/public';
import { InternalSkipReason } from '../constants/webhook.constants';

import { isTrustedAuthor } from './trusted-author';

export interface InternalRequestConfig {
  repositoryName: string;
  allowedAuthors: readonly string[];
}

export const decideInternalRequest = (
  pullRequest: Pick<PullRequest, 'state' | 'merged' | 'headRepository' | 'author'>,
  config: InternalRequestConfig,
): InternalSkipReason | null => {
  if (pullRequest.merged) return InternalSkipReason.MERGED;
  if (pullRequest.state !== PullRequestState.OPEN) return InternalSkipReason.CLOSED;
  const trusted = isTrustedAuthor(
    { headRepository: pullRequest.headRepository, authorLogin: pullRequest.author },
    config.repositoryName,
    config.allowedAuthors,
  );
  return trusted ? null : InternalSkipReason.UNTRUSTED_FORK;
};
