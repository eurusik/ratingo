import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  DUME_DEFAULT_REF,
  DUME_FOLLOW_UP_FIRST_DELAY_MS,
  DelegationStatus,
} from '../../domain/constants/dume.constants';
import {
  DUME_ALREADY_RUNNING_NOTICE,
  DUME_ALREADY_STARTED_NOTICE,
  DUME_REJECTION_NOTICE,
  DUME_STARTED_NOTICE,
  DUME_UNAVAILABLE_NOTICE,
} from '../../domain/constants/dume-replies.constants';
import { DumeSubmitKind, type DumeRejectionReason } from '../../domain/entities/dume';
import { delegationRequestId } from '../../domain/policies/dume-request-id.policy';
import { CHAT_JOB_QUEUE, type ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';
import {
  DELEGATION_STORE,
  type DelegationStorePort,
} from '../../domain/ports/delegation-store.port';
import {
  DUME_CLIENT,
  DumeUnavailableError,
  type DumeClientPort,
} from '../../domain/ports/dume-client.port';

export interface DelegationRequest {
  chatId: string;
  updateId: number;
  question: string;
}

export type DelegationOutcome =
  | { status: typeof DelegationStatus.STARTED; requestId: string; ownerNotice: string }
  | { status: typeof DelegationStatus.ALREADY_STARTED; requestId: string; ownerNotice: string }
  | { status: typeof DelegationStatus.ALREADY_RUNNING; ownerNotice: string }
  | {
      status: typeof DelegationStatus.REJECTED;
      reason: DumeRejectionReason;
      ownerNotice: string;
    }
  | { status: typeof DelegationStatus.UNAVAILABLE; reason: string; ownerNotice: string };

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class DumeDelegationService {
  private readonly logger = new Logger(DumeDelegationService.name);

  constructor(
    @Inject(DUME_CLIENT) private readonly client: DumeClientPort,
    @Inject(DELEGATION_STORE) private readonly store: DelegationStorePort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
  ) {}

  async delegate({ chatId, updateId, question }: DelegationRequest): Promise<DelegationOutcome> {
    const requestId = delegationRequestId(updateId);
    try {
      const claim = await this.store.claimInFlight(chatId, requestId);
      if (!claim.claimed) {
        return {
          status: DelegationStatus.ALREADY_RUNNING,
          ownerNotice: DUME_ALREADY_RUNNING_NOTICE,
        };
      }
      return await this.submit(chatId, requestId, question);
    } catch (error) {
      this.logger.warn({
        message: 'dume_delegation.unavailable',
        requestId,
        reason: error instanceof DumeUnavailableError ? error.reason : errorName(error),
      });
      await this.releaseQuietly(chatId, requestId);
      return {
        status: DelegationStatus.UNAVAILABLE,
        reason: error instanceof DumeUnavailableError ? error.reason : 'internal_error',
        ownerNotice: DUME_UNAVAILABLE_NOTICE,
      };
    }
  }

  private async submit(
    chatId: string,
    requestId: string,
    question: string,
  ): Promise<DelegationOutcome> {
    const result = await this.client.submit({ requestId, question, ref: DUME_DEFAULT_REF });
    if (result.kind === DumeSubmitKind.REJECTED) {
      await this.store.releaseInFlight(chatId, requestId);
      this.logger.warn({ message: 'dume_delegation.rejected', requestId, reason: result.reason });
      return {
        status: DelegationStatus.REJECTED,
        reason: result.reason,
        ownerNotice: DUME_REJECTION_NOTICE[result.reason],
      };
    }
    if (result.kind === DumeSubmitKind.CONFLICT) {
      return {
        status: DelegationStatus.ALREADY_STARTED,
        requestId,
        ownerNotice: DUME_ALREADY_STARTED_NOTICE,
      };
    }
    await this.queue.scheduleDumeFollowUp(
      { chatId, requestId, createdAtMs: result.request.createdAtMs, attempt: 1 },
      DUME_FOLLOW_UP_FIRST_DELAY_MS,
    );
    this.logger.log({ message: 'dume_delegation.accepted', requestId, created: result.created });
    return result.created
      ? { status: DelegationStatus.STARTED, requestId, ownerNotice: DUME_STARTED_NOTICE }
      : {
          status: DelegationStatus.ALREADY_STARTED,
          requestId,
          ownerNotice: DUME_ALREADY_STARTED_NOTICE,
        };
  }

  private async releaseQuietly(chatId: string, requestId: string): Promise<void> {
    try {
      await this.store.releaseInFlight(chatId, requestId);
    } catch (error) {
      this.logger.warn({
        message: 'dume_delegation.release_failed',
        requestId,
        reason: errorName(error),
      });
    }
  }
}
