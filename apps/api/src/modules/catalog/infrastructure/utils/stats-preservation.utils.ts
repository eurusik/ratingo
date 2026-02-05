import { sql, type SQL } from 'drizzle-orm';

import * as schema from '../../../../database/schema';

/**
 * Creates SQL CASE expression that preserves existing positive value
 * when new value is 0.
 *
 * Business rule: A popular item suddenly having 0 watchers is almost always
 * an API error, not a real drop to zero. This safeguard prevents data corruption.
 *
 * @param newValue - New value to insert
 * @returns SQL expression that preserves existing positive value when new is 0
 *
 * @example
 * // If existing = 1000 and new = 0 → keeps 1000
 * // If existing = 1000 and new = 500 → updates to 500
 * // If existing = 0 and new = 0 → stays 0
 */
export function preserveTotalWatchers(newValue: number): SQL<unknown> {
  return sql`
    CASE
      WHEN ${newValue} = 0 AND ${schema.mediaStats.totalWatchers} > 0
      THEN ${schema.mediaStats.totalWatchers}
      ELSE ${newValue}
    END
  `;
}
