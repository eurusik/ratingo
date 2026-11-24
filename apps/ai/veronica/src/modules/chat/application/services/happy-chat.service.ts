import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import { HAPPY_CONFIG, type HappyConfig } from '../../../../config/config.constants';
import { HAPPY_FOLLOW_UP_FIRST_DELAY_MS } from '../../domain/constants/happy.constants';
import {
  HAPPY_NEEDS_NUMBER_REPLY,
  HAPPY_NO_OPEN_PULL_REQUESTS_REPLY,
  HAPPY_UNAVAILABLE_REPLY,
  happyAlreadyRunningReply,
  happyForeignRepositoryReply,
  happyNotFoundReply,
  happyPickedPullRequestReply,
  happySkippedReply,
  happyStartedReply,
} from '../../domain/constants/chat-replies.constants';
import { HappyLookupKind, HappyRequestKind, HappyReviewMode } from '../../domain/entities/happy';
import { HappyTargetKind, type HappyTarget } from '../../domain/entities/intent';
import { satisfiesReviewMode } from '../../domain/policies/happy-review-satisfaction.policy';
import { renderHappyResult } from '../../domain/policies/happy-summary.policy';
import { pullRequestTitle, renderPullRequestChoice } from '../../domain/policies/happy-pick.policy';
import { isSameRepository } from '../../domain/policies/happy-target.policy';
import { CHAT_JOB_QUEUE, type ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';
import {
  HAPPY_CLIENT,
  HappyUnavailableError,
  type HappyClientPort,
} from '../../domain/ports/happy-client.port';

type Resolution = { pullNumber: number } | { reply: string } | { pick: true };

@Injectable()
export class HappyChatService {
  constructor(
    @Inject(HAPPY_CLIENT) private readonly happy: HappyClientPort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
    @Inject(HAPPY_CONFIG) private readonly config: HappyConfig,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async reply(chatId: string, target: HappyTarget, mode: HappyReviewMode): Promise<string> {
    const resolution = this.resolve(target);
    if ('reply' in resolution) return resolution.reply;
    try {
      return 'pick' in resolution
        ? await this.pick(chatId, mode)
        : await this.answer(chatId, resolution.pullNumber, mode);
    } catch (error) {
      if (error instanceof HappyUnavailableError) return HAPPY_UNAVAILABLE_REPLY;
      throw error;
    }
  }

  private resolve(target: HappyTarget): Resolution {
    switch (target.kind) {
      case HappyTargetKind.NUMBER:
        return { pullNumber: target.number };
      case HappyTargetKind.LINK:
        return isSameRepository(target.pullRequest, this.config.repository)
          ? { pullNumber: target.pullRequest.number }
          : { reply: happyForeignRepositoryReply(this.config.repository) };
      case HappyTargetKind.PICK:
        return { pick: true };
      case HappyTargetKind.UNCLEAR:
        return { reply: HAPPY_NEEDS_NUMBER_REPLY };
    }
  }

  private async pick(chatId: string, mode: HappyReviewMode): Promise<string> {
    const open = await this.happy.listOpenPullRequests();
    const [only] = open;
    if (only === undefined) return HAPPY_NO_OPEN_PULL_REQUESTS_REPLY;
    if (open.length > 1) return renderPullRequestChoice(open, this.clock.nowMs());
    const answer = await this.answer(chatId, only.number, mode);
    return `${happyPickedPullRequestReply(only.number, pullRequestTitle(only.title))}\n\n${answer}`;
  }

  private async answer(chatId: string, pullNumber: number, mode: HappyReviewMode): Promise<string> {
    const lookup = await this.happy.latestResult(pullNumber);
    if (lookup.kind === HappyLookupKind.NOT_FOUND) return happyNotFoundReply(pullNumber);
    if (lookup.result?.current === true && satisfiesReviewMode(lookup.result, mode)) {
      return renderHappyResult(pullNumber, lookup.result);
    }
    if (lookup.reviewPending) {
      await this.followUp(chatId, pullNumber, lookup.headSha, mode);
      return happyAlreadyRunningReply(pullNumber);
    }
    const request = await this.happy.requestReview(pullNumber, mode);
    switch (request.kind) {
      case HappyRequestKind.NOT_FOUND:
        return happyNotFoundReply(pullNumber);
      case HappyRequestKind.SKIPPED:
        return happySkippedReply(pullNumber, request.reason);
      case HappyRequestKind.ALREADY_RUNNING:
        await this.followUp(chatId, pullNumber, request.headSha, mode);
        return happyAlreadyRunningReply(pullNumber);
      case HappyRequestKind.QUEUED:
      case HappyRequestKind.ALREADY_REVIEWED:
        await this.followUp(chatId, pullNumber, request.headSha, mode);
        return happyStartedReply(pullNumber);
    }
  }

  private followUp(
    chatId: string,
    pullNumber: number,
    headSha: string,
    mode: HappyReviewMode,
  ): Promise<void> {
    return this.queue.scheduleHappyFollowUp(
      {
        chatId,
        pullNumber,
        headSha,
        attempt: 1,
        ...(mode === HappyReviewMode.FULL ? { mode } : {}),
      },
      HAPPY_FOLLOW_UP_FIRST_DELAY_MS,
    );
  }
}
