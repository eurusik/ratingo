import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, ne, inArray, and, desc, gt, gte, lt, isNull, isNotNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';
import { type HeroMediaItem } from '@/common/types/hero-media.types';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { type LocalSearchResult } from '@/modules/catalog/domain/models/search-result.model';
import {
  type IMediaRepository,
  type MediaScoreData,
  type MediaWithTmdbId,
  type MediaScoreDataWithTmdbId,
  type CorruptedWatchersItem,
  type MediaSyncItem,
  type SnapshotCandidate,
} from '@/modules/catalog/domain/repositories/media.repository.interface';
import type { NormalizedMedia } from '@/modules/shared/contracts';

import { HeroMediaQuery } from '../queries/hero-media.query';
import { MediaSearchQuery } from '../queries/media-search.query';
import { type MediaStubPayload, MediaStubUpsertQuery } from '../queries/media-stub-upsert.query';
import {
  MediaSyncCandidatesQuery,
  type SyncCandidateOptions,
} from '../queries/media-sync-candidates.query';
import { MediaUpsertQuery } from '../queries/media-upsert.query';
import { toMediaIdItems } from '../queries/shared';

/**
 * Drizzle ORM implementation of the Media Repository.
 * Orchestrates media item persistence with related entities.
 */
@Injectable()
export class DrizzleMediaRepository implements IMediaRepository {
  private readonly logger = new Logger(DrizzleMediaRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly heroMediaQuery: HeroMediaQuery,
    private readonly stubUpsertQuery: MediaStubUpsertQuery,
    private readonly upsertQuery: MediaUpsertQuery,
    private readonly searchQuery: MediaSearchQuery,
    private readonly syncCandidatesQuery: MediaSyncCandidatesQuery,
  ) {}

