import type { PullRequest } from '../entities/pull-request';
import { PullRequestState } from '../entities/pull-request';

export const PublishBlockReason = {
  CLOSED: 'closed',
  MERGED: 'merged',
  STALE_HEAD: 'stale_head',
} as const;
export type PublishBlockReason = (typeof PublishBlockReason)[keyof typeof PublishBlockReason];

export const decidePublishBlock = (
  current: Pick<PullRequest, 'state' | 'merged' | 'headSha'>,
  reviewedSha: string,
): PublishBlockReason | null => {
  if (current.merged) return PublishBlockReason.MERGED;
  if (current.state !== PullRequestState.OPEN) return PublishBlockReason.CLOSED;
  if (current.headSha !== reviewedSha) return PublishBlockReason.STALE_HEAD;
  return null;
};
