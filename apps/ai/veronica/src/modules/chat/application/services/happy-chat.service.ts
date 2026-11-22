import { Inject, Injectable } from '@nestjs/common';

import { HAPPY_CONFIG, type HappyConfig } from '../../../../config/config.constants';
import { HAPPY_FOLLOW_UP_FIRST_DELAY_MS } from '../../domain/constants/happy.constants';
import {
  HAPPY_NEEDS_NUMBER_REPLY,
  HAPPY_UNAVAILABLE_REPLY,
  happyAlreadyRunningReply,
  happyForeignRepositoryReply,
  happyNotFoundReply,
  happySkippedReply,
  happyStartedReply,
} from '../../domain/constants/chat-replies.constants';
import { HappyLookupKind, HappyRequestKind } from '../../domain/entities/happy';
import { HappyTargetKind, type HappyTarget } from '../../domain/entities/intent';
import { renderHappyResult } from '../../domain/policies/happy-summary.policy';
import { isSameRepository } from '../../domain/policies/happy-target.policy';
import { CHAT_JOB_QUEUE, type ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';
import {
  HAPPY_CLIENT,
  HappyUnavailableError,
  type HappyClientPort,
} from '../../domain/ports/happy-client.port';

type Resolution = { pullNumber: number } | { reply: string };

@Injectable()
export class HappyChatService {
  constructor(
    @Inject(HAPPY_CLIENT) private readonly happy: HappyClientPort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
    @Inject(HAPPY_CONFIG) private readonly config: HappyConfig,
  ) {}

  async reply(chatId: string, target: HappyTarget): Promise<string> {
    const resolution = this.resolve(target);
    if ('reply' in resolution) return resolution.reply;
    try {
      return await this.answer(chatId, resolution.pullNumber);
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
      case HappyTargetKind.UNCLEAR:
        return { reply: HAPPY_NEEDS_NUMBER_REPLY };
    }
  }

  private async answer(chatId: string, pullNumber: number): Promise<string> {
    const lookup = await this.happy.latestResult(pullNumber);
    if (lookup.kind === HappyLookupKind.NOT_FOUND) return happyNotFoundReply(pullNumber);
    if (lookup.result?.current === true) return renderHappyResult(pullNumber, lookup.result);
    if (lookup.reviewPending) {
      await this.followUp(chatId, pullNumber, lookup.headSha);
      return happyAlreadyRunningReply(pullNumber);
    }
    const request = await this.happy.requestReview(pullNumber);
    switch (request.kind) {
      case HappyRequestKind.NOT_FOUND:
        return happyNotFoundReply(pullNumber);
      case HappyRequestKind.SKIPPED:
        return happySkippedReply(pullNumber, request.reason);
      case HappyRequestKind.ALREADY_RUNNING:
        await this.followUp(chatId, pullNumber, request.headSha);
        return happyAlreadyRunningReply(pullNumber);
      case HappyRequestKind.QUEUED:
      case HappyRequestKind.ALREADY_REVIEWED:
        await this.followUp(chatId, pullNumber, request.headSha);
        return happyStartedReply(pullNumber);
    }
  }

  private followUp(chatId: string, pullNumber: number, headSha: string): Promise<void> {
    return this.queue.scheduleHappyFollowUp(
      { chatId, pullNumber, headSha, attempt: 1 },
      HAPPY_FOLLOW_UP_FIRST_DELAY_MS,
    );
  }
}
