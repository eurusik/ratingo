import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type CorruptedWatchersItem,
  type IMediaRepository,
  type MediaSyncItem,
  type SnapshotCandidate,
} from '@/modules/catalog/domain/repositories/media.repository.interface';
import { EligibilityStatus, EvaluationContext } from '@/modules/catalog-policy/public';

import {
  toMediaIdItems,
  buildMissingWatchersConditions,
  buildCorruptedWatchersCountConditions,
  buildSnapshotCandidateConditions,
  buildHeroCandidatesConditions,
  buildHeroCandidatesEvaluationConditions,
} from './shared';

export type SyncCandidateOptions<TMethod extends keyof IMediaRepository> = Parameters<
  IMediaRepository[TMethod]
>[0];

@Injectable()
export class MediaSyncCandidatesQuery {
  private readonly logger = new Logger(MediaSyncCandidatesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Finds items with corrupted total_watchers data.
   * Items where total_watchers = 0 (or null) but have Trakt votes indicate API failure during sync.
   */
  async findItemsWithMissingWatchers(
    options: SyncCandidateOptions<'findItemsWithMissingWatchers'>,
  ): Promise<CorruptedWatchersItem[]> {
    return withDbError(
      'find items with missing watchers',
      this.logger,
      async () => {
        const conditions = buildMissingWatchersConditions({
          type: options.type,
          minVotes: options.minVotes,
        });

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
          })
          .from(schema.mediaItems)
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(and(...conditions))
          .orderBy(desc(schema.mediaItems.voteCountTrakt))
          .limit(options.limit);

        return rows
          .filter((r) => r.voteCountTrakt !== null)
          .map((r) => ({
            id: r.id,
            tmdbId: r.tmdbId,
            type: r.type,
            voteCountTrakt: r.voteCountTrakt!,
          }));
      },
      { type: options.type, limit: options.limit, minVotes: options.minVotes },
    );
  }

  /**
   * Finds items with corrupted watchers_count (live watchers).
   * Items where watchers_count = 0 but total_watchers > minTotalWatchers.
   */
  async findItemsWithCorruptedWatchersCount(
    options: SyncCandidateOptions<'findItemsWithCorruptedWatchersCount'>,
  ): Promise<CorruptedWatchersItem[]> {
    return withDbError(
      'find items with corrupted watchers count',
      this.logger,
      async () => {
        const conditions = buildCorruptedWatchersCountConditions({
          type: options.type,
          minTotalWatchers: options.minTotalWatchers,
        });

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(and(...conditions))
          .orderBy(desc(schema.mediaStats.totalWatchers))
          .limit(options.limit);

        return rows.map((r) => ({
          id: r.id,
          tmdbId: r.tmdbId,
          type: r.type,
          voteCountTrakt: r.voteCountTrakt ?? 0,
        }));
      },
      { type: options.type, limit: options.limit, minTotalWatchers: options.minTotalWatchers },
    );
  }

  /**
   * Finds ELIGIBLE items for trending context that need watchers sync.
   * Only returns items with watchers_count = 0 or NULL (never synced or stale).
   * Used to backfill watchers data for items not in Trakt trending top-100.
   */
  async findEligibleForTrending(
    options: SyncCandidateOptions<'findEligibleForTrending'>,
  ): Promise<MediaSyncItem[]> {
    return withDbError(
      'find eligible items for trending',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
          .innerJoin(
            schema.mediaCatalogEvaluations,
            and(
              eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
              eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
              eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
              eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
            ),
          )
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(
            and(
              isNull(schema.mediaItems.deletedAt),
              isNotNull(schema.mediaItems.tmdbId),
              // Only items that need sync (no watchers data yet)
              sql`(${schema.mediaStats.watchersCount} IS NULL OR ${schema.mediaStats.watchersCount} = 0)`,
              // Keyset pagination: the filtered set shrinks as rows are processed,
              // so OFFSET would skip rows. Resume strictly after the last seen id.
              options.afterId ? gt(schema.mediaItems.id, options.afterId) : undefined,
            ),
          )
          .orderBy(schema.mediaItems.id)
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      { limit: options.limit, afterId: options.afterId },
    );
  }

  /**
   * Retrieves ELIGIBLE media items for snapshots sync with cursor pagination.
   * Filters to items that pass Policy Engine in TRENDING context.
   */
  async findSnapshotCandidates(
    options: SyncCandidateOptions<'findSnapshotCandidates'>,
  ): Promise<SnapshotCandidate[]> {
    return withDbError(
      'find snapshot candidates',
      this.logger,
      async () => {
        // Get active policy version
        const activePolicy = await this.db
          .select({ version: schema.catalogPolicies.version })
          .from(schema.catalogPolicies)
          .where(eq(schema.catalogPolicies.isActive, true))
          .limit(1);

        if (!activePolicy.length) {
          this.logger.warn('No active policy found for snapshot candidates');
          return [];
        }

        const conditions = buildSnapshotCandidateConditions({
          policyVersion: activePolicy[0].version,
          cursor: options.cursor,
          snapshotDate: options.snapshotDate,
          region: options.region,
        });

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .innerJoin(
            schema.mediaCatalogEvaluations,
            eq(schema.mediaCatalogEvaluations.mediaItemId, schema.mediaItems.id),
          )
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      { cursor: options.cursor, limit: options.limit },
    );
  }

  /**
   * Finds homepage candidates with stale stats that need refresh.
   * Targets items that may appear in Hero or Watching-Now sections.
   * Uses configurable quality threshold to cover both (hero@60, watching-now@50).
   */
  async findHeroCandidatesForStatsRefresh(
    options: SyncCandidateOptions<'findHeroCandidatesForStatsRefresh'>,
  ): Promise<MediaSyncItem[]> {
    return withDbError(
      'find homepage candidates for stats refresh',
      this.logger,
      async () => {
        const conditions = buildHeroCandidatesConditions({
          staleThresholdHours: options.staleThresholdHours,
          minQualityScore: options.minQualityScore,
        });

        const evaluationConditions = buildHeroCandidatesEvaluationConditions();

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
          .innerJoin(
            schema.mediaCatalogEvaluations,
            and(
              eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
              ...evaluationConditions,
            ),
          )
          .innerJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
          .leftJoin(schema.shows, eq(schema.mediaItems.id, schema.shows.mediaItemId))
          .where(and(...conditions))
          .orderBy(desc(schema.mediaStats.watchersCount), desc(schema.mediaStats.ratingoScore))
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      {
        staleThresholdHours: options.staleThresholdHours,
        limit: options.limit,
        minQualityScore: options.minQualityScore,
      },
    );
  }
}
