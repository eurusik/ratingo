import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import {
  DUME_DEFAULT_REF,
  DUME_FOLLOW_UP_FIRST_DELAY_MS,
  DUME_SCHEDULE_ATTEMPTS,
  DelegationStatus,
} from '../../domain/constants/dume.constants';
import {
  DUME_ALREADY_RUNNING_NOTICE,
  DUME_ALREADY_STARTED_NOTICE,
  DUME_REJECTION_NOTICE,
  DUME_STARTED_NOTICE,
  DUME_UNAVAILABLE_NOTICE,
  DUME_UNCONFIRMED_NOTICE,
  DUME_UNTRACKED_NOTICE,
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
  StartCertainty,
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
  | { status: typeof DelegationStatus.UNAVAILABLE; reason: string; ownerNotice: string }
  | { status: typeof DelegationStatus.UNCONFIRMED; requestId: string; ownerNotice: string }
  | { status: typeof DelegationStatus.UNTRACKED; requestId: string; ownerNotice: string };

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class DumeDelegationService {
  private readonly logger = new Logger(DumeDelegationService.name);

  constructor(
    @Inject(DUME_CLIENT) private readonly client: DumeClientPort,
    @Inject(DELEGATION_STORE) private readonly store: DelegationStorePort,
    @Inject(CHAT_JOB_QUEUE) private readonly queue: ChatJobQueuePort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async delegate({ chatId, updateId, question }: DelegationRequest): Promise<DelegationOutcome> {
    const requestId = delegationRequestId(updateId);
    const claimed = await this.claimChat(chatId, requestId);
    if (claimed !== null) return claimed;
    try {
      const result = await this.client.submit({ requestId, question, ref: DUME_DEFAULT_REF });
      return await this.afterSubmit(chatId, requestId, result);
    } catch (error) {
      return this.afterSubmitFailure(chatId, requestId, error);
    }
  }

  private async claimChat(chatId: string, requestId: string): Promise<DelegationOutcome | null> {
    try {
      const claim = await this.store.claimInFlight(chatId, requestId);
      return claim.claimed
        ? null
        : { status: DelegationStatus.ALREADY_RUNNING, ownerNotice: DUME_ALREADY_RUNNING_NOTICE };
    } catch (error) {
      this.logger.warn({
        message: 'dume_delegation.claim_failed',
        requestId,
        reason: errorName(error),
      });
      return {
        status: DelegationStatus.UNAVAILABLE,
        reason: 'internal_error',
        ownerNotice: DUME_UNAVAILABLE_NOTICE,
      };
    }
  }

  private async afterSubmit(
    chatId: string,
    requestId: string,
    result: Awaited<ReturnType<DumeClientPort['submit']>>,
  ): Promise<DelegationOutcome> {
    if (result.kind === DumeSubmitKind.REJECTED) {
      await this.releaseQuietly(chatId, requestId);
      this.logger.log({ message: 'dume_delegation.rejected', requestId, reason: result.reason });
      return {
        status: DelegationStatus.REJECTED,
        reason: result.reason,
        ownerNotice: DUME_REJECTION_NOTICE[result.reason],
      };
    }
    const createdAtMs =
      result.kind === DumeSubmitKind.ACCEPTED ? result.request.createdAtMs : this.clock.nowMs();
    const created = result.kind === DumeSubmitKind.ACCEPTED && result.created;
    if (!(await this.track(chatId, requestId, createdAtMs)))
      return this.untracked(chatId, requestId);
    this.logger.log({ message: 'dume_delegation.accepted', requestId, created });
    return created
      ? { status: DelegationStatus.STARTED, requestId, ownerNotice: DUME_STARTED_NOTICE }
      : {
          status: DelegationStatus.ALREADY_STARTED,
          requestId,
          ownerNotice: DUME_ALREADY_STARTED_NOTICE,
        };
  }

  private async afterSubmitFailure(
    chatId: string,
    requestId: string,
    error: unknown,
  ): Promise<DelegationOutcome> {
    const reason = error instanceof DumeUnavailableError ? error.reason : errorName(error);
    this.logger.warn({ message: 'dume_delegation.unavailable', requestId, reason });
    const mayHaveStarted =
      error instanceof DumeUnavailableError && error.certainty === StartCertainty.MAYBE_STARTED;
    if (!mayHaveStarted) {
      await this.releaseQuietly(chatId, requestId);
      return { status: DelegationStatus.UNAVAILABLE, reason, ownerNotice: DUME_UNAVAILABLE_NOTICE };
    }
    if (!(await this.track(chatId, requestId, this.clock.nowMs()))) {
      return this.untracked(chatId, requestId);
    }
    return {
      status: DelegationStatus.UNCONFIRMED,
      requestId,
      ownerNotice: DUME_UNCONFIRMED_NOTICE,
    };
  }

  private async track(chatId: string, requestId: string, createdAtMs: number): Promise<boolean> {
    for (let attempt = 1; attempt <= DUME_SCHEDULE_ATTEMPTS; attempt += 1) {
      try {
        await this.queue.scheduleDumeFollowUp(
          { chatId, requestId, createdAtMs, attempt: 1 },
          DUME_FOLLOW_UP_FIRST_DELAY_MS,
        );
        return true;
      } catch (error) {
        this.logger.error({
          message: 'dume_delegation.schedule_failed',
          requestId,
          attempt,
          reason: errorName(error),
        });
      }
    }
    return false;
  }

  private async untracked(chatId: string, requestId: string): Promise<DelegationOutcome> {
    await this.releaseQuietly(chatId, requestId);
    return { status: DelegationStatus.UNTRACKED, requestId, ownerNotice: DUME_UNTRACKED_NOTICE };
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
