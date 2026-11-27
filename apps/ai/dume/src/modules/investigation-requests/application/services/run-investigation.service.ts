import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, RunTrigger, type ClockPort } from '@ratingo/ai-core';

import { SNAPSHOT_CONFIG, type SnapshotConfig } from '../../../../config/config.constants';
import { InvestigationService } from '../../../investigation/public';
import {
  FailureReason,
  RequestState,
  TERMINAL_STATES,
} from '../../domain/constants/request.constants';
import { DAY_LIMITS, type DayLimitsPort } from '../../domain/ports/day-limits.port';
import { REQUEST_STORE, type RequestStorePort } from '../../domain/ports/request-store.port';
import { failRecord, finishRecord } from '../mappers/outcome-record.mapper';

export const RunResult = {
  MISSING: 'missing',
  SKIPPED: 'skipped',
  FINISHED: 'finished',
  FAILED: 'failed',
} as const;
export type RunResult = (typeof RunResult)[keyof typeof RunResult];

const LOCAL_REPOSITORY_LABEL = 'local-checkout';

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class RunInvestigationService {
  private readonly logger = new Logger(RunInvestigationService.name);

  constructor(
    @Inject(REQUEST_STORE) private readonly store: RequestStorePort,
    @Inject(DAY_LIMITS) private readonly limits: DayLimitsPort,
    @Inject(SNAPSHOT_CONFIG) private readonly snapshot: SnapshotConfig,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly investigations: InvestigationService,
  ) {}

  async run(requestId: string): Promise<RunResult> {
    const record = await this.store.find(requestId);
    if (record === null) {
      this.logger.warn({ message: 'investigation_request.missing', requestId });
      return RunResult.MISSING;
    }
    if (TERMINAL_STATES.includes(record.state)) return RunResult.SKIPPED;
    if ((await this.limits.spentTodayUsd()) >= this.limits.dayBudgetUsd()) {
      await this.store.save(failRecord(record, FailureReason.DAY_BUDGET, this.clock.nowMs()));
      this.logger.warn({ message: 'investigation_request.failed', requestId, reason: FailureReason.DAY_BUDGET });
      return RunResult.FAILED;
    }
    const running = { ...record, state: RequestState.RUNNING, startedAtMs: this.clock.nowMs() };
    await this.store.save(running);
    try {
      const outcome = await this.investigations.investigate({
        question: record.question,
        ref: record.ref,
        trigger: RunTrigger.CHAT,
      });
      const finished = finishRecord(running, outcome, this.repositoryLabel(), this.clock.nowMs());
      await this.store.save(finished);
      this.logger.log({
        message: 'investigation_request.finished',
        requestId,
        state: finished.state,
        reason: finished.reason ?? null,
      });
      return RunResult.FINISHED;
    } catch (error) {
      this.logger.error({
        message: 'investigation_request.failed',
        requestId,
        reason: FailureReason.INTERNAL_ERROR,
        errorName: errorName(error),
      });
      await this.store.save(failRecord(running, FailureReason.INTERNAL_ERROR, this.clock.nowMs()));
      return RunResult.FAILED;
    }
  }

  async markInterrupted(requestId: string): Promise<void> {
    const record = await this.store.find(requestId);
    if (record === null || TERMINAL_STATES.includes(record.state)) return;
    await this.store.save(failRecord(record, FailureReason.INTERRUPTED, this.clock.nowMs()));
    this.logger.warn({
      message: 'investigation_request.failed',
      requestId,
      reason: FailureReason.INTERRUPTED,
    });
  }

  private repositoryLabel(): string {
    return this.snapshot.kind === 'github' ? this.snapshot.repository : LOCAL_REPOSITORY_LABEL;
  }
}
