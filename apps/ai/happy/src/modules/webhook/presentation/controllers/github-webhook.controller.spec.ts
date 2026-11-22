import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { ReviewJobSource, reviewJobId, type ReviewJob } from '../../../review/public';
import { WebhookService } from '../../application/services/webhook.service';
import { EnqueueState, type ReviewQueuePort } from '../../domain/ports/review-queue.port';
import { signWebhookBody } from '../../infrastructure/security/webhook-signature';

import { GithubWebhookController } from './github-webhook.controller';

const SECRET = 'a-long-enough-webhook-secret';
const CONFIG = {
  allowedRepositories: ['eurusik/ratingo'],
  allowedAuthors: [],
  mentionHandle: 'happy-on-duty',
};

const fixture = (name: string): Buffer =>
  readFileSync(path.resolve(__dirname, '../fixtures', name));

class RecordingQueue implements ReviewQueuePort {
  readonly jobs: ReviewJob[] = [];
  failWith: Error | null = null;

  async enqueue(job: ReviewJob): Promise<EnqueueState> {
    if (this.failWith !== null) throw this.failWith;
    this.jobs.push(job);
    return EnqueueState.QUEUED;
  }

  async isPending(): Promise<boolean> {
    return false;
  }
}

const setup = () => {
  const queue = new RecordingQueue();
  const controller = new GithubWebhookController(
    { secret: SECRET },
    new WebhookService({ ...CONFIG }, queue),
  );
  const deliver = (event: string, raw: Buffer, signature = signWebhookBody(SECRET, raw)) =>
    controller.receive({ rawBody: raw } as never, signature, event);
  return { queue, controller, deliver };
};

describe('GithubWebhookController', () => {
  it('queues a review for an opened pull request', async () => {
    const { deliver, queue } = setup();
    const result = await deliver('pull_request', fixture('pull_request.opened.json'));
    expect(result).toMatchObject({ status: 'queued' });
    expect(queue.jobs).toEqual([
      {
        ref: { owner: 'eurusik', repo: 'ratingo', number: 455 },
        source: ReviewJobSource.PULL_REQUEST,
        headSha: '3f2a9c1d4e5b6a7788990011223344556677889a',
        commentId: null,
      },
    ]);
  });

  it('gives a redelivery the same job id so the queue deduplicates it', async () => {
    const { deliver, queue } = setup();
    await deliver('pull_request', fixture('pull_request.opened.json'));
    await deliver('pull_request', fixture('pull_request.opened.json'));
    const [first, second] = queue.jobs;
    expect(reviewJobId(first!)).toBe(reviewJobId(second!));
  });

  it('queues a review for ready_for_review and for the command from the owner', async () => {
    const { deliver, queue } = setup();
    await deliver('pull_request', fixture('pull_request.ready_for_review.json'));
    await deliver('issue_comment', fixture('issue_comment.review_command.json'));
    expect(queue.jobs.map((job) => job.source)).toEqual([
      ReviewJobSource.PULL_REQUEST,
      ReviewJobSource.COMMAND,
    ]);
    expect(queue.jobs[1]).toMatchObject({ commentId: 4001, headSha: null });
  });

  it.each([
    ['pull_request', 'pull_request.synchronize.json', 'action_not_reviewable'],
    ['pull_request', 'pull_request.opened.draft.json', 'draft'],
    ['pull_request', 'pull_request.opened.fork.json', 'untrusted_fork'],
    ['issue_comment', 'issue_comment.review_command.stranger.json', 'not_a_collaborator'],
    ['issue_comment', 'issue_comment.other_text.json', 'not_a_command'],
    ['issue_comment', 'issue_comment.on_issue.json', 'not_a_pull_request'],
  ])('ignores %s %s', async (event, file, reason) => {
    const { deliver, queue } = setup();
    expect(await deliver(event, fixture(file))).toEqual({ status: 'ignored', reason });
    expect(queue.jobs).toHaveLength(0);
  });

  it('answers a ping and ignores events it does not handle', async () => {
    const { deliver } = setup();
    expect(await deliver('ping', Buffer.from('{}'))).toEqual({ status: 'pong' });
    expect(await deliver('push', Buffer.from('{}'))).toEqual({
      status: 'ignored',
      reason: 'unsupported_event',
    });
  });

  it('rejects a bad signature, a missing body and invalid JSON', async () => {
    const { controller, deliver } = setup();
    const raw = fixture('pull_request.opened.json');
    await expect(deliver('pull_request', raw, 'sha256=' + '0'.repeat(64))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.receive({} as never, undefined, 'pull_request')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(deliver('pull_request', Buffer.from('not json'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('answers 503 when the queue is down so GitHub can redeliver', async () => {
    const { deliver, queue } = setup();
    queue.failWith = new Error('redis down');
    await expect(
      deliver('pull_request', fixture('pull_request.opened.json')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
