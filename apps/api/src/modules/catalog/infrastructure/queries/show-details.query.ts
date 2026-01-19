import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, asc, and, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { type ShowStatus } from '../../../../common/enums/show-status.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type ShowDetails } from '../../domain/repositories/show.repository.interface';
import { CreditsMapper } from '../mappers/credits.mapper';
import { MediaWatchOffersMapper } from '../mappers/media-watch-offers.mapper';

import { GenreQuery } from './shared/genre.query';
import { WatchOffersQuery } from './shared/watch-offers.query';

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
    private readonly genreQuery: GenreQuery,
    private readonly watchOffersQuery: WatchOffersQuery,
  ) {}

  /**
   * Executes the show details query.
   * Returns any ready show regardless of eligibility status.
   * Detail pages should be accessible for all content.
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
          watchProvidersRaw: schema.mediaItems.watchProvidersRaw,
          rating: schema.mediaItems.rating,
          voteCount: schema.mediaItems.voteCount,
          releaseDate: schema.mediaItems.releaseDate,

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
        .innerJoin(schema.shows, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(
          and(
            eq(schema.mediaItems.slug, slug),
            // Ready filter: only show items with ready ingestion status
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            // Not deleted filter
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .limit(1);

      if (result.length === 0) return null;
      const show = result[0];

      // Fetch genres, seasons, and watch offers in parallel
      const [genres, seasons, watchOffers] = await Promise.all([
        this.genreQuery.fetchForMediaItem(show.id),
        show.showId ? this.fetchSeasons(show.showId) : Promise.resolve([]),
        this.watchOffersQuery.fetchForMediaItem(show.id),
      ]);

      const { showId: _showId, ...showData } = show;

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
        availability: MediaWatchOffersMapper.toAvailability(watchOffers, show.watchProvidersRaw),
        releaseDate: showData.releaseDate,

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
   * Fetches seasons with episodes for a show.
   */
  private async fetchSeasons(showId: string) {
    // Fetch seasons and episodes in parallel
    const [seasonsData, episodesData] = await Promise.all([
      this.db
        .select({
          number: schema.seasons.number,
          name: schema.seasons.name,
          episodeCount: schema.seasons.episodeCount,
          posterPath: schema.seasons.posterPath,
          airDate: schema.seasons.airDate,
        })
        .from(schema.seasons)
        .where(eq(schema.seasons.showId, showId))
        .orderBy(asc(schema.seasons.number)),

      this.db
        .select({
          seasonNumber: schema.seasons.number,
          number: schema.episodes.number,
          title: schema.episodes.title,
          airDate: schema.episodes.airDate,
          runtime: schema.episodes.runtime,
          stillPath: schema.episodes.stillPath,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
        .where(eq(schema.seasons.showId, showId))
        .orderBy(asc(schema.seasons.number), asc(schema.episodes.number)),
    ]);

    // Group episodes by season number
    const episodesBySeason = new Map<number, typeof episodesData>();
    for (const ep of episodesData) {
      const existing = episodesBySeason.get(ep.seasonNumber) ?? [];
      existing.push(ep);
      episodesBySeason.set(ep.seasonNumber, existing);
    }

    // Attach episodes to seasons
    return seasonsData.map((season) => ({
      ...season,
      episodes: (episodesBySeason.get(season.number) ?? []).map(
        ({ seasonNumber: _seasonNumber, ...ep }) => ep,
      ),
    }));
  }
}
