import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import {
  FailureReason,
  MAX_WAITING_REQUESTS,
  RECORD_VERSION,
  RequestState,
  type RejectionReason,
} from '../../domain/constants/request.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';
import { decideAdmission } from '../../domain/policies/admission.policy';
import { DAY_LIMITS, type DayLimitsPort } from '../../domain/ports/day-limits.port';
import {
  INVESTIGATION_QUEUE,
  type InvestigationQueuePort,
} from '../../domain/ports/investigation-queue.port';
import {
  CreateOutcome,
  REQUEST_STORE,
  type RequestStorePort,
} from '../../domain/ports/request-store.port';
import { failRecord } from '../mappers/outcome-record.mapper';

export interface Submission {
  requestId: string;
  question: string;
  ref: string;
}

export const SubmitKind = {
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CONFLICT: 'conflict',
} as const;

export type SubmitResult =
  | { kind: typeof SubmitKind.ACCEPTED; created: boolean; record: InvestigationRecord }
  | { kind: typeof SubmitKind.REJECTED; reason: RejectionReason }
  | { kind: typeof SubmitKind.CONFLICT };

const isFailedBeforeStart = (record: InvestigationRecord): boolean =>
  record.state === RequestState.FAILED &&
  record.reason === FailureReason.INTERNAL_ERROR &&
  record.startedAtMs === undefined;

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class SubmitInvestigationService {
  private readonly logger = new Logger(SubmitInvestigationService.name);

  constructor(
    @Inject(REQUEST_STORE) private readonly store: RequestStorePort,
    @Inject(INVESTIGATION_QUEUE) private readonly queue: InvestigationQueuePort,
    @Inject(DAY_LIMITS) private readonly limits: DayLimitsPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async submit(submission: Submission): Promise<SubmitResult> {
    const existing = await this.store.find(submission.requestId);
    if (existing !== null) return this.answerForExisting(existing, submission);
    const rejection = await this.admissionDecision();
    if (rejection !== null) {
      this.logger.warn({
        message: 'investigation_request.rejected',
        requestId: submission.requestId,
        reason: rejection,
      });
      return { kind: SubmitKind.REJECTED, reason: rejection };
    }
    const record = this.newRecord(submission);
    if ((await this.store.create(record)) === CreateOutcome.EXISTS) {
      const winner = await this.store.find(submission.requestId);
      return winner === null
        ? { kind: SubmitKind.CONFLICT }
        : this.answerForExisting(winner, submission);
    }
    const accepted = await this.enqueued(record);
    await this.countAccepted(record.requestId);
    return { kind: SubmitKind.ACCEPTED, created: true, record: accepted };
  }

  private async answerForExisting(
    record: InvestigationRecord,
    submission: Submission,
  ): Promise<SubmitResult> {
    const sameRequest = record.question === submission.question && record.ref === submission.ref;
    if (!sameRequest) {
      this.logger.warn({
        message: 'investigation_request.conflict',
        requestId: submission.requestId,
      });
      return { kind: SubmitKind.CONFLICT };
    }
    return { kind: SubmitKind.ACCEPTED, created: false, record: await this.revived(record) };
  }

  private async revived(record: InvestigationRecord): Promise<InvestigationRecord> {
    if (record.state === RequestState.QUEUED) return this.enqueued(record);
    if (!isFailedBeforeStart(record)) return record;
    const fresh: InvestigationRecord = {
      ...record,
      state: RequestState.QUEUED,
      createdAtMs: this.clock.nowMs(),
      reason: undefined,
      finishedAtMs: undefined,
    };
    await this.store.save(fresh);
    this.logger.warn({ message: 'investigation_request.revived', requestId: record.requestId });
    return this.enqueued(fresh);
  }

  private async admissionDecision(): Promise<RejectionReason | null> {
    const [spentTodayUsd, acceptedToday, waiting] = await Promise.all([
      this.limits.spentTodayUsd(),
      this.limits.acceptedToday(),
      this.queue.waitingCount(),
    ]);
    return decideAdmission({
      spentTodayUsd,
      dayBudgetUsd: this.limits.dayBudgetUsd(),
      acceptedToday,
      maxPerDay: this.limits.maxPerDay(),
      waiting,
      maxWaiting: MAX_WAITING_REQUESTS,
    });
  }

  private newRecord(submission: Submission): InvestigationRecord {
    return {
      version: RECORD_VERSION,
      requestId: submission.requestId,
      question: submission.question,
      ref: submission.ref,
      state: RequestState.QUEUED,
      createdAtMs: this.clock.nowMs(),
    };
  }

  private async countAccepted(requestId: string): Promise<void> {
    try {
      await this.limits.countAccepted();
    } catch (error) {
      this.logger.error({
        message: 'investigation_request.count_failed',
        requestId,
        reason: errorName(error),
      });
    }
  }

  private async enqueued(record: InvestigationRecord): Promise<InvestigationRecord> {
    try {
      await this.queue.enqueue({ requestId: record.requestId });
      return record;
    } catch (error) {
      this.logger.error({
        message: 'investigation_request.enqueue_failed',
        requestId: record.requestId,
        reason: errorName(error),
      });
      const failed = failRecord(record, FailureReason.INTERNAL_ERROR, this.clock.nowMs());
      await this.store.finish(failed);
      return failed;
    }
  }
}
