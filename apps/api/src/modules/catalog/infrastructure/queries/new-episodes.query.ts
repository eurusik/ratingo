import { Inject, Injectable, Logger } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { TRENDING_THRESHOLDS } from '../../domain/constants/catalog.constants';

/**
 * New episode item for the update feed.
 * Grouped by show - one entry per show with the latest episode.
 */
export interface NewEpisodeItem {
  /** Media item ID (from media_items table, not shows.id) */
  mediaItemId: string;
  slug: string;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  airDate: Date;
}

/**
 * Raw row from the new episodes query.
 */
interface NewEpisodeRow {
  media_item_id: string;
  slug: string;
  title: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  air_date: Date;
  [key: string]: unknown;
}

/**
 * Fetches shows with new episodes within a date range.
 * Groups by show and returns only the latest episode per show.
 *
 * Uses PostgreSQL DISTINCT ON for efficient grouping with index support.
 * Requires index: (show_id, air_date DESC, number DESC)
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class NewEpisodesQuery {
  private readonly logger = new Logger(NewEpisodesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the new episodes query.
   *
   * @param {number} days - Number of days to look back (default: 7)
   * @param {number} limit - Max number of shows to return (default: 20)
   * @returns {Promise<NewEpisodeItem[]>} Shows with new episodes
   * @throws {DatabaseException} When database query fails
   */
  async execute(days: number = 7, limit: number = DEFAULT_PAGE_SIZE): Promise<NewEpisodeItem[]> {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    // Convert to ISO strings for proper PostgreSQL timestamp handling
    const startDateStr = startDate.toISOString();
    const nowStr = now.toISOString();

    return withDbError(
      'fetch new episodes',
      this.logger,
      async () => {
        // Strategy: CTE first narrows to eligible trending shows, then joins episodes
        // This gives Postgres a much smaller set to work with before the heavy episode scan
        //
        // eligible CTE: shows that are ELIGIBLE in TRENDING context AND pass trending hard gate
        // main query: DISTINCT ON to get latest episode per show, then sort and limit
        const result = await this.db.execute<NewEpisodeRow>(sql`
        WITH active_policy AS (
          SELECT version
          FROM ${schema.catalogPolicies}
          WHERE is_active = true
          LIMIT 1
        ),
        eligible AS (
          SELECT 
            sh.id AS show_id, 
            sh.media_item_id,
            mi.slug,
            mi.title,
            mi.poster_path
          FROM ${schema.shows} sh
          INNER JOIN ${schema.mediaItems} mi ON mi.id = sh.media_item_id
          INNER JOIN active_policy ap ON true
          INNER JOIN ${schema.mediaCatalogEvaluations} mce 
            ON mce.media_item_id = mi.id 
            AND mce.policy_version = ap.version
            AND mce.context = ${EvaluationContext.TRENDING}
            AND mce.status = ${EligibilityStatus.ELIGIBLE}
          LEFT JOIN ${schema.mediaStats} ms ON ms.media_item_id = mi.id
          WHERE mi.type = 'show'
            AND COALESCE(ms.freshness_score, 0) >= ${TRENDING_THRESHOLDS.MIN_FRESHNESS}
        )
        SELECT media_item_id, slug, title, poster_path, season_number, episode_number, episode_title, air_date
        FROM (
          SELECT DISTINCT ON (el.show_id)
            el.media_item_id,
            el.slug,
            el.title,
            el.poster_path,
            s.number AS season_number,
            e.number AS episode_number,
            e.title AS episode_title,
            e.air_date
          FROM eligible el
          INNER JOIN ${schema.episodes} e ON e.show_id = el.show_id
          INNER JOIN ${schema.seasons} s ON s.id = e.season_id AND s.show_id = el.show_id
          WHERE e.air_date >= ${startDateStr}::timestamptz
            AND e.air_date <= ${nowStr}::timestamptz
            AND e.air_date IS NOT NULL
          ORDER BY el.show_id, e.air_date DESC, e.number DESC
        ) sub
        ORDER BY air_date DESC, episode_number DESC, media_item_id
        LIMIT ${limit}
      `);

        // Handle both array and {rows: []} response formats from drizzle
        const rows: NewEpisodeRow[] = Array.isArray(result)
          ? result
          : ((result as { rows?: NewEpisodeRow[] }).rows ?? []);

        return rows.map((row) => ({
          mediaItemId: row.media_item_id,
          slug: row.slug,
          title: row.title,
          posterPath: row.poster_path,
          seasonNumber: row.season_number,
          episodeNumber: row.episode_number,
          episodeTitle: row.episode_title ?? `Episode ${row.episode_number}`,
          airDate: row.air_date,
        }));
      },
      { days, limit },
    );
  }
}
