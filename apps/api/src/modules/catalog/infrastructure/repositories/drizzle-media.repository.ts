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
import { DrizzleMovieRepository } from './drizzle-movie.repository';
import { DrizzleShowRepository } from './drizzle-show.repository';
import { NormalizedMedia } from '../../../ingestion/domain/models/normalized-media.model';
import { eq, inArray, sql, and, desc } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';

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
    private readonly heroMediaQuery: HeroMediaQuery
  ) {}

  /**
   * Retrieves minimal media info (ID, slug) by TMDB ID to check existence.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findByTmdbId(tmdbId: number): Promise<{ id: string; slug: string } | null> {
    try {
      const result = await this.db
        .select({ id: schema.mediaItems.id, slug: schema.mediaItems.slug })
        .from(schema.mediaItems)
        .where(eq(schema.mediaItems.tmdbId, tmdbId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.logger.error(`Failed to find media by TMDB ID ${tmdbId}: ${error.message}`);
      throw new DatabaseException(`Failed to find media: ${error.message}`, { tmdbId });
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
            target: schema.mediaItems.tmdbId,
            set: PersistenceMapper.toMediaItemUpdate(media),
          })
          .returning({ id: schema.mediaItems.id });

        const mediaId = mediaItem.id;

        // Delegate type-specific upsert
        if (media.type === MediaType.MOVIE) {
          if (this.movieRepository instanceof DrizzleMovieRepository) {
            await this.movieRepository.upsertDetails(tx, mediaId, media.details || {});
          }
        } else {
          if (this.showRepository instanceof DrizzleShowRepository) {
            await this.showRepository.upsertDetails(tx, mediaId, media.details || {});
          }
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
      });
    } catch (error) {
      this.logger.error(`Failed to upsert media ${media.title}: ${error.message}`);
      throw new DatabaseException(`Failed to upsert media: ${error.message}`, {
        tmdbId: media.externalIds.tmdbId,
        title: media.title,
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
   * @returns {Promise<any[]>} List of hero-worthy media items
   */
  async findHero(limit: number, type?: MediaType): Promise<any[]> {
    return this.heroMediaQuery.execute({ limit, type });
  }

  /**
   * Searches for media items using full-text search.
   */
  async search(query: string, limit: number): Promise<any[]> {
    try {
      // Create tsquery: 'word1 & word2:*' for partial matching
      const formattedQuery = query.trim().split(/\s+/).join(' & ') + ':*';
      const sqlQuery = sql`to_tsquery('simple', ${formattedQuery})`;

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
        .where(
          and(
            sql`${schema.mediaItems.deletedAt} IS NULL`,
            sql`${schema.mediaItems.searchVector} @@ ${sqlQuery}`
          )
        )
        .orderBy(desc(schema.mediaItems.popularity))
        .limit(limit);
    } catch (error) {
      this.logger.error(`Failed to search media for "${query}": ${error.message}`);
      return [];
    }
  }
}
