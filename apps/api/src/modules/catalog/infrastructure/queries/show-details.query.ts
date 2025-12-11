import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, asc } from 'drizzle-orm';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { ShowDetails } from '../../domain/repositories/show.repository.interface';
import { CreditsMapper } from '../mappers/credits.mapper';
import { ImageMapper } from '../mappers/image.mapper';
import { WatchProvidersMapper } from '../mappers/watch-providers.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

/**
 * Fetches complete TV show details by slug.
 *
 * Retrieves show metadata, stats, external ratings, genres, and seasons
 * in optimized parallel queries.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class ShowDetailsQuery {
  private readonly logger = new Logger(ShowDetailsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the show details query.
   *
   * @param {string} slug - URL-friendly show identifier
   * @returns {Promise<ShowDetails | null>} Full show details or null if not found
   * @throws {DatabaseException} When database query fails
   */
  async execute(slug: string): Promise<ShowDetails | null> {
    try {
      const result = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          slug: schema.mediaItems.slug,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          ingestionStatus: schema.mediaItems.ingestionStatus,
          backdropPath: schema.mediaItems.backdropPath,
          videos: schema.mediaItems.videos,
          credits: schema.mediaItems.credits,
          watchProviders: schema.mediaItems.watchProviders,
          rating: schema.mediaItems.rating,
          voteCount: schema.mediaItems.voteCount,

          ratingImdb: schema.mediaItems.ratingImdb,
          voteCountImdb: schema.mediaItems.voteCountImdb,
          ratingTrakt: schema.mediaItems.ratingTrakt,
          voteCountTrakt: schema.mediaItems.voteCountTrakt,
          ratingMetacritic: schema.mediaItems.ratingMetacritic,
          ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,

          totalSeasons: schema.shows.totalSeasons,
          totalEpisodes: schema.shows.totalEpisodes,
          status: schema.shows.status,
          lastAirDate: schema.shows.lastAirDate,
          nextAirDate: schema.shows.nextAirDate,

          ratingoScore: schema.mediaStats.ratingoScore,
          qualityScore: schema.mediaStats.qualityScore,
          popularityScore: schema.mediaStats.popularityScore,
          watchersCount: schema.mediaStats.watchersCount,
          totalWatchers: schema.mediaStats.totalWatchers,

          showId: schema.shows.id,
        })
        .from(schema.mediaItems)
        .leftJoin(schema.shows, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(eq(schema.mediaItems.slug, slug))
        .limit(1);

      if (result.length === 0) return null;
      const show = result[0];

      const [genres, seasons] = await Promise.all([
        this.fetchGenres(show.id),
        show.showId ? this.fetchSeasons(show.showId) : Promise.resolve([]),
      ]);

      const { showId, ...showData } = show;

      return {
        id: showData.id,
        tmdbId: showData.tmdbId,
        title: showData.title,
        originalTitle: showData.originalTitle,
        slug: showData.slug,
        overview: showData.overview,
        ingestionStatus: showData.ingestionStatus as IngestionStatus,
        poster: ImageMapper.toPoster(showData.posterPath),
        backdrop: ImageMapper.toBackdrop(showData.backdropPath),
        videos: showData.videos,
        primaryTrailer: showData.videos?.[0] || null,
        credits: CreditsMapper.toDto(showData.credits),
        availability: WatchProvidersMapper.toAvailability(showData.watchProviders),

        totalSeasons: showData.totalSeasons,
        totalEpisodes: showData.totalEpisodes,
        status: showData.status as ShowStatus | null,
        lastAirDate: showData.lastAirDate,
        nextAirDate: showData.nextAirDate,

        stats: {
          ratingoScore: showData.ratingoScore,
          qualityScore: showData.qualityScore,
          popularityScore: showData.popularityScore,
          liveWatchers: showData.watchersCount,
          totalWatchers: showData.totalWatchers,
        },
        externalRatings: {
          tmdb: { rating: showData.rating, voteCount: showData.voteCount },
          imdb: showData.ratingImdb
            ? { rating: showData.ratingImdb, voteCount: showData.voteCountImdb }
            : null,
          trakt: showData.ratingTrakt
            ? { rating: showData.ratingTrakt, voteCount: showData.voteCountTrakt }
            : null,
          metacritic: showData.ratingMetacritic ? { rating: showData.ratingMetacritic } : null,
          rottenTomatoes: showData.ratingRottenTomatoes
            ? { rating: showData.ratingRottenTomatoes }
            : null,
        },

        genres,
        seasons,
      };
    } catch (error) {
      this.logger.error(`Failed to find show by slug ${slug}: ${error.message}`, error.stack);
      throw new DatabaseException(`Failed to fetch show ${slug}`, { originalError: error.message });
    }
  }

  /**
   * Fetches genres for a media item.
   */
  private async fetchGenres(mediaItemId: string) {
    return this.db
      .select({
        id: schema.genres.id,
        name: schema.genres.name,
        slug: schema.genres.slug,
      })
      .from(schema.genres)
      .innerJoin(schema.mediaGenres, eq(schema.genres.id, schema.mediaGenres.genreId))
      .where(eq(schema.mediaGenres.mediaItemId, mediaItemId));
  }

  /**
   * Fetches seasons for a show.
   */
  private async fetchSeasons(showId: string) {
    return this.db
      .select({
        number: schema.seasons.number,
        name: schema.seasons.name,
        episodeCount: schema.seasons.episodeCount,
        posterPath: schema.seasons.posterPath,
        airDate: schema.seasons.airDate,
      })
      .from(schema.seasons)
      .where(eq(schema.seasons.showId, showId))
      .orderBy(asc(schema.seasons.number));
  }
}
