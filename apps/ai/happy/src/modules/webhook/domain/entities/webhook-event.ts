import type { PullRequestRef } from '../../../review/public';

export const WebhookEventKind = {
  PULL_REQUEST: 'pull_request',
  COMMENT: 'comment',
} as const;

export interface PullRequestWebhookEvent {
  kind: typeof WebhookEventKind.PULL_REQUEST;
  action: string;
  ref: PullRequestRef;
  isDraft: boolean;
  headSha: string;
  authorLogin: string;
  headRepository: string | null;
}

export interface CommentWebhookEvent {
  kind: typeof WebhookEventKind.COMMENT;
  action: string;
  ref: PullRequestRef;
  isPullRequest: boolean;
  commentId: number;
  body: string;
  authorAssociation: string;
  senderType: string;
}

export type WebhookEvent = PullRequestWebhookEvent | CommentWebhookEvent;
