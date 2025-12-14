import { RiseFallItemDto } from '../../presentation/dtos/insights.dto';

/**
 * Repository contract for Insights data.
 */
export interface InsightsRepository {
  /**
   * Returns biggest risers and fallers by watchers delta.
   *
   * @param {number} windowDays - Window size in days
   * @param {number} limit - Max items per group
   * @returns {Promise<{ risers: RiseFallItemDto[]; fallers: RiseFallItemDto[] }>} Movements payload
   */
  getMovements(
    windowDays: number,
    limit: number,
  ): Promise<{ risers: RiseFallItemDto[]; fallers: RiseFallItemDto[] }>;
}

/**
 * Injection token for the Insights repository.
 */
export const INSIGHTS_REPOSITORY = Symbol('INSIGHTS_REPOSITORY');
