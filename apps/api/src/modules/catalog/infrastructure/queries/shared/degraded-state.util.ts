import type { TrendingQueryResult, TrendingQueryMeta } from '../../../domain/types/query.types';

/**
 * Creates a degraded response for trending queries.
 * Used when evaluation data is incomplete or missing.
 *
 * @param reason - Human-readable reason for degraded state
 * @returns Empty result array with degraded meta
 */
export function createDegradedResponse<T>(reason: string): TrendingQueryResult<T> {
  const result: TrendingQueryResult<T> = [] as TrendingQueryResult<T>;
  result.total = 0;
  result.meta = {
    degraded: true,
    degradedReason: reason,
  };
  return result;
}

/**
 * Creates success metadata for trending queries.
 * Indicates the response is not in a degraded state.
 */
export function createSuccessMeta(): TrendingQueryMeta {
  return { degraded: false };
}
