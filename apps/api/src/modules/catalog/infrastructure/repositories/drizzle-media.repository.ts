import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, inArray, sql, and, desc, gt, gte, isNull, isNotNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { PG_ERROR_CODE, DB_CONSTRAINT } from '../../../../common/constants/database.constants';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EligibilityStatus,
  EvaluationReason,
  DEFAULT_POLICY_VERSION,
  EvaluationContext,
} from '../../../catalog-policy/public';
import type { NormalizedMedia } from '../../../ingestion/public';
import { type LocalSearchResult } from '../../domain/models/search-result.model';
import {
  type IGenreRepository,
  GENRE_REPOSITORY,
} from '../../domain/repositories/genre.repository.interface';
import {
  type IMediaRepository,
  type MediaScoreData,
  type MediaWithTmdbId,
  type MediaScoreDataWithTmdbId,
  type CorruptedWatchersItem,
  type EligibleTrendingItem,
  type SnapshotCandidate,
} from '../../domain/repositories/media.repository.interface';
import {
  type IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../domain/repositories/movie.repository.interface';
import {
  type IShowRepository,
  SHOW_REPOSITORY,
} from '../../domain/repositories/show.repository.interface';
import { PersistenceMapper } from '../mappers/persistence.mapper';
import { HeroMediaQuery } from '../queries/hero-media.query';

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
    @Inject(GENRE_REPOSITORY)
    private readonly genreRepository: IGenreRepository,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly heroMediaQuery: HeroMediaQuery,
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
    try {
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
    } catch (error) {
      this.logger.error(`Failed to find media by TMDB ID ${tmdbId}: ${error.message}`);
      throw new DatabaseException(`Failed to find media: ${error.message}`, { tmdbId });
    }
  }

  /**
   * Updates ingestion status by TMDB ID (noop if not found).
   */
  async updateIngestionStatus(tmdbId: number, status: IngestionStatus): Promise<void> {
    try {
      await this.db
        .update(schema.mediaItems)
        .set({ ingestionStatus: status, updatedAt: new Date() })
        .where(eq(schema.mediaItems.tmdbId, tmdbId));
    } catch (error) {
      this.logger.error(`Failed to update ingestion status for TMDB ${tmdbId}: ${error.message}`);
      throw new DatabaseException('Failed to update ingestion status', { tmdbId, status });
    }
  }

  /**
   * Inserts a minimal stub media item (media_items only).
   * If exists, returns existing id/slug without failing.
   *
   * Handles race condition where multiple parallel requests try to insert
   * the same media item. ON CONFLICT handles (type, tmdb_id), but there's
   * also a unique constraint on (type, slug). If slug conflict occurs,
   * we fall back to SELECT by slug and handle accordingly.
   */
  async upsertStub(payload: {
    tmdbId: number;
    type: MediaType;
    title: string;
    slug: string;
    ingestionStatus: IngestionStatus;
  }): Promise<{ id: string; slug: string }> {
    try {
      const [row] = await this.db
        .insert(schema.mediaItems)
        .values({
          tmdbId: payload.tmdbId,
          type: payload.type,
          title: payload.title,
          slug: payload.slug,
          ingestionStatus: payload.ingestionStatus,
          // minimal defaults
          popularity: 0,
          rating: 0,
          voteCount: 0,
          credits: { cast: [], crew: [] },
          videos: null,
          watchProvidersRaw: null,
          overview: null,
        })
        .onConflictDoUpdate({
          target: [schema.mediaItems.type, schema.mediaItems.tmdbId], // Composite key: type + tmdb_id
          set: {
            title: payload.title,
            slug: payload.slug,
            ingestionStatus: payload.ingestionStatus,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.mediaItems.id, slug: schema.mediaItems.slug });

      return row;
    } catch (error: unknown) {
      const result = await this.handleSlugConflict(error, payload);
      if (result) return result;

      // Log full error details for debugging
      const err = error as { message?: string; cause?: { code?: string; message?: string } };
      this.logger.error(`Failed to upsert stub for tmdbId ${payload.tmdbId}`, {
        message: err.message,
        causeCode: err.cause?.code,
        causeMessage: err.cause?.message,
      });
      throw new DatabaseException('Failed to upsert stub media item', error, {
        tmdbId: payload.tmdbId,
      });
    }
  }

  /**
   * Handles slug unique constraint violation during upsert.
   * Returns resolved record or null if error is not a slug conflict.
   */
  private async handleSlugConflict(
    error: unknown,
    payload: {
      tmdbId: number;
      type: MediaType;
      title: string;
      slug: string;
      ingestionStatus: IngestionStatus;
    },
  ): Promise<{ id: string; slug: string } | null> {
    // postgres.js uses 'constraint_name' (not 'constraint') for the PostgreSQL 'n' field
    const err = error as {
      code?: string;
      constraint_name?: string;
      cause?: { code?: string; constraint_name?: string };
    };
    const pgCode = err.cause?.code ?? err.code;
    const pgConstraint = err.cause?.constraint_name ?? err.constraint_name;

    // Not a slug conflict — let caller handle
    if (
      pgCode !== PG_ERROR_CODE.UNIQUE_VIOLATION ||
      pgConstraint !== DB_CONSTRAINT.MEDIA_TYPE_SLUG
    ) {
      return null;
    }

    // Fetch by slug — that's what we know exists from the error
    const existingBySlug = await this.db
      .select({
        id: schema.mediaItems.id,
        slug: schema.mediaItems.slug,
        tmdbId: schema.mediaItems.tmdbId,
      })
      .from(schema.mediaItems)
      .where(
        and(eq(schema.mediaItems.type, payload.type), eq(schema.mediaItems.slug, payload.slug)),
      )
      .limit(1);

    if (!existingBySlug[0]) {
      return null; // Shouldn't happen, but let caller handle
    }

    // Case 1: Race condition — same tmdbId, just return existing
    if (existingBySlug[0].tmdbId === payload.tmdbId) {
      this.logger.debug(
        `Race condition resolved for tmdbId ${payload.tmdbId}, returning existing record`,
      );
      return { id: existingBySlug[0].id, slug: existingBySlug[0].slug };
    }

    // Case 2: Real slug collision — different tmdbId owns this slug
    return this.upsertWithUniqueSlug(payload, existingBySlug[0].tmdbId);
  }

  /**
   * Retries upsert with a unique slug (appends tmdbId) when slug collision occurs.
   */
  private async upsertWithUniqueSlug(
    payload: {
      tmdbId: number;
      type: MediaType;
      title: string;
      slug: string;
      ingestionStatus: IngestionStatus;
    },
    conflictingTmdbId: number,
  ): Promise<{ id: string; slug: string }> {
    // Avoid double suffix if slug already ends with tmdbId
    const suffix = `-${payload.tmdbId}`;
    const uniqueSlug = payload.slug.endsWith(suffix) ? payload.slug : `${payload.slug}${suffix}`;

    this.logger.warn(
      `Slug collision: "${payload.slug}" owned by tmdbId ${conflictingTmdbId}, ` +
        `using "${uniqueSlug}" for tmdbId ${payload.tmdbId}`,
    );

    const [retryRow] = await this.db
      .insert(schema.mediaItems)
      .values({
        tmdbId: payload.tmdbId,
        type: payload.type,
        title: payload.title,
        slug: uniqueSlug,
        ingestionStatus: payload.ingestionStatus,
        popularity: 0,
        rating: 0,
        voteCount: 0,
        credits: { cast: [], crew: [] },
        videos: null,
        watchProvidersRaw: null,
        overview: null,
      })
      .onConflictDoUpdate({
        target: [schema.mediaItems.type, schema.mediaItems.tmdbId],
        set: {
          title: payload.title,
          slug: uniqueSlug,
          ingestionStatus: payload.ingestionStatus,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.mediaItems.id, slug: schema.mediaItems.slug });

    return retryRow;
  }

  /**
   * Performs a full transactional upsert of a media item.
   * Updates base table, type-specific details, and syncs genres.
   *
   * Handles slug collision by retrying with unique slug (appends tmdbId).
   *
   * @throws {DatabaseException} If database transaction fails
   */
  async upsert(media: NormalizedMedia): Promise<void> {
    try {
      await this.upsertWithSlug(media, media.slug);
    } catch (error: unknown) {
      // Check if it's a slug collision - retry with unique slug
      const retrySlug = this.extractSlugCollisionRetry(error, media);
      if (retrySlug) {
        this.logger.warn(
          `Slug collision for "${media.slug}", retrying with "${retrySlug}" (tmdbId: ${media.externalIds.tmdbId})`,
        );
        await this.upsertWithSlug(media, retrySlug);
        return;
      }

      // Not a slug collision - handle as regular error
      this.handleUpsertError(error, media);
    }
  }

  /**
   * Performs the actual upsert transaction with a specific slug.
   */
  private async upsertWithSlug(media: NormalizedMedia, slug: string | undefined): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Upsert Base Media Item
      const insertValues = PersistenceMapper.toMediaItemInsert(media);
      // Override slug if provided (for retry with unique slug)
      if (slug) {
        insertValues.slug = slug;
      }

      const updateValues = PersistenceMapper.toMediaItemUpdate(media);
      // Also update slug on conflict if we're using a unique slug
      if (slug && slug !== media.slug) {
        updateValues.slug = slug;
      }

      const [mediaItem] = await tx
        .insert(schema.mediaItems)
        .values(insertValues)
        .onConflictDoUpdate({
          target: [schema.mediaItems.type, schema.mediaItems.tmdbId], // Composite key: type + tmdb_id
          set: updateValues,
        })
        .returning({ id: schema.mediaItems.id });

      const mediaId = mediaItem.id;

      // Delegate type-specific upsert
      if (media.type === MediaType.MOVIE) {
        await this.movieRepository.upsertDetails(tx, mediaId, media.details || {});
      } else {
        await this.showRepository.upsertDetails(tx, mediaId, media.details || {});
      }

      // Sync Genres
      await this.genreRepository.syncGenres(tx, mediaId, media.genres);

      // Upsert Ratingo Scores to media_stats
      const statsInsert = PersistenceMapper.toMediaStatsInsert(mediaId, media);
      if (statsInsert) {
        // Build update set - only include fields with actual data
        // This prevents overwriting valid data with null/0 on API failures
        const updateSet: Record<string, unknown> = {
          ratingoScore: statsInsert.ratingoScore,
          qualityScore: statsInsert.qualityScore,
          popularityScore: statsInsert.popularityScore,
          freshnessScore: statsInsert.freshnessScore,
          updatedAt: new Date(),
        };

        // CRITICAL: Only update watchersCount if we have actual data
        // If watchersCount is undefined in statsInsert, preserve existing DB value
        if (statsInsert.watchersCount !== undefined) {
          updateSet.watchersCount = statsInsert.watchersCount;
        }

        // CRITICAL: Only update totalWatchers if we have actual data
        // If totalWatchers is undefined in statsInsert, preserve existing DB value
        if (statsInsert.totalWatchers !== undefined) {
          // Extra safeguard: don't overwrite positive value with 0
          // (a popular show suddenly having 0 watchers is almost always an API error)
          updateSet.totalWatchers = sql`
            CASE
              WHEN ${statsInsert.totalWatchers} = 0 AND ${schema.mediaStats.totalWatchers} > 0
              THEN ${schema.mediaStats.totalWatchers}
              ELSE ${statsInsert.totalWatchers}
            END
          `;
        }

        await tx.insert(schema.mediaStats).values(statsInsert).onConflictDoUpdate({
          target: schema.mediaStats.mediaItemId,
          set: updateSet,
        });
      }

      // Upsert Catalog Evaluation (INELIGIBLE by default)
      // Design Decision DD-3: Every media_item MUST have a corresponding evaluation record
      // This ensures the 1:1 invariant and prevents items from being "stuck" without evaluation
      //
      // Per Readability & Pending Reform: PENDING is no longer used.
      // New items start as INELIGIBLE with NO_ACTIVE_POLICY reason until evaluated.
      await tx
        .insert(schema.mediaCatalogEvaluations)
        .values({
          mediaItemId: mediaId,
          status: EligibilityStatus.INELIGIBLE,
          policyVersion: DEFAULT_POLICY_VERSION,
          reasons: [EvaluationReason.NO_ACTIVE_POLICY],
          relevanceScore: 0,
          evaluatedAt: null, // NULL for items not yet evaluated by Policy Engine
          context: EvaluationContext.CATALOG, // Default context for catalog evaluation
        })
        .onConflictDoNothing(); // If already exists, don't overwrite (evaluation job will update it)
    });
  }

  /**
   * Checks if error is a slug collision and returns retry slug, or null if not.
   */
  private extractSlugCollisionRetry(error: unknown, media: NormalizedMedia): string | null {
    // postgres.js uses 'constraint_name' (not 'constraint') for the PostgreSQL 'n' field
    const err = error as {
      code?: string;
      constraint_name?: string;
      cause?: { code?: string; constraint_name?: string };
    };
    const pgCode = err.cause?.code ?? err.code;
    const pgConstraint = err.cause?.constraint_name ?? err.constraint_name;

    // Not a slug collision
    if (
      pgCode !== PG_ERROR_CODE.UNIQUE_VIOLATION ||
      pgConstraint !== DB_CONSTRAINT.MEDIA_TYPE_SLUG
    ) {
      return null;
    }

    // Generate unique slug with tmdbId suffix
    // Avoid double suffix if slug already ends with tmdbId (e.g., tmdb-1614580 → tmdb-1614580-1614580)
    const { tmdbId } = media.externalIds;
    const baseSlug = media.slug || `tmdb-${tmdbId}`;
    const suffix = `-${tmdbId}`;

    return baseSlug.endsWith(suffix) ? baseSlug : `${baseSlug}${suffix}`;
  }

  /**
   * Handles upsert errors by logging and throwing DatabaseException.
   */
  private handleUpsertError(error: unknown, media: NormalizedMedia): never {
    // Drizzle wraps PostgreSQL errors - extract the actual DB error
    // postgres.js uses 'constraint_name' (not 'constraint') for the PostgreSQL 'n' field
    const err = error as {
      message?: string;
      code?: string;
      detail?: string;
      constraint_name?: string;
      cause?: {
        message?: string;
        code?: string;
        detail?: string;
        constraint_name?: string;
      };
    };

    // PostgreSQL error is often in cause (wrapped by Drizzle)
    const pgError = err.cause ?? err;
    const pgCode = pgError.code ?? err.code;
    const pgDetail = pgError.detail ?? err.detail;
    const pgConstraint = pgError.constraint_name ?? err.constraint_name;
    const pgMessage = pgError.message ?? err.message;

    this.logger.error(`Failed to upsert media ${media.title}`, {
      message: pgMessage,
      code: pgCode,
      detail: pgDetail,
      constraint: pgConstraint,
      tmdbId: media.externalIds.tmdbId,
    });

    throw new DatabaseException(`Failed to upsert media: ${pgMessage}`, error, {
      tmdbId: media.externalIds.tmdbId,
      title: media.title,
      code: pgCode,
      detail: pgDetail,
      constraint: pgConstraint,
    });
  }

  /**
   * Retrieves media data needed for score calculation.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findByIdForScoring(id: string): Promise<MediaScoreData | null> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to find media for scoring ${id}: ${error.message}`);
      throw new DatabaseException(`Failed to find media for scoring: ${error.message}`, { id });
    }
  }

  /**
   * Batch: Retrieves multiple media items by TMDB IDs in a single query.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findManyByTmdbIds(tmdbIds: number[]): Promise<MediaWithTmdbId[]> {
    if (tmdbIds.length === 0) return [];

    try {
      const result = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
        })
        .from(schema.mediaItems)
        .where(inArray(schema.mediaItems.tmdbId, tmdbIds));

      return result;
    } catch (error) {
      this.logger.error(`Failed to find media by TMDB IDs: ${error.message}`);
      throw new DatabaseException(`Failed to find media by TMDB IDs: ${error.message}`, {
        count: tmdbIds.length,
      });
    }
  }

  /**
   * Batch: Retrieves score data for multiple media items in a single query.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findManyForScoring(ids: string[]): Promise<MediaScoreDataWithTmdbId[]> {
    if (ids.length === 0) return [];

    try {
      const result = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
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

      return result;
    } catch (error) {
      this.logger.error(`Failed to find media for scoring: ${error.message}`);
      throw new DatabaseException(`Failed to find media for scoring: ${error.message}`, {
        count: ids.length,
      });
    }
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

  /**
   * Searches for media items using trigram similarity (pg_trgm).
   * Supports fuzzy matching and works well with any language including Ukrainian.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * Note: Returns empty array on error (graceful degradation for user-facing search).
   */
  async search(query: string, limit: number): Promise<LocalSearchResult[]> {
    try {
      const searchTerm = query.trim();
      const likePattern = `%${searchTerm}%`;

      return await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          slug: schema.mediaItems.slug,
          posterPath: schema.mediaItems.posterPath,
          rating: schema.mediaItems.rating,
          releaseDate: schema.mediaItems.releaseDate,
          ingestionStatus: schema.mediaItems.ingestionStatus,
        })
        .from(schema.mediaItems)
        .innerJoin(
          schema.mediaCatalogEvaluations,
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
        )
        .where(
          and(
            sql`${schema.mediaItems.deletedAt} IS NULL`,
            // Eligibility filter: only show ELIGIBLE items
            eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
            // Ready filter: only show items with ready ingestion status
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            sql`(
              ${schema.mediaItems.title} ILIKE ${likePattern}
              OR ${schema.mediaItems.originalTitle} ILIKE ${likePattern}
              OR ${schema.mediaItems.title} % ${searchTerm}
              OR ${schema.mediaItems.originalTitle} % ${searchTerm}
            )`,
          ),
        )
        .orderBy(
          // Order by similarity score (higher = better match)
          sql`GREATEST(
            similarity(${schema.mediaItems.title}, ${searchTerm}),
            similarity(COALESCE(${schema.mediaItems.originalTitle}, ''), ${searchTerm})
          ) DESC`,
          desc(schema.mediaItems.popularity),
        )
        .limit(limit);
    } catch (error) {
      this.logger.error(`Failed to search media for "${query}": ${error.message}`);
      return [];
    }
  }

  /**
   * Retrieves media items updated by trending sync since a given date.
   * Used by stats sync to get items that were recently synced.
   */
  async findTrendingUpdatedItems(options: {
    since?: Date;
    limit: number;
  }): Promise<{ id: string; tmdbId: number; type: MediaType }[]> {
    try {
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

      return rows
        .filter((r) => r.tmdbId !== null)
        .map((r) => ({
          id: r.id,
          tmdbId: r.tmdbId!,
          type: r.type,
        }));
    } catch (error) {
      this.logger.error(`Failed to find trending updated items: ${error.message}`);
      throw new DatabaseException('Failed to find trending updated items');
    }
  }

  /**
   * Retrieves IDs of active media items for snapshots sync with cursor pagination.
   */
  async findIdsForSnapshots(options: { cursor?: string; limit: number }): Promise<string[]> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to find IDs for snapshots: ${error.message}`);
      throw new DatabaseException('Failed to find IDs for snapshots');
    }
  }

  async findIdsForRecalculation(options: {
    type?: MediaType;
    limit: number;
    offset: number;
  }): Promise<string[]> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to find IDs for recalculation: ${error.message}`);
      throw new DatabaseException('Failed to find IDs for recalculation');
    }
  }

  /**
   * Finds items with corrupted total_watchers data.
   * Items where total_watchers = 0 (or null) but have Trakt votes indicate API failure during sync.
   */
  async findItemsWithMissingWatchers(options: {
    type?: MediaType;
    limit: number;
    minVotes: number;
  }): Promise<CorruptedWatchersItem[]> {
    try {
      const conditions = [
        isNull(schema.mediaItems.deletedAt),
        gte(schema.mediaItems.voteCountTrakt, options.minVotes),
        sql`(${schema.mediaStats.totalWatchers} IS NULL OR ${schema.mediaStats.totalWatchers} = 0)`,
      ];

      if (options.type) {
        conditions.push(eq(schema.mediaItems.type, options.type));
      }

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
        .filter((r) => r.tmdbId !== null && r.voteCountTrakt !== null)
        .map((r) => ({
          id: r.id,
          tmdbId: r.tmdbId!,
          type: r.type,
          voteCountTrakt: r.voteCountTrakt!,
        }));
    } catch (error) {
      this.logger.error(`Failed to find items with missing watchers: ${error.message}`);
      throw new DatabaseException('Failed to find items with missing watchers');
    }
  }

  /**
   * Finds items with corrupted watchers_count (live watchers).
   * Items where watchers_count = 0 but total_watchers > minTotalWatchers.
   */
  async findItemsWithCorruptedWatchersCount(options: {
    type?: MediaType;
    limit: number;
    minTotalWatchers: number;
  }): Promise<CorruptedWatchersItem[]> {
    try {
      const conditions = [
        isNull(schema.mediaItems.deletedAt),
        eq(schema.mediaStats.watchersCount, 0),
        gte(schema.mediaStats.totalWatchers, options.minTotalWatchers),
      ];

      if (options.type) {
        conditions.push(eq(schema.mediaItems.type, options.type));
      }

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

      return rows
        .filter((r) => r.tmdbId !== null)
        .map((r) => ({
          id: r.id,
          tmdbId: r.tmdbId!,
          type: r.type,
          voteCountTrakt: r.voteCountTrakt ?? 0,
        }));
    } catch (error) {
      this.logger.error(`Failed to find items with corrupted watchers count: ${error.message}`);
      throw new DatabaseException('Failed to find items with corrupted watchers count');
    }
  }

  /**
   * Finds ELIGIBLE items for trending context that need watchers sync.
   * Only returns items with watchers_count = 0 or NULL (never synced or stale).
   * Used to backfill watchers data for items not in Trakt trending top-100.
   */
  async findEligibleForTrending(options: {
    limit: number;
    offset: number;
  }): Promise<EligibleTrendingItem[]> {
    try {
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
          ),
        )
        .orderBy(schema.mediaItems.id)
        .limit(options.limit)
        .offset(options.offset);

      return rows.map((r) => ({
        id: r.id,
        tmdbId: r.tmdbId!,
        type: r.type,
      }));
    } catch (error) {
      this.logger.error(`Failed to find eligible items for trending: ${error.message}`);
      throw new DatabaseException('Failed to find eligible items for trending');
    }
  }

  /**
   * Retrieves ELIGIBLE media items for snapshots sync with cursor pagination.
   * Filters to items that pass Policy Engine in TRENDING context.
   */
  async findSnapshotCandidates(options: {
    cursor?: string;
    limit: number;
  }): Promise<SnapshotCandidate[]> {
    try {
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

      const conditions = [
        isNull(schema.mediaItems.deletedAt),
        isNotNull(schema.mediaItems.tmdbId),
        eq(schema.mediaCatalogEvaluations.policyVersion, activePolicy[0].version),
        eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
        eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
      ];

      if (options.cursor) {
        conditions.push(gt(schema.mediaItems.id, options.cursor));
      }

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

      return rows.map((r) => ({
        id: r.id,
        tmdbId: r.tmdbId!,
        type: r.type,
      }));
    } catch (error) {
      this.logger.error(`Failed to find snapshot candidates: ${error.message}`);
      throw new DatabaseException('Failed to find snapshot candidates');
    }
  }
}
