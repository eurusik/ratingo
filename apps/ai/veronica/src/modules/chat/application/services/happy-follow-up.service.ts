import { Inject, Injectable, Logger } from '@nestjs/common';

import { HAPPY_CONFIG, type HappyConfig } from '../../../../config/config.constants';
import { CHAT_TRANSPORT, type ChatTransportPort } from '../../../notify/public';
import {
  GITHUB_WEB_PREFIX,
  HAPPY_FOLLOW_UP_INTERVAL_MS,
  HappyFollowUpAction,
} from '../../domain/constants/happy.constants';
import {
  happyGaveUpReply,
  happyHeadMovedReply,
  happyNotFoundReply,
  happyNotPublishedReply,
} from '../../domain/constants/chat-replies.constants';
import type { HappyFollowUp, HappyLookup } from '../../domain/entities/happy';
import { HappyLookupKind } from '../../domain/entities/happy';
import { decideHappyFollowUp } from '../../domain/policies/happy-follow-up.policy';
import { renderHappyResult } from '../../domain/policies/happy-summary.policy';
import { CHAT_JOB_QUEUE, type ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';
import {
  HAPPY_CLIENT,
  HappyUnavailableError,
  type HappyClientPort,
} from '../../domain/ports/happy-client.port';

@Injectable()
export class HappyFollowUpService {
  private readonly logger = new Logger(HappyFollowUpService.name);

  constructor(
    @Inject(HAPPY_CLIENT) private readonly happy: HappyClientPort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
    @Inject(CHAT_TRANSPORT) private readonly transport: ChatTransportPort,
    @Inject(HAPPY_CONFIG) private readonly config: HappyConfig,
  ) {}

  async handle(followUp: HappyFollowUp): Promise<HappyFollowUpAction> {
    const lookup = await this.lookup(followUp.pullNumber);
    const action = decideHappyFollowUp(followUp, lookup);
    if (action === HappyFollowUpAction.WAIT) {
      await this.queue.scheduleHappyFollowUp(
        { ...followUp, attempt: followUp.attempt + 1 },
        HAPPY_FOLLOW_UP_INTERVAL_MS,
      );
      return action;
    }
    await this.transport.sendMessage(followUp.chatId, this.messageFor(action, followUp, lookup));
    return action;
  }

  private async lookup(pullNumber: number): Promise<HappyLookup | null> {
    try {
      return await this.happy.latestResult(pullNumber);
    } catch (error) {
      if (error instanceof HappyUnavailableError) {
        this.logger.warn(`Результат Хеппі не прочитано: ${error.name}`);
        return null;
      }
      throw error;
    }
  }

  private messageFor(
    action: Exclude<HappyFollowUpAction, typeof HappyFollowUpAction.WAIT>,
    followUp: HappyFollowUp,
    lookup: HappyLookup | null,
  ): string {
    const { pullNumber } = followUp;
    switch (action) {
      case HappyFollowUpAction.DELIVER:
        return lookup?.kind === HappyLookupKind.FOUND && lookup.result !== null
          ? renderHappyResult(pullNumber, lookup.result)
          : happyNotPublishedReply(pullNumber);
      case HappyFollowUpAction.HEAD_MOVED:
        return happyHeadMovedReply(pullNumber);
      case HappyFollowUpAction.NOT_PUBLISHED:
        return happyNotPublishedReply(pullNumber);
      case HappyFollowUpAction.NOT_FOUND:
        return happyNotFoundReply(pullNumber);
      case HappyFollowUpAction.GIVE_UP:
        return happyGaveUpReply(
          pullNumber,
          `${GITHUB_WEB_PREFIX}${this.config.repository}/pull/${pullNumber}`,
        );
    }
  }
}
