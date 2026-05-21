import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, asc, and, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type ShowDetails } from '../../domain/repositories/show.repository.interface';

import {
  GenreQuery,
  WatchOffersQuery,
  RecentRatersQuery,
  SHOW_DETAILS_SELECT_FIELDS,
  type ShowDetailsQueryRow,
  mapShowDetails,
} from './shared';

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
    private readonly recentRatersQuery: RecentRatersQuery,
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
        .select(SHOW_DETAILS_SELECT_FIELDS)
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
      const show = result[0] as ShowDetailsQueryRow;

      // Fetch genres, seasons, watch offers, and recent raters in parallel
      const [genres, seasons, watchOffers, recentRaters] = await Promise.all([
        this.genreQuery.fetchForMediaItem(show.id),
        show.showId ? this.fetchSeasons(show.showId) : Promise.resolve([]),
        this.watchOffersQuery.fetchForMediaItem(show.id),
        this.recentRatersQuery.fetchForMediaItem(show.id),
      ]);

      return mapShowDetails(show, genres, seasons, watchOffers, recentRaters);
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
          id: schema.episodes.id,
          number: schema.episodes.number,
          title: schema.episodes.title,
          airDate: schema.episodes.airDate,
          runtime: schema.episodes.runtime,
          stillPath: schema.episodes.stillPath,
          voteAverage: schema.episodes.voteAverage,
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

    // Attach episodes to seasons; override stored episodeCount with actual row count
    return seasonsData.map((season) => {
      const episodes = (episodesBySeason.get(season.number) ?? []).map(
        ({ seasonNumber: _seasonNumber, ...ep }) => ep,
      );
      return {
        ...season,
        episodeCount: episodes.length > 0 ? episodes.length : season.episodeCount,
        episodes,
      };
    });
  }
}
