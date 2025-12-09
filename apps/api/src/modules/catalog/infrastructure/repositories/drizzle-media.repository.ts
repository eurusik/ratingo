import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { 
  IMediaRepository, 
  MediaScoreData, 
  MediaWithTmdbId, 
  MediaScoreDataWithTmdbId 
} from '../../domain/repositories/media.repository.interface';
import { IGenreRepository, GENRE_REPOSITORY } from '../../domain/repositories/genre.repository.interface';
import { IMovieRepository, MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { IShowRepository, SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';
import { DrizzleMovieRepository } from './drizzle-movie.repository';
import { DrizzleShowRepository } from './drizzle-show.repository';
import { NormalizedMedia } from '../../../ingestion/domain/models/normalized-media.model';
import { eq, inArray, desc, and, lte, isNotNull, gte } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';

import { PersistenceMapper } from '../mappers/persistence.mapper';
import { ImageMapper } from '../mappers/image.mapper';

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
   * Retrieves top media items for the Hero block.
   */
  async findHero(limit: number, type?: MediaType): Promise<any[]> {
    try {
      const now = new Date();

      const whereConditions = [
        lte(schema.mediaItems.releaseDate, now),
        isNotNull(schema.mediaItems.posterPath),
        isNotNull(schema.mediaItems.backdropPath),
        // Quality filters for Hero
        gte(schema.mediaStats.qualityScore, 60), // Not trash
        gte(schema.mediaStats.popularityScore, 40) // Not obscure
      ];

      if (type) {
        whereConditions.push(eq(schema.mediaItems.type, type));
      }

      const results = await this.db
        .select({
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          slug: schema.mediaItems.slug,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          backdropPath: schema.mediaItems.backdropPath,
          releaseDate: schema.mediaItems.releaseDate,
          videos: schema.mediaItems.videos,
          
          // Stats
          ratingoScore: schema.mediaStats.ratingoScore,
          qualityScore: schema.mediaStats.qualityScore,
          watchersCount: schema.mediaStats.watchersCount, // live
          totalWatchers: schema.mediaStats.totalWatchers, // total
          
          // External
          rating: schema.mediaItems.rating, // TMDB Rating
          voteCount: schema.mediaItems.voteCount,
        })
        .from(schema.mediaItems)
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...whereConditions))
        // Sort by Popularity (Hottest) then Ratingo (Quality/Freshness)
        .orderBy(desc(schema.mediaStats.popularityScore), desc(schema.mediaStats.ratingoScore))
        .limit(limit);

      // --- Post-fetch enrichment for Shows ---
      const showIds = results
        .filter(r => r.type === MediaType.SHOW)
        .map(r => r.id);

      const showProgressMap = new Map<string, any>();

      if (showIds.length > 0) {
        
        const showsData = await this.db
          .select({
            mediaItemId: schema.shows.mediaItemId,
            showId: schema.shows.id,
            lastAirDate: schema.shows.lastAirDate,
            nextAirDate: schema.shows.nextAirDate,
          })
          .from(schema.shows)
          .where(inArray(schema.shows.mediaItemId, showIds));
        
        const internalShowIds = showsData.map(s => s.showId);
        
        // Find the latest episode for each show
        // Note: This might be heavy if we have MANY shows, but for Hero (limit 3-10) it is fine.
        const episodes = await this.db
          .select({
            showId: schema.episodes.showId,
            seasonNumber: schema.episodes.seasonId,
            seasonNum: schema.seasons.number,
            episodeNumber: schema.episodes.number,
            airDate: schema.episodes.airDate,
          })
          .from(schema.episodes)
          .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
          .where(
            and(
              inArray(schema.episodes.showId, internalShowIds),
              lte(schema.episodes.airDate, new Date())
            )
          )
          .orderBy(desc(schema.episodes.airDate));

        // Group by showId and pick first (latest)
        const latestEpisodeMap = new Map<string, any>();
        for (const ep of episodes) {
          if (!latestEpisodeMap.has(ep.showId)) {
            latestEpisodeMap.set(ep.showId, ep);
          }
        }

        // Build the result map
        for (const show of showsData) {
          const ep = latestEpisodeMap.get(show.showId);
          if (ep) {
            showProgressMap.set(show.mediaItemId, {
              season: ep.seasonNum,
              episode: ep.episodeNumber,
              label: `S${ep.seasonNum}E${ep.episodeNumber}`,
              lastAirDate: show.lastAirDate,
              nextAirDate: show.nextAirDate,
            });
          } else if (show.lastAirDate) {
             // Fallback if episodes are missing but show has dates
             showProgressMap.set(show.mediaItemId, {
              season: 0,
              episode: 0,
              label: 'Ended',
              lastAirDate: show.lastAirDate,
              nextAirDate: show.nextAirDate,
            });
          }
        }
      }

      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());

      return results.map(item => {
        const releaseDate = item.releaseDate ? new Date(item.releaseDate) : null;
        const videos = item.videos as any[];
        const primaryTrailerKey = videos?.length > 0 ? videos[0].key : null;
        
        const baseItem = {
          id: item.id,
          type: item.type,
          slug: item.slug,
          title: item.title,
          originalTitle: item.originalTitle,
          overview: item.overview,
          primaryTrailerKey,
          poster: ImageMapper.toPoster(item.posterPath),
          backdrop: ImageMapper.toBackdrop(item.backdropPath),
          releaseDate: item.releaseDate,
          isNew: releaseDate ? releaseDate >= ninetyDaysAgo : false,
          isClassic: releaseDate ? releaseDate <= fiveYearsAgo : false,
          stats: {
            ratingoScore: item.ratingoScore,
            qualityScore: item.qualityScore,
            liveWatchers: item.watchersCount,
            totalWatchers: item.totalWatchers,
          },
          externalRatings: {
            tmdb: {
              rating: item.rating,
              voteCount: item.voteCount,
            }
          }
        };

        if (item.type === MediaType.SHOW) {
          const progress = showProgressMap.get(item.id);
          if (progress) {
            return { ...baseItem, showProgress: progress };
          }
        }

        return baseItem;
      });
    } catch (error) {
      this.logger.error(`Failed to find hero items: ${error.message}`);
      return []; 
    }
  }
}
