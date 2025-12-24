import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import {
  IMediaRepository,
  MediaScoreData,
  MediaWithTmdbId,
  MediaScoreDataWithTmdbId,
} from '../../domain/repositories/media.repository.interface';
import {
  IGenreRepository,
  GENRE_REPOSITORY,
} from '../../domain/repositories/genre.repository.interface';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../domain/repositories/movie.repository.interface';
import {
  IShowRepository,
  SHOW_REPOSITORY,
} from '../../domain/repositories/show.repository.interface';
import { NormalizedMedia } from '../../../ingestion/domain/models/normalized-media.model';
import { eq, inArray, sql, and, desc, gt, gte, isNull, isNotNull } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions';

import { PersistenceMapper } from '../mappers/persistence.mapper';
import { HeroMediaQuery } from '../queries/hero-media.query';
import { HeroMediaItem, LocalSearchResult } from '../../domain/models/hero-media.model';
import {
  EligibilityStatus,
  EvaluationReason,
  DEFAULT_POLICY_VERSION,
} from '../../../catalog-policy/domain/constants/evaluation.constants';

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
   *
   * @throws {DatabaseException} If database query fails
   */
  async findByTmdbId(tmdbId: number): Promise<{
    id: string;
    slug: string;
    type: MediaType;
    ingestionStatus: IngestionStatus;
  } | null> {
    try {
      const result = await this.db
        .select({
          id: schema.mediaItems.id,
          slug: schema.mediaItems.slug,
          type: schema.mediaItems.type,
          ingestionStatus: schema.mediaItems.ingestionStatus,
        })
        .from(schema.mediaItems)
        .where(eq(schema.mediaItems.tmdbId, tmdbId))
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
          watchProviders: null,
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
    } catch (error) {
      this.logger.error(`Failed to upsert stub for tmdbId ${payload.tmdbId}: ${error.message}`);
      throw new DatabaseException('Failed to upsert stub media item', { tmdbId: payload.tmdbId });
    }
  }

  /**
   * Performs a full transactional upsert of a media item.
   * Updates base table, type-specific details, and syncs genres.
   *
   * @throws {DatabaseException} If database transaction fails
   */
  async upsert(media: NormalizedMedia): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        // Upsert Base Media Item
        const [mediaItem] = await tx
          .insert(schema.mediaItems)
          .values(PersistenceMapper.toMediaItemInsert(media))
          .onConflictDoUpdate({
            target: [schema.mediaItems.type, schema.mediaItems.tmdbId], // Composite key: type + tmdb_id
            set: PersistenceMapper.toMediaItemUpdate(media),
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
          await tx
            .insert(schema.mediaStats)
            .values(statsInsert)
            .onConflictDoUpdate({
              target: schema.mediaStats.mediaItemId,
              set: {
                ratingoScore: statsInsert.ratingoScore,
                qualityScore: statsInsert.qualityScore,
                popularityScore: statsInsert.popularityScore,
                freshnessScore: statsInsert.freshnessScore,
                watchersCount: statsInsert.watchersCount,
                totalWatchers: statsInsert.totalWatchers,
                updatedAt: new Date(),
              },
            });
        }

        // Upsert Catalog Evaluation (PENDING by default)
        // Design Decision DD-3: Every media_item MUST have a corresponding evaluation record
        // This ensures the 1:1 invariant and prevents items from being "stuck" without evaluation
        await tx
          .insert(schema.mediaCatalogEvaluations)
          .values({
            mediaItemId: mediaId,
            status: EligibilityStatus.PENDING,
            policyVersion: DEFAULT_POLICY_VERSION,
            reasons: [EvaluationReason.NO_ACTIVE_POLICY],
            relevanceScore: 0,
            evaluatedAt: null, // NULL for pending items
          })
          .onConflictDoNothing(); // If already exists, don't overwrite (evaluation job will update it)
      });
    } catch (error: any) {
      this.logger.error(`Failed to upsert media ${media.title}`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        tmdbId: media.externalIds.tmdbId,
      });
      throw new DatabaseException(`Failed to upsert media: ${error.message}`, {
        tmdbId: media.externalIds.tmdbId,
        title: media.title,
        code: error.code,
        constraint: error.constraint,
      });
    }
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
          ratingImdb: schema.mediaItems.ratingImdb,
          ratingTrakt: schema.mediaItems.ratingTrakt,
          ratingMetacritic: schema.mediaItems.ratingMetacritic,
          ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
          voteCountImdb: schema.mediaItems.voteCountImdb,
          voteCountTrakt: schema.mediaItems.voteCountTrakt,
        })
        .from(schema.mediaItems)
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
          ratingImdb: schema.mediaItems.ratingImdb,
          ratingTrakt: schema.mediaItems.ratingTrakt,
          ratingMetacritic: schema.mediaItems.ratingMetacritic,
          ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
          voteCountImdb: schema.mediaItems.voteCountImdb,
          voteCountTrakt: schema.mediaItems.voteCountTrakt,
        })
        .from(schema.mediaItems)
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
            eq(schema.mediaCatalogEvaluations.status, 'eligible'),
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
}
