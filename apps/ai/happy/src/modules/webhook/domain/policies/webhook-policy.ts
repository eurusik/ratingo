import { ReviewJobSource, type ReviewJob } from '../../../review/public';
import {
  BOT_SENDER_TYPE,
  COLLABORATOR_ASSOCIATIONS,
  COMMENT_CREATED_ACTION,
  IgnoreReason,
  REVIEWABLE_PULL_REQUEST_ACTIONS,
} from '../constants/webhook.constants';
import type {
  CommentWebhookEvent,
  PullRequestWebhookEvent,
  WebhookEvent,
} from '../entities/webhook-event';
import { WebhookEventKind } from '../entities/webhook-event';

import { parseReviewCommand } from './review-command';
import { isTrustedAuthor } from './trusted-author';

export interface WebhookPolicyConfig {
  allowedRepositories: readonly string[];
  allowedAuthors: readonly string[];
  mentionHandle: string;
}

export type WebhookDecision =
  { action: 'enqueue'; job: ReviewJob } | { action: 'ignore'; reason: IgnoreReason };

const ignore = (reason: IgnoreReason): WebhookDecision => ({ action: 'ignore', reason });

const repositoryName = (event: WebhookEvent): string => `${event.ref.owner}/${event.ref.repo}`;

const isAllowedRepository = (event: WebhookEvent, config: WebhookPolicyConfig): boolean =>
  config.allowedRepositories.some(
    (entry) => entry.toLowerCase() === repositoryName(event).toLowerCase(),
  );

const isTrustedEventAuthor = (
  event: PullRequestWebhookEvent,
  config: WebhookPolicyConfig,
): boolean => isTrustedAuthor(event, repositoryName(event), config.allowedAuthors);

const decidePullRequest = (
  event: PullRequestWebhookEvent,
  config: WebhookPolicyConfig,
): WebhookDecision => {
  if (!REVIEWABLE_PULL_REQUEST_ACTIONS.includes(event.action)) {
    return ignore(IgnoreReason.ACTION_NOT_REVIEWABLE);
  }
  if (!isAllowedRepository(event, config)) return ignore(IgnoreReason.REPOSITORY_NOT_ALLOWED);
  if (event.isDraft) return ignore(IgnoreReason.DRAFT);
  if (!isTrustedEventAuthor(event, config)) return ignore(IgnoreReason.UNTRUSTED_FORK);
  return {
    action: 'enqueue',
    job: {
      ref: event.ref,
      source: ReviewJobSource.PULL_REQUEST,
      headSha: event.headSha,
      commentId: null,
    },
  };
};

const decideComment = (
  event: CommentWebhookEvent,
  config: WebhookPolicyConfig,
): WebhookDecision => {
  const command =
    event.action === COMMENT_CREATED_ACTION
      ? parseReviewCommand(event.body, config.mentionHandle)
      : null;
  if (command === null) return ignore(IgnoreReason.NOT_A_COMMAND);
  if (!event.isPullRequest) return ignore(IgnoreReason.NOT_A_PULL_REQUEST);
  if (!isAllowedRepository(event, config)) return ignore(IgnoreReason.REPOSITORY_NOT_ALLOWED);
  if (event.senderType === BOT_SENDER_TYPE) return ignore(IgnoreReason.BOT_SENDER);
  if (!COLLABORATOR_ASSOCIATIONS.includes(event.authorAssociation)) {
    return ignore(IgnoreReason.NOT_A_COLLABORATOR);
  }
  return {
    action: 'enqueue',
    job: {
      ref: event.ref,
      source: ReviewJobSource.COMMAND,
      headSha: null,
      commentId: event.commentId,
      mode: command.mode,
    },
  };
};

export const decideWebhook = (event: WebhookEvent, config: WebhookPolicyConfig): WebhookDecision =>
  event.kind === WebhookEventKind.PULL_REQUEST
    ? decidePullRequest(event, config)
    : decideComment(event, config);
