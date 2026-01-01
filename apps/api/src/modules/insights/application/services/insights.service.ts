import { Inject, Injectable } from '@nestjs/common';

import {
  INSIGHTS_REPOSITORY,
  type InsightsRepository,
} from '../../domain/repositories/insights.repository.interface';
import { type RiseFallQuery, type RiseFallResult } from '../types/insights.types';

// Window size mappings in days
const WINDOW_DAYS = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
} as const;

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Provides insights about watcher movements for media.
 *
 * Delegates aggregation logic to the insights repository and exposes
 * a simple API for getting biggest risers and fallers over a time window.
 */
@Injectable()
export class InsightsService {
  constructor(
    @Inject(INSIGHTS_REPOSITORY)
    private readonly insightsRepository: InsightsRepository,
  ) {}

  /**
   * Gets biggest risers and fallers for the requested window.
   *
   * @param {RiseFallQuery} query - Query options (window, limit)
   * @returns {Promise<RiseFallResult>} Movements data for the given window
   */
  async getMovements(query: RiseFallQuery): Promise<RiseFallResult> {
    const windowDays = WINDOW_DAYS[query.window as keyof typeof WINDOW_DAYS] || DEFAULT_WINDOW_DAYS;

    const { risers, fallers } = await this.insightsRepository.getMovements(windowDays, query.limit);

    return {
      window: query.window,
      region: 'global',
      metric: 'delta',
      risers,
      fallers,
    };
  }
}
