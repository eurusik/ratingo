import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import { DUME_CONFIG, type DumeConfig } from '../../../../config/config.constants';
import { CHAT_TRANSPORT, NotificationError, type ChatTransportPort } from '../../../notify/public';
import { TurnRole } from '../../domain/entities/conversation-turn';
import {
  DUME_FOLLOW_UP_INTERVAL_MS,
  DumeFollowUpAction,
} from '../../domain/constants/dume.constants';
import {
  DUME_GAVE_UP_LINE,
  DUME_NOT_FOUND_LINE,
} from '../../domain/constants/dume-replies.constants';
import {
  DumeFailureReason,
  DumeState,
  type DumeFollowUp,
  type DumeLookup,
  type DumeRequestView,
} from '../../domain/entities/dume';
import { decideDumeFollowUp } from '../../domain/policies/dume-follow-up.policy';
import {
  dumeMemoryText,
  renderDumeAnswer,
  renderDumeFailure,
  renderDumeNotice,
} from '../../domain/policies/dume-message.policy';
import { CHAT_JOB_QUEUE, type ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';
import {
  CONVERSATION_STORE,
  type ConversationStorePort,
} from '../../domain/ports/conversation-store.port';
import {
  DELEGATION_STORE,
  type DelegationStorePort,
} from '../../domain/ports/delegation-store.port';
import {
  DUME_CLIENT,
  DumeUnavailableError,
  type DumeClientPort,
} from '../../domain/ports/dume-client.port';

export const DumeFollowUpOutcome = {
  WAITING: 'waiting',
  DELIVERED: 'delivered',
  DUPLICATE: 'duplicate',
} as const;
export type DumeFollowUpOutcome = (typeof DumeFollowUpOutcome)[keyof typeof DumeFollowUpOutcome];

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class DumeFollowUpService {
  private readonly logger = new Logger(DumeFollowUpService.name);

  constructor(
    @Inject(DUME_CLIENT) private readonly client: DumeClientPort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
    @Inject(CHAT_TRANSPORT) private readonly transport: ChatTransportPort,
    @Inject(DELEGATION_STORE) private readonly store: DelegationStorePort,
    @Inject(CONVERSATION_STORE) private readonly conversations: ConversationStorePort,
    @Inject(DUME_CONFIG) private readonly config: DumeConfig,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async handle(followUp: DumeFollowUp): Promise<DumeFollowUpOutcome> {
    const lookup = await this.lookup(followUp.requestId);
    const action = decideDumeFollowUp(followUp, lookup, this.clock.nowMs());
    if (action === DumeFollowUpAction.WAIT) {
      await this.queue.scheduleDumeFollowUp(
        { ...followUp, attempt: followUp.attempt + 1 },
        DUME_FOLLOW_UP_INTERVAL_MS,
      );
      return DumeFollowUpOutcome.WAITING;
    }
    const outcome = await this.deliver(followUp, action, lookup);
    await this.releaseInFlight(followUp);
    return outcome;
  }

  private async lookup(requestId: string): Promise<DumeLookup | null> {
    try {
      return await this.client.find(requestId);
    } catch (error) {
      if (error instanceof DumeUnavailableError) {
        this.logger.warn({
          message: 'dume_follow_up.lookup_failed',
          requestId,
          reason: error.reason,
        });
        return null;
      }
      throw error;
    }
  }

  private async deliver(
    followUp: DumeFollowUp,
    action: DumeFollowUpAction,
    lookup: DumeLookup | null,
  ): Promise<DumeFollowUpOutcome> {
    if (!(await this.store.claimDelivery(followUp.requestId))) {
      this.logger.log({ message: 'dume_follow_up.duplicate', requestId: followUp.requestId });
      return DumeFollowUpOutcome.DUPLICATE;
    }
    const request = lookup?.kind === 'found' ? lookup.request : null;
    try {
      for (const message of this.messagesFor(action, request)) {
        await this.transport.sendMessage(followUp.chatId, message);
      }
    } catch (error) {
      await this.releaseDeliveryUnlessUnknown(followUp.requestId, error);
      throw error;
    }
    await this.confirmDelivery(followUp.requestId);
    this.logger.log({
      message: 'dume_follow_up.delivered',
      requestId: followUp.requestId,
      action,
      state: request?.state ?? null,
      reason: request?.reason ?? null,
    });
    await this.remember(followUp.chatId, request);
    return DumeFollowUpOutcome.DELIVERED;
  }

  private messagesFor(action: DumeFollowUpAction, request: DumeRequestView | null): string[] {
    if (action === DumeFollowUpAction.NOT_FOUND) return [renderDumeNotice(DUME_NOT_FOUND_LINE)];
    if (action === DumeFollowUpAction.GIVE_UP || request === null) {
      return [renderDumeNotice(DUME_GAVE_UP_LINE)];
    }
    if (request.state === DumeState.ANSWERED && request.result !== undefined) {
      return renderDumeAnswer(request.result, this.config.repository);
    }
    return [renderDumeFailure(request.reason ?? DumeFailureReason.INTERNAL_ERROR)];
  }

  private async confirmDelivery(requestId: string): Promise<void> {
    try {
      await this.store.confirmDelivery(requestId);
    } catch (error) {
      this.logger.error({
        message: 'dume_follow_up.confirm_failed',
        requestId,
        reason: errorName(error),
      });
    }
  }

  private async releaseDeliveryUnlessUnknown(requestId: string, error: unknown): Promise<void> {
    const unknown =
      error instanceof NotificationError && (!error.retryable || error.deliveryUnknown);
    if (unknown) return;
    try {
      await this.store.releaseDelivery(requestId);
    } catch (releaseError) {
      this.logger.error({
        message: 'dume_follow_up.release_failed',
        requestId,
        reason: errorName(releaseError),
      });
    }
  }

  private async releaseInFlight(followUp: DumeFollowUp): Promise<void> {
    try {
      await this.store.releaseInFlight(followUp.chatId, followUp.requestId);
    } catch (error) {
      this.logger.warn({
        message: 'dume_follow_up.release_in_flight_failed',
        requestId: followUp.requestId,
        reason: errorName(error),
      });
    }
  }

  private async remember(chatId: string, request: DumeRequestView | null): Promise<void> {
    if (request?.state !== DumeState.ANSWERED || request.result === undefined) return;
    try {
      await this.conversations.append(chatId, [
        {
          role: TurnRole.ASSISTANT,
          text: dumeMemoryText(request.result),
          atMs: this.clock.nowMs(),
        },
      ]);
    } catch (error) {
      this.logger.warn({
        message: 'dume_follow_up.remember_failed',
        requestId: request.requestId,
        reason: errorName(error),
      });
    }
  }
}