  /**
   * Retrieves minimal media info (ID, slug) by TMDB ID to check existence.
   * Note: TMDB IDs are unique per type (movie vs show), so type parameter
   * is recommended for correctness when both types might exist.
   *
   * @param tmdbId - TMDB ID
   * @param type - Optional media type for precise lookup
   * @throws {DatabaseException} If database query fails
   */
  async findByTmdbId(
    tmdbId: number,
    type?: MediaType,
  ): Promise<{
    id: string;
    slug: string;
    type: MediaType;
    ingestionStatus: IngestionStatus;
  } | null> {
    return withDbError(
      'find media by TMDB ID',
      this.logger,
      async () => {
        const conditions = [eq(schema.mediaItems.tmdbId, tmdbId)];
        if (type) {
          conditions.push(eq(schema.mediaItems.type, type));
        }

        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            slug: schema.mediaItems.slug,
            type: schema.mediaItems.type,
            ingestionStatus: schema.mediaItems.ingestionStatus,
          })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .limit(1);

        if (!result[0]) return null;
        const row = result[0];
        return {
          ...row,
          ingestionStatus: row.ingestionStatus as IngestionStatus,
        };
      },
      { tmdbId, type },
    );
  }

  /**
   * Updates ingestion status by (type, TMDB ID) (noop if not found).
   * TMDB movie and TV id spaces overlap, so type is required.
   *
   * With `preserveReady`, a READY item is left untouched (conditional UPDATE),
   * so re-syncs/failures never hide an already published item.
   */
  async updateIngestionStatus(
    tmdbId: number,
    type: MediaType,
    status: IngestionStatus,
    options?: { preserveReady?: boolean },
  ): Promise<void> {
    return withDbError(
      'update ingestion status',
      this.logger,
      async () => {
        const conditions = [eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, type)];
        if (options?.preserveReady) {
          conditions.push(ne(schema.mediaItems.ingestionStatus, IngestionStatus.READY));
        }

        await this.db
          .update(schema.mediaItems)
          .set({ ingestionStatus: status, updatedAt: new Date() })
          .where(and(...conditions));
      },
      { tmdbId, type, status, preserveReady: options?.preserveReady ?? false },
    );
  }

  /**
   * Updates only the alternative_titles column for a media item.
   */
  async updateAlternativeTitles(id: string, titles: string[] | null): Promise<void> {
    return withDbError(
      'update alternative titles',
      this.logger,
      async () => {
        await this.db
          .update(schema.mediaItems)
          .set({ alternativeTitles: titles, updatedAt: new Date() })
          .where(eq(schema.mediaItems.id, id));
      },
      { id, titleCount: titles?.length ?? 0 },
    );
  }

  async upsertStub(payload: MediaStubPayload): Promise<{ id: string; slug: string }> {
    return this.stubUpsertQuery.execute(payload);
  }

  async upsert(media: NormalizedMedia): Promise<void> {
    return this.upsertQuery.execute(media);
  }

  /**
   * Retrieves media data needed for score calculation.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findByIdForScoring(id: string): Promise<MediaScoreData | null> {
    return withDbError(
      'find media for scoring',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            popularity: schema.mediaItems.popularity,
            releaseDate: schema.mediaItems.releaseDate,
            lastAirDate: schema.shows.lastAirDate,
            ratingImdb: schema.mediaItems.ratingImdb,
            ratingTrakt: schema.mediaItems.ratingTrakt,
            ratingMetacritic: schema.mediaItems.ratingMetacritic,
            ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
            voteCountImdb: schema.mediaItems.voteCountImdb,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
            watchersCount: schema.mediaStats.watchersCount,
            totalWatchers: schema.mediaStats.totalWatchers,
          })
          .from(schema.mediaItems)
          .leftJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(eq(schema.mediaItems.id, id))
          .limit(1);

        return result[0] || null;
      },
      { id },
    );
  }

  /**
   * Batch: Retrieves multiple media items by TMDB IDs in a single query.
   * Optional `type` restricts the lookup (TMDB movie/TV id spaces overlap).
   *
   * @throws {DatabaseException} If database query fails
   */
  async findManyByTmdbIds(tmdbIds: number[], type?: MediaType): Promise<MediaWithTmdbId[]> {
    if (tmdbIds.length === 0) return [];

    return withDbError(
      'find media by TMDB IDs',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
            alternativeTitles: schema.mediaItems.alternativeTitles,
          })
          .from(schema.mediaItems)
          .where(
            type
              ? and(inArray(schema.mediaItems.tmdbId, tmdbIds), eq(schema.mediaItems.type, type))
              : inArray(schema.mediaItems.tmdbId, tmdbIds),
          );

        return result as MediaWithTmdbId[];
      },
      { count: tmdbIds.length, type },
    );
  }

  /**
   * Batch: Retrieves score data for multiple media items in a single query.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findManyForScoring(ids: string[]): Promise<MediaScoreDataWithTmdbId[]> {
    if (ids.length === 0) return [];

    return withDbError(
      'find media for batch scoring',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
            popularity: schema.mediaItems.popularity,
            releaseDate: schema.mediaItems.releaseDate,
            lastAirDate: schema.shows.lastAirDate,
            ratingImdb: schema.mediaItems.ratingImdb,
            ratingTrakt: schema.mediaItems.ratingTrakt,
            ratingMetacritic: schema.mediaItems.ratingMetacritic,
            ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
            voteCountImdb: schema.mediaItems.voteCountImdb,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
            watchersCount: schema.mediaStats.watchersCount,
            totalWatchers: schema.mediaStats.totalWatchers,
          })
          .from(schema.mediaItems)
          .leftJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(inArray(schema.mediaItems.id, ids));

        return result as MediaScoreDataWithTmdbId[];
      },
      { count: ids.length },
    );
  }

  /**
   * Retrieves top media items for the Hero block.
   *
   * @param {number} limit - Maximum number of items to return
   * @param {MediaType} type - Optional filter by media type
   * @returns {Promise<HeroMediaItem[]>} List of hero-worthy media items
   */
  async findHero(limit: number, type?: MediaType): Promise<HeroMediaItem[]> {
    return this.heroMediaQuery.execute({ limit, type });
  }

  async search(query: string, limit: number): Promise<LocalSearchResult[]> {
    return this.searchQuery.execute(query, limit);
  }

  /**
   * Retrieves media items updated by trending sync since a given date.
   * Used by stats sync to get items that were recently synced.
   */
  async findTrendingUpdatedItems(options: {
    since?: Date;
    limit: number;
  }): Promise<{ id: string; tmdbId: number; type: MediaType }[]> {
    return withDbError(
      'find trending updated items',
      this.logger,
      async () => {
        const conditions = [
          isNull(schema.mediaItems.deletedAt),
          gt(schema.mediaItems.trendingScore, 0),
          isNotNull(schema.mediaItems.tmdbId),
        ];

        if (options.since) {
          conditions.push(gte(schema.mediaItems.trendingUpdatedAt, options.since));
        }

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(desc(schema.mediaItems.trendingScore))
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      { since: options.since?.toISOString(), limit: options.limit },
    );
  }

  /**
   * Retrieves IDs of active media items for snapshots sync with cursor pagination.
   */
  async findIdsForSnapshots(options: { cursor?: string; limit: number }): Promise<string[]> {
    return withDbError(
      'find IDs for snapshots',
      this.logger,
      async () => {
        const conditions = [isNull(schema.mediaItems.deletedAt)];

        if (options.cursor) {
          conditions.push(gt(schema.mediaItems.id, options.cursor));
        }

        const rows = await this.db
          .select({ id: schema.mediaItems.id })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(options.limit);

        return rows.map((r) => r.id);
      },
      { cursor: options.cursor, limit: options.limit },
    );
  }

  /**
   * Retrieves IDs of media items for score recalculation with pagination.
   */
  async findIdsForRecalculation(options: {
    type?: MediaType;
    limit: number;
    offset: number;
  }): Promise<string[]> {
    return withDbError(
      'find IDs for recalculation',
      this.logger,
      async () => {
        const conditions = [isNull(schema.mediaItems.deletedAt)];

        if (options.type) {
          conditions.push(eq(schema.mediaItems.type, options.type));
        }

        const rows = await this.db
          .select({ id: schema.mediaItems.id })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(options.limit)
          .offset(options.offset);

        return rows.map((r) => r.id);
      },
      { type: options.type, limit: options.limit, offset: options.offset },
    );
  }

  async findItemsWithMissingWatchers(
    options: SyncCandidateOptions<'findItemsWithMissingWatchers'>,
  ): Promise<CorruptedWatchersItem[]> {
    return this.syncCandidatesQuery.findItemsWithMissingWatchers(options);
  }

  async findItemsWithCorruptedWatchersCount(
    options: SyncCandidateOptions<'findItemsWithCorruptedWatchersCount'>,
  ): Promise<CorruptedWatchersItem[]> {
    return this.syncCandidatesQuery.findItemsWithCorruptedWatchersCount(options);
  }

  async findEligibleForTrending(
    options: SyncCandidateOptions<'findEligibleForTrending'>,
  ): Promise<MediaSyncItem[]> {
    return this.syncCandidatesQuery.findEligibleForTrending(options);
  }

  async findSnapshotCandidates(
    options: SyncCandidateOptions<'findSnapshotCandidates'>,
  ): Promise<SnapshotCandidate[]> {
    return this.syncCandidatesQuery.findSnapshotCandidates(options);
  }

  async findHeroCandidatesForStatsRefresh(
    options: SyncCandidateOptions<'findHeroCandidatesForStatsRefresh'>,
  ): Promise<MediaSyncItem[]> {
    return this.syncCandidatesQuery.findHeroCandidatesForStatsRefresh(options);
  }

  async updateLastSyncedAt(id: string, date: Date): Promise<void> {
    return withDbError('update last synced at', this.logger, async () => {
      await this.db
        .update(schema.mediaItems)
        .set({ lastSyncedAt: date })
        .where(eq(schema.mediaItems.id, id));
    });
  }

  async clearStaleTrendingRanks(before: Date): Promise<number> {
    return withDbError('clear stale trending ranks', this.logger, async () => {
      const result = await this.db
        .update(schema.mediaItems)
        .set({ trendingRank: null, trendingScore: 0 })
        .where(
          and(
            isNotNull(schema.mediaItems.trendingRank),
            lt(schema.mediaItems.trendingUpdatedAt, before),
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .returning({ id: schema.mediaItems.id });

      return result.length;
    });
  }
}
