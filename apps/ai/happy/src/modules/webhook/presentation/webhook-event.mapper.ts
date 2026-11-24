import { z } from 'zod';

import { GithubEvent } from '../domain/constants/webhook.constants';
import { WebhookEventKind, type WebhookEvent } from '../domain/entities/webhook-event';

const repositorySchema = z.object({ name: z.string(), owner: z.object({ login: z.string() }) });

const pullRequestPayload = z.object({
  action: z.string(),
  number: z.number().int().positive(),
  repository: repositorySchema,
  pull_request: z.object({
    draft: z.boolean().optional(),
    user: z.object({ login: z.string() }),
    head: z.object({
      sha: z.string(),
      repo: z.object({ full_name: z.string() }).nullable(),
    }),
  }),
});

const commentPayload = z.object({
  action: z.string(),
  repository: repositorySchema,
  issue: z.object({ number: z.number().int().positive(), pull_request: z.unknown().optional() }),
  comment: z.object({ id: z.number().int(), body: z.string(), author_association: z.string() }),
  sender: z.object({ type: z.string() }),
});

const refOf = (repository: z.infer<typeof repositorySchema>, number: number) => ({
  owner: repository.owner.login,
  repo: repository.name,
  number,
});

export const parseWebhookEvent = (eventName: string, payload: unknown): WebhookEvent | null => {
  if (eventName === GithubEvent.PULL_REQUEST) {
    const parsed = pullRequestPayload.safeParse(payload);
    if (!parsed.success) return null;
    const { action, number, repository, pull_request: pr } = parsed.data;
    return {
      kind: WebhookEventKind.PULL_REQUEST,
      action,
      ref: refOf(repository, number),
      isDraft: pr.draft ?? false,
      headSha: pr.head.sha,
      authorLogin: pr.user.login,
      headRepository: pr.head.repo?.full_name ?? null,
    };
  }
  if (eventName === GithubEvent.ISSUE_COMMENT) {
    const parsed = commentPayload.safeParse(payload);
    if (!parsed.success) return null;
    const { action, repository, issue, comment, sender } = parsed.data;
    return {
      kind: WebhookEventKind.COMMENT,
      action,
      ref: refOf(repository, issue.number),
      isPullRequest: issue.pull_request !== undefined,
      commentId: comment.id,
      body: comment.body,
      authorAssociation: comment.author_association,
      senderType: sender.type,
    };
  }
  return null;
};
