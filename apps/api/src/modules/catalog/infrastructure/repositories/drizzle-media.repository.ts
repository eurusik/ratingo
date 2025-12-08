import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/database/schema';
import { 
  IMediaRepository, 
  MediaScoreData, 
  MediaWithTmdbId, 
  MediaScoreDataWithTmdbId 
} from '@/modules/catalog/domain/repositories/media.repository.interface';
import { IGenreRepository, GENRE_REPOSITORY } from '@/modules/catalog/domain/repositories/genre.repository.interface';
import { IProviderRepository, PROVIDER_REPOSITORY } from '@/modules/catalog/domain/repositories/provider.repository.interface';
import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { eq, inArray } from 'drizzle-orm';
import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions';

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
    @Inject(PROVIDER_REPOSITORY)
    private readonly providerRepository: IProviderRepository,
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
        .values({
          type: media.type,
          tmdbId: media.externalIds.tmdbId,
          imdbId: media.externalIds.imdbId || null,
          title: media.title,
          originalTitle: media.originalTitle,
          slug: media.slug,
          overview: media.overview,
          posterPath: media.posterPath,
          backdropPath: media.backdropPath,
          
          // Metrics
          rating: media.rating,
          voteCount: media.voteCount,
          popularity: media.popularity,
          trendingScore: media.trendingScore ?? 0,
          
          // External Ratings
          ratingImdb: media.ratingImdb,
          voteCountImdb: media.voteCountImdb,
          ratingTrakt: media.ratingTrakt,
          voteCountTrakt: media.voteCountTrakt,
          ratingMetacritic: media.ratingMetacritic,
          ratingRottenTomatoes: media.ratingRottenTomatoes,

          releaseDate: media.releaseDate,
          isAdult: media.isAdult,
          updatedAt: new Date(),
        } as any) // Explicit cast to bypass strict type check for now
        .onConflictDoUpdate({
          target: schema.mediaItems.tmdbId,
          set: {
            title: media.title,
            originalTitle: media.originalTitle,
            slug: media.slug,
            overview: media.overview,
            
            rating: media.rating,
            voteCount: media.voteCount,
            popularity: media.popularity,
            // Only update trendingScore if provided
            ...(media.trendingScore !== undefined ? { trendingScore: media.trendingScore } : {}),
            
            // Update external ratings
            ratingImdb: media.ratingImdb,
            voteCountImdb: media.voteCountImdb,
            ratingTrakt: media.ratingTrakt,
            voteCountTrakt: media.voteCountTrakt,
            ratingMetacritic: media.ratingMetacritic,
            ratingRottenTomatoes: media.ratingRottenTomatoes,

            posterPath: media.posterPath,
            backdropPath: media.backdropPath,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.mediaItems.id });

      const mediaId = mediaItem.id;

      // Upsert type-specific details
      await this.upsertTypeDetails(tx, mediaId, media);

      // Sync Genres
      await this.genreRepository.syncGenres(tx, mediaId, media.genres);

      // Sync Watch Providers
      if (media.watchProviders) {
        await this.providerRepository.syncProviders(tx, mediaId, media.watchProviders);
      }

      // Upsert Ratingo Scores to media_stats
      if (media.ratingoScore !== undefined) {
        await tx
          .insert(schema.mediaStats)
          .values({
            mediaItemId: mediaId,
            ratingoScore: media.ratingoScore,
            qualityScore: media.qualityScore,
            popularityScore: media.popularityScore,
            freshnessScore: media.freshnessScore,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              ratingoScore: media.ratingoScore,
              qualityScore: media.qualityScore,
              popularityScore: media.popularityScore,
              freshnessScore: media.freshnessScore,
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
        count: tmdbIds.length 
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
        count: ids.length 
      });
    }
  }

  /**
   * Upserts type-specific details (movie or show).
   */
  private async upsertTypeDetails(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    mediaId: string,
    media: NormalizedMedia,
  ): Promise<void> {
    if (media.type === MediaType.MOVIE) {
      await tx
        .insert(schema.movies)
        .values({
          mediaItemId: mediaId,
          runtime: media.details?.runtime,
          budget: media.details?.budget,
          revenue: media.details?.revenue,
          status: media.status,
        })
        .onConflictDoUpdate({
          target: schema.movies.mediaItemId,
          set: {
            runtime: media.details?.runtime,
            budget: media.details?.budget,
            revenue: media.details?.revenue,
            status: media.status,
          },
        });
    } else {
      await tx
        .insert(schema.shows)
        .values({
          mediaItemId: mediaId,
          totalSeasons: media.details?.totalSeasons,
          totalEpisodes: media.details?.totalEpisodes,
          lastAirDate: media.details?.lastAirDate,
          status: media.status,
        })
        .onConflictDoUpdate({
          target: schema.shows.mediaItemId,
          set: {
            totalSeasons: media.details?.totalSeasons,
            totalEpisodes: media.details?.totalEpisodes,
            lastAirDate: media.details?.lastAirDate,
            status: media.status,
          },
        });
    }
  }
}
