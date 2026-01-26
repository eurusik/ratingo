/**
 * Diff Repository
 *
 * Infrastructure implementation of IDiffRepository.
 * Computes diff data between policy versions using SQL aggregation.
 */

import { Injectable, Inject } from '@nestjs/common';

import { sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EligibilityStatus,
  DIFF_STATUS_NONE,
  type DiffStatus,
} from '../../domain/constants/evaluation.constants';
import { type IDiffRepository } from '../../domain/repositories/diff.repository.interface';
import {
  type DiffCounts,
  type DiffSample,
  type ReasonBreakdown,
} from '../../domain/types/diff.types';

@Injectable()
export class DiffRepository implements IDiffRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Builds SQL filter for baseline policy version.
   * Returns FALSE when baselineVersion is null to get empty result set.
   */
  private buildBaselineFilter(baselineVersion: number | null): SQL {
    return baselineVersion !== null ? sql`policy_version = ${baselineVersion}` : sql`FALSE`;
  }

  /**
   * Computes aggregated diff counts using SQL aggregation.
   *
   * Uses FULL OUTER JOIN to handle cases where media items exist in one version but not the other
   * (e.g., new items added, old items deleted between evaluations).
   *
   * When baselineVersion is NULL (no active policy), old_evals CTE will be empty and all items
   * from new_evals will be counted as improvements (old_status = 'none').
   */
  async computeDiffCounts(
    targetVersion: number,
    baselineVersion: number | null,
  ): Promise<DiffCounts> {
    const baselineFilter = this.buildBaselineFilter(baselineVersion);

    // Note: Uses idx_media_catalog_evaluations_version_item_status index
    const result = await this.db.execute<{
      regressions: string;
      improvements: string;
      unchanged: string;
      still_ineligible: string;
    }>(sql`
      WITH old_evals AS (
        SELECT media_item_id, status
        FROM media_catalog_evaluations
        WHERE ${baselineFilter}
      ),
      new_evals AS (
        SELECT media_item_id, status
        FROM media_catalog_evaluations
        WHERE policy_version = ${targetVersion}
      ),
      diff AS (
        SELECT
          COALESCE(o.status::text, ${DIFF_STATUS_NONE}) as old_status,
          COALESCE(n.status::text, ${DIFF_STATUS_NONE}) as new_status
        FROM old_evals o
        FULL OUTER JOIN new_evals n ON o.media_item_id = n.media_item_id
      )
      SELECT
        COUNT(*) FILTER (WHERE old_status = ${EligibilityStatus.ELIGIBLE} AND new_status IN (${EligibilityStatus.INELIGIBLE}, ${DIFF_STATUS_NONE}))::int as regressions,
        COUNT(*) FILTER (WHERE old_status IN (${EligibilityStatus.INELIGIBLE}, ${DIFF_STATUS_NONE}) AND new_status = ${EligibilityStatus.ELIGIBLE})::int as improvements,
        COUNT(*) FILTER (WHERE old_status = ${EligibilityStatus.ELIGIBLE} AND new_status = ${EligibilityStatus.ELIGIBLE})::int as unchanged,
        COUNT(*) FILTER (WHERE old_status != ${EligibilityStatus.ELIGIBLE} AND new_status != ${EligibilityStatus.ELIGIBLE})::int as still_ineligible
      FROM diff
    `);

    const row = result[0];
    return {
      regressions: parseInt(row?.regressions ?? '0', 10),
      improvements: parseInt(row?.improvements ?? '0', 10),
      unchanged: parseInt(row?.unchanged ?? '0', 10),
      stillIneligible: parseInt(row?.still_ineligible ?? '0', 10),
    };
  }

  /**
   * Gets sample items for a specific diff type using SQL-based filtering.
   * Uses LIMIT to avoid loading all data into memory.
   */
  async getDiffSamples(
    targetVersion: number,
    baselineVersion: number | null,
    type: 'regression' | 'improvement',
    limit: number,
  ): Promise<DiffSample[]> {
    const baselineFilter = this.buildBaselineFilter(baselineVersion);
    const diffFilter = this.buildDiffTypeFilter(type);

    const result = await this.db.execute<{
      media_item_id: string;
      title: string | null;
      old_status: string;
      new_status: string;
      trending_score: number | null;
    }>(sql`
      WITH old_evals AS (
        SELECT media_item_id, status
        FROM media_catalog_evaluations
        WHERE ${baselineFilter}
      ),
      new_evals AS (
        SELECT media_item_id, status
        FROM media_catalog_evaluations
        WHERE policy_version = ${targetVersion}
      ),
      diff AS (
        SELECT
          COALESCE(o.media_item_id, n.media_item_id) as media_item_id,
          COALESCE(o.status::text, ${DIFF_STATUS_NONE}) as old_status,
          COALESCE(n.status::text, ${DIFF_STATUS_NONE}) as new_status
        FROM old_evals o
        FULL OUTER JOIN new_evals n ON o.media_item_id = n.media_item_id
      )
      SELECT
        d.media_item_id,
        m.title,
        d.old_status,
        d.new_status,
        m.trending_score
      FROM diff d
      LEFT JOIN media_items m ON m.id = d.media_item_id
      WHERE ${diffFilter}
      ORDER BY m.trending_score DESC NULLS LAST
      LIMIT ${limit}
    `);

    return result.map((row) => ({
      mediaItemId: row.media_item_id,
      title: row.title,
      oldStatus: row.old_status as DiffStatus,
      newStatus: row.new_status as DiffStatus,
      trendingScore: row.trending_score,
    }));
  }

  /**
   * Builds SQL filter for diff type (regression or improvement).
   */
  private buildDiffTypeFilter(type: 'regression' | 'improvement'): SQL {
    if (type === 'regression') {
      return sql`
        old_status = ${EligibilityStatus.ELIGIBLE}
        AND new_status IN (${EligibilityStatus.INELIGIBLE}, ${DIFF_STATUS_NONE})
      `;
    }
    return sql`
      old_status IN (${EligibilityStatus.INELIGIBLE}, ${DIFF_STATUS_NONE})
      AND new_status = ${EligibilityStatus.ELIGIBLE}
    `;
  }

  /**
   * Computes breakdown of reasons for regressions and improvements.
   */
  async computeReasonBreakdown(
    targetVersion: number,
    baselineVersion: number | null,
  ): Promise<ReasonBreakdown> {
    const baselineFilter = this.buildBaselineFilter(baselineVersion);

    const result = await this.db.execute<{
      diff_type: string;
      reason: string;
      count: string;
    }>(sql`
      WITH old_evals AS (
        SELECT media_item_id, status
        FROM media_catalog_evaluations
        WHERE ${baselineFilter}
      ),
      new_evals AS (
        SELECT media_item_id, status, reasons
        FROM media_catalog_evaluations
        WHERE policy_version = ${targetVersion}
      ),
      diff AS (
        SELECT
          COALESCE(o.status::text, ${DIFF_STATUS_NONE}) as old_status,
          COALESCE(n.status::text, ${DIFF_STATUS_NONE}) as new_status,
          n.reasons
        FROM old_evals o
        FULL OUTER JOIN new_evals n ON o.media_item_id = n.media_item_id
      ),
      regressions AS (
        SELECT unnest(reasons) as reason
        FROM diff
        WHERE old_status = ${EligibilityStatus.ELIGIBLE}
          AND new_status IN (${EligibilityStatus.INELIGIBLE}, ${DIFF_STATUS_NONE})
      ),
      improvements AS (
        SELECT unnest(reasons) as reason
        FROM diff
        WHERE old_status IN (${EligibilityStatus.INELIGIBLE}, ${DIFF_STATUS_NONE})
          AND new_status = ${EligibilityStatus.ELIGIBLE}
      )
      SELECT 'regression' as diff_type, reason, COUNT(*)::int as count
      FROM regressions
      GROUP BY reason
      UNION ALL
      SELECT 'improvement' as diff_type, reason, COUNT(*)::int as count
      FROM improvements
      GROUP BY reason
    `);

    const regressionReasons: Record<string, number> = {};
    const improvementReasons: Record<string, number> = {};

    for (const row of result) {
      const count = parseInt(row.count, 10);
      if (row.diff_type === 'regression') {
        regressionReasons[row.reason] = count;
      } else {
        improvementReasons[row.reason] = count;
      }
    }

    return { regressionReasons, improvementReasons };
  }
}
