import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, RunTrigger, type ClockPort } from '@ratingo/ai-core';

import { SNAPSHOT_CONFIG, type SnapshotConfig } from '../../../../config/config.constants';
import { InvestigationService } from '../../../investigation/public';
import {
  FailureReason,
  RequestState,
  TERMINAL_STATES,
} from '../../domain/constants/request.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';
import { DAY_LIMITS, type DayLimitsPort } from '../../domain/ports/day-limits.port';
import { REQUEST_STORE, type RequestStorePort } from '../../domain/ports/request-store.port';
import { FINAL_SAVE_DELAYS } from '../../investigation-requests.constants';
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

const wait = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class RunInvestigationService {
  private readonly logger = new Logger(RunInvestigationService.name);

  constructor(
    @Inject(REQUEST_STORE) private readonly store: RequestStorePort,
    @Inject(DAY_LIMITS) private readonly limits: DayLimitsPort,
    @Inject(SNAPSHOT_CONFIG) private readonly snapshot: SnapshotConfig,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly investigations: InvestigationService,
    @Inject(FINAL_SAVE_DELAYS) private readonly finalSaveDelaysMs: readonly number[],
  ) {}

  async run(requestId: string): Promise<RunResult> {
    const record = await this.store.find(requestId);
    if (record === null) {
      this.logger.warn({ message: 'investigation_request.missing', requestId });
      return RunResult.MISSING;
    }
    if (TERMINAL_STATES.includes(record.state)) return RunResult.SKIPPED;
    if ((await this.limits.spentTodayUsd()) >= this.limits.dayBudgetUsd()) {
      await this.store.finish(failRecord(record, FailureReason.DAY_BUDGET, this.clock.nowMs()));
      this.logger.warn({
        message: 'investigation_request.failed',
        requestId,
        reason: FailureReason.DAY_BUDGET,
      });
      return RunResult.FAILED;
    }
    const running = { ...record, state: RequestState.RUNNING, startedAtMs: this.clock.nowMs() };
    await this.store.save(running);
    return this.investigate(running);
  }

  async markInterrupted(requestId: string): Promise<void> {
    const record = await this.store.find(requestId);
    if (record === null || TERMINAL_STATES.includes(record.state)) return;
    await this.store.finish(failRecord(record, FailureReason.INTERRUPTED, this.clock.nowMs()));
    this.logger.warn({
      message: 'investigation_request.failed',
      requestId,
      reason: FailureReason.INTERRUPTED,
    });
  }

  private async investigate(running: InvestigationRecord): Promise<RunResult> {
    const { requestId } = running;
    try {
      const outcome = await this.investigations.investigate({
        question: running.question,
        ref: running.ref,
        trigger: RunTrigger.CHAT,
      });
      const finished = finishRecord(running, outcome, this.repositoryLabel(), this.clock.nowMs());
      await this.saveFinal(finished, outcome.costUsd);
      this.logger.log({
        message: 'investigation_request.finished',
        requestId,
        runId: outcome.runId,
        costUsd: outcome.costUsd,
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
      await this.store.finish(
        failRecord(running, FailureReason.INTERNAL_ERROR, this.clock.nowMs()),
      );
      return RunResult.FAILED;
    }
  }

  private async saveFinal(finished: InvestigationRecord, costUsd: number): Promise<void> {
    let lastError: unknown;
    for (const delayMs of [0, ...this.finalSaveDelaysMs]) {
      await wait(delayMs);
      try {
        await this.store.finish(finished);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    this.logger.error({
      message: 'investigation_request.save_failed',
      requestId: finished.requestId,
      runId: finished.runId ?? null,
      costUsd,
      reason: errorName(lastError),
    });
    throw lastError;
  }

  private repositoryLabel(): string {
    return this.snapshot.kind === 'github' ? this.snapshot.repository : LOCAL_REPOSITORY_LABEL;
  }
}
