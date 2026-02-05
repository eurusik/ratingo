import { CATALOG_DEFAULT_LIMIT, CATALOG_DEFAULT_OFFSET } from '../../../../common/constants';
import type { OffsetPaginationMeta } from '../../../../common/dtos/pagination.dto';

/**
 * Source data for pagination meta calculation.
 * Represents an array-like result with optional total count.
 */
interface PaginationSource {
  length: number;
  total?: number;
}

/**
 * Builds pagination meta from query parameters and result array.
 *
 * @param query - Query with limit/offset (uses defaults if not provided)
 * @param result - Result array with length and optional total count
 * @returns Pagination metadata for API response
 */
export function buildPaginationMeta(
  query: { limit?: number; offset?: number },
  result: PaginationSource,
): OffsetPaginationMeta {
  const limit = query.limit ?? CATALOG_DEFAULT_LIMIT;
  const offset = query.offset ?? CATALOG_DEFAULT_OFFSET;
  const total = result.total ?? result.length;

  return {
    count: result.length,
    total,
    limit,
    offset,
    hasMore: offset + result.length < total,
  };
}
