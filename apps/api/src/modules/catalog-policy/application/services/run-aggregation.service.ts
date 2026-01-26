/**
 * Run Aggregation Service
 *
 * Provides derived counters from evaluations table (source of truth).
 *
 * Note: Per Readability & Pending Reform, PENDING is no longer returned by Policy Engine.
 * The pending counter is always 0 for policy runs. PENDING status only exists in
 * ingestion layer (ingestion_status field) as "not ready for evaluation".
 */

import { Injectable, Inject } from '@nestjs/common';

import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
} from '../../domain/repositories';
import { type AggregatedCounters } from '../../domain/types';

@Injectable()
export class RunAggregationService {
  constructor(
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
  ) {}

  /**
   * Aggregates counters from evaluations table for a specific run.
   *
   * Note: Per Readability & Pending Reform, pending is always 0.
   * @param runId - Run identifier
   * @returns Aggregated counters
   */
  async aggregateCounters(runId: string): Promise<AggregatedCounters> {
    return this.runRepository.aggregateCounters(runId);
  }

  /**
   * Syncs cached counters with actual aggregated values.
   *
   * @param runId - Run identifier
   * @returns Synced counters
   */
  async syncRunCounters(runId: string): Promise<AggregatedCounters> {
    return this.runRepository.syncRunCounters(runId);
  }
}
