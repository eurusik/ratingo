/**
 * Evaluate Item Handler
 *
 * Evaluates a single media item against a policy.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';

import { RunStatus } from '../../../domain/constants/evaluation.constants';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
} from '../../../domain/repositories';
import { CatalogEvaluationService } from '../../services/catalog-evaluation.service';
import type {
  EvaluateCatalogItemPayload,
  EvaluateItemAttemptInfo,
  ErrorSampleEntry,
} from '../types/job-payloads';
import { validateContextPayload } from '../utils/context-validator';

const ERROR_STACK_MAX_LENGTH = 500;

@Injectable()
export class EvaluateItemHandler {
  private readonly logger = new Logger(EvaluateItemHandler.name);

  constructor(
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    private readonly evaluationService: CatalogEvaluationService,
  ) {}

  /**
   * Handles EVALUATE_CATALOG_ITEM job.
   * Evaluates single media item and writes result.
   *
   * On failure the error is rethrown so BullMQ retries the job with backoff. The error is
   * recorded on the run only on the final attempt, so the run counts it toward completion
   * (see RunFinalizeService) instead of staying RUNNING forever.
   *
   * @param attempt - Retry info from the worker; when omitted the call is treated as final
   */
  async handle(payload: EvaluateCatalogItemPayload, attempt?: EvaluateItemAttemptInfo): Promise<void> {
    const { runId, policyVersion, mediaItemId, context } = payload;

    if (!validateContextPayload(payload, { runId, policyVersion, mediaItemId }, this.logger)) {
      return;
    }

    const run = await this.runRepository.findById(runId);
    if (!run) {
      this.logger.warn(`Run ${runId} not found, skipping item ${mediaItemId}`);
      return;
    }

    if (run.status === RunStatus.CANCELLED) {
      this.logger.debug(`Run ${runId} cancelled, skipping item ${mediaItemId}`);
      return;
    }

    try {
      await this.evaluationService.evaluateOne({
        mediaItemId,
        policyVersion,
        runId,
        context,
      });

      this.logger.debug(`Evaluated ${mediaItemId} for run ${runId} (context: ${context})`);
    } catch (error: unknown) {
      if (attempt && !attempt.isFinalAttempt) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Evaluation attempt failed for ${mediaItemId} (run ${runId}, context ${context}), will retry: ${err.message}`,
        );
        throw err;
      }

      await this.recordError(runId, mediaItemId, error);
    }
  }

  /**
   * Records evaluation error for visibility in run status.
   */
  private async recordError(runId: string, mediaItemId: string, error: unknown): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));

    this.logger.error(`Failed to evaluate media item`, {
      runId,
      mediaItemId,
      errorMessage: err.message,
      errorName: err.name,
    });
    this.logger.debug(`Stack trace for ${mediaItemId}:`, err.stack);

    const errorEntry: ErrorSampleEntry = {
      mediaItemId,
      error: err.message,
      stack: err.stack?.substring(0, ERROR_STACK_MAX_LENGTH),
      timestamp: new Date().toISOString(),
    };

    await this.runRepository.recordError(runId, errorEntry);
  }
}
