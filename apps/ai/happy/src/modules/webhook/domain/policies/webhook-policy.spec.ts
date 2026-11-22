import * as fc from 'fast-check';

import { ReviewJobSource } from '../../../review/public';
import { IgnoreReason, REVIEWABLE_PULL_REQUEST_ACTIONS } from '../constants/webhook.constants';
import {
  WebhookEventKind,
  type CommentWebhookEvent,
  type PullRequestWebhookEvent,
} from '../entities/webhook-event';

import { decideWebhook } from './webhook-policy';

const HANDLE = 'happy-on-duty';
const RETIRED_HANDLE = 'happy';
const CONFIG = {
  allowedRepositories: ['eurusik/ratingo'],
  allowedAuthors: ['friend'],
  mentionHandle: HANDLE,
};

const pullRequest = (
  overrides: Partial<PullRequestWebhookEvent> = {},
): PullRequestWebhookEvent => ({
  kind: WebhookEventKind.PULL_REQUEST,
  action: 'opened',
  ref: { owner: 'eurusik', repo: 'ratingo', number: 5 },
  isDraft: false,
  headSha: 'abc',
  authorLogin: 'eurusik',
  headRepository: 'eurusik/ratingo',
  ...overrides,
});

const comment = (overrides: Partial<CommentWebhookEvent> = {}): CommentWebhookEvent => ({
  kind: WebhookEventKind.COMMENT,
  action: 'created',
  ref: { owner: 'eurusik', repo: 'ratingo', number: 5 },
  isPullRequest: true,
  commentId: 9,
  body: `@${HANDLE} scan`,
  authorAssociation: 'OWNER',
  senderType: 'User',
  ...overrides,
});

describe('decideWebhook pull requests', () => {
  it('enqueues opened, ready_for_review and reopened, and nothing else', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (action) => {
        const decision = decideWebhook(pullRequest({ action }), CONFIG);
        return (decision.action === 'enqueue') === REVIEWABLE_PULL_REQUEST_ACTIONS.includes(action);
      }),
    );
    for (const action of REVIEWABLE_PULL_REQUEST_ACTIONS) {
      expect(decideWebhook(pullRequest({ action }), CONFIG).action).toBe('enqueue');
    }
  });

  it('never reviews on synchronize', () => {
    expect(decideWebhook(pullRequest({ action: 'synchronize' }), CONFIG)).toEqual({
      action: 'ignore',
      reason: IgnoreReason.ACTION_NOT_REVIEWABLE,
    });
  });

  it('ignores drafts, other repositories and fork authors outside the allowlist', () => {
    expect(decideWebhook(pullRequest({ isDraft: true }), CONFIG)).toMatchObject({
      reason: IgnoreReason.DRAFT,
    });
    expect(
      decideWebhook(pullRequest({ ref: { owner: 'x', repo: 'y', number: 1 } }), CONFIG),
    ).toMatchObject({ reason: IgnoreReason.REPOSITORY_NOT_ALLOWED });
    expect(
      decideWebhook(pullRequest({ headRepository: 'stranger/ratingo', authorLogin: 's' }), CONFIG),
    ).toMatchObject({ reason: IgnoreReason.UNTRUSTED_FORK });
    expect(
      decideWebhook(
        pullRequest({ headRepository: 'friend/ratingo', authorLogin: 'friend' }),
        CONFIG,
      ).action,
    ).toBe('enqueue');
  });

  it('carries the head commit and the pull request into the job', () => {
    expect(decideWebhook(pullRequest({ headSha: 'deadbeef' }), CONFIG)).toEqual({
      action: 'enqueue',
      job: {
        ref: { owner: 'eurusik', repo: 'ratingo', number: 5 },
        source: ReviewJobSource.PULL_REQUEST,
        headSha: 'deadbeef',
        commentId: null,
      },
    });
  });
});

const COMMANDS = [
  `@${HANDLE} scan`,
  `@${HANDLE} review`,
  '/happy scan',
  '/happy review',
  '  @HAPPY-ON-DUTY Scan\n',
  '/HAPPY REVIEW',
];

describe('decideWebhook commands', () => {
  it('accepts the exact command from owners, members and collaborators only', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('NONE', 'CONTRIBUTOR', 'FIRST_TIMER', 'MANNEQUIN'),
        (association) =>
          decideWebhook(comment({ authorAssociation: association }), CONFIG).action === 'ignore',
      ),
    );
    for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      expect(decideWebhook(comment({ authorAssociation: association }), CONFIG).action).toBe(
        'enqueue',
      );
    }
  });

  it('accepts every command form and nothing else as the first text', () => {
    for (const body of COMMANDS) {
      expect(decideWebhook(comment({ body }), CONFIG).action).toBe('enqueue');
    }
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (body) => {
        fc.pre(!/^\s*(@happy-on-duty|\/happy)\s+(scan|review)/i.test(body));
        return decideWebhook(comment({ body }), CONFIG).action === 'ignore';
      }),
    );
  });

  it('does not treat the retired short mention as a command', () => {
    expect(decideWebhook(comment({ body: `@${RETIRED_HANDLE} review` }), CONFIG)).toMatchObject({
      action: 'ignore',
      reason: IgnoreReason.NOT_A_COMMAND,
    });
  });

  it('ignores comments on issues, from bots and in other repositories', () => {
    expect(decideWebhook(comment({ isPullRequest: false }), CONFIG)).toMatchObject({
      reason: IgnoreReason.NOT_A_PULL_REQUEST,
    });
    expect(decideWebhook(comment({ senderType: 'Bot' }), CONFIG)).toMatchObject({
      reason: IgnoreReason.BOT_SENDER,
    });
    expect(
      decideWebhook(comment({ ref: { owner: 'x', repo: 'y', number: 1 } }), CONFIG),
    ).toMatchObject({ reason: IgnoreReason.REPOSITORY_NOT_ALLOWED });
  });

  it('keys the job by the comment so a redelivery is one job', () => {
    expect(decideWebhook(comment(), CONFIG)).toMatchObject({
      job: { source: ReviewJobSource.COMMAND, headSha: null, commentId: 9 },
    });
  });
});
