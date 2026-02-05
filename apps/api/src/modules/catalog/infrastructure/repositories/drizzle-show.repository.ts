import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import type { NormalizedSeason } from '../../../ingestion/public';
import { type DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import {
  type CalendarEpisode,
  type IShowRepository,
  type NewEpisodeItem,
  type ShowDetails,
  type ShowListItem,
  type TrendingShowItem,
  type TrendingShowsOptions,
} from '../../domain/repositories/show.repository.interface';
import type { TrendingQueryResult } from '../../domain/types/query.types';
import { type DatabaseTransaction } from '../../domain/types/transaction.type';
import { SeasonEpisodePersistenceMapper } from '../mappers/season-episode-persistence.mapper';
import { ShowPersistenceMapper } from '../mappers/show-persistence.mapper';
import { CalendarEpisodesQuery } from '../queries/calendar-episodes.query';
import { NewEpisodesQuery } from '../queries/new-episodes.query';
import { PopularShowsQuery } from '../queries/popular-shows.query';
import { ShowDetailsQuery } from '../queries/show-details.query';
import { TrendingShowsQuery } from '../queries/trending-shows.query';
import { toDrizzleTx, type DrizzleTransaction } from '../utils/drizzle-transaction';

/**
 * Show details payload for upsert operation.
 */
interface ShowDetailsPayload {
  totalSeasons?: number | null;
  totalEpisodes?: number | null;
  lastAirDate?: Date | null;
  nextAirDate?: Date | null;
  status?: string | null;
  seasons?: NormalizedSeason[];
}

/**
 * Drizzle implementation of IShowRepository.
 * Acts as a thin facade, delegating complex queries to Query Objects.
 */
@Injectable()
export class DrizzleShowRepository implements IShowRepository {
  private readonly logger = new Logger(DrizzleShowRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly trendingShowsQuery: TrendingShowsQuery,
    private readonly popularShowsQuery: PopularShowsQuery,
    private readonly showDetailsQuery: ShowDetailsQuery,
    private readonly calendarEpisodesQuery: CalendarEpisodesQuery,
    private readonly newEpisodesQuery: NewEpisodesQuery,
  ) {}

  /**
   * Upserts show details, seasons, and episodes transactionally.
   */
  async upsertDetails(
    tx: DatabaseTransaction,
    mediaId: string,
    details: ShowDetailsPayload,
  ): Promise<void> {
    const drizzleTx = toDrizzleTx(tx);
    const [show] = await drizzleTx
      .insert(schema.shows)
      .values(ShowPersistenceMapper.toShowInsert(mediaId, details))
      .onConflictDoUpdate({
        target: schema.shows.mediaItemId,
        set: ShowPersistenceMapper.toShowUpdate(details),
      })
      .returning({ id: schema.shows.id });

    const showId = show.id;

    if (details.seasons?.length) {
      await this.upsertSeasons(drizzleTx, showId, details.seasons);
    }
  }

  /**
   * Upserts seasons and their episodes.
   */
  private async upsertSeasons(
    drizzleTx: DrizzleTransaction,
    showId: string,
    seasons: ShowDetailsPayload['seasons'],
  ): Promise<void> {
    if (!seasons) return;

    for (const season of seasons) {
      const [seasonRecord] = await drizzleTx
        .insert(schema.seasons)
        .values(SeasonEpisodePersistenceMapper.toSeasonInsert(showId, season))
        .onConflictDoUpdate({
          target: [schema.seasons.showId, schema.seasons.number],
          set: SeasonEpisodePersistenceMapper.toSeasonUpdate(season),
        })
        .returning({ id: schema.seasons.id });

      await this.upsertEpisodes(drizzleTx, seasonRecord.id, showId, season.episodes);
    }
  }

  /**
   * Upserts episodes for a season using batch INSERT.
   * Uses single INSERT with ON CONFLICT DO UPDATE for better performance.
   */
  private async upsertEpisodes(
    drizzleTx: DrizzleTransaction,
    seasonId: string,
    showId: string,
    episodes: ShowDetailsPayload['seasons'][number]['episodes'] | undefined,
  ): Promise<void> {
    if (!episodes?.length) return;

    const values = episodes.map((ep) =>
      SeasonEpisodePersistenceMapper.toEpisodeInsert(seasonId, showId, ep),
    );

    await drizzleTx
      .insert(schema.episodes)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.episodes.seasonId, schema.episodes.number],
        set: {
          tmdbId: sql`excluded.tmdb_id`,
          title: sql`excluded.title`,
          overview: sql`excluded.overview`,
          airDate: sql`excluded.air_date`,
          runtime: sql`excluded.runtime`,
          stillPath: sql`excluded.still_path`,
          voteAverage: sql`excluded.vote_average`,
        },
      });
  }

  /**
   * Saves drop-off analysis for a show.
   */
  async saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void> {
    return withDbError(
      'save drop-off analysis',
      this.logger,
      async () => {
        const result = await this.db
          .select({ mediaItemId: schema.shows.mediaItemId })
          .from(schema.shows)
          .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .where(eq(schema.mediaItems.tmdbId, tmdbId))
          .limit(1);

        if (result.length === 0) {
          this.logger.warn(`No show found for tmdbId ${tmdbId}, skipping drop-off analysis save`);
          return;
        }

        await this.db
          .update(schema.shows)
          .set({ dropOffAnalysis: analysis })
          .where(eq(schema.shows.mediaItemId, result[0].mediaItemId));
      },
      { tmdbId },
    );
  }

  /**
   * Finds full show details by slug.
   */
  async findBySlug(slug: string): Promise<ShowDetails | null> {
    return this.showDetailsQuery.execute(slug);
  }

  /**
   * Finds trending shows with filtering and pagination.
   */
  async findTrending(
    options: TrendingShowsOptions,
  ): Promise<TrendingQueryResult<TrendingShowItem>> {
    return this.trendingShowsQuery.execute(options);
  }

  /**
   * Finds popular shows (historically popular, no freshness gate).
   */
  async findPopular(options: TrendingShowsOptions): Promise<TrendingQueryResult<TrendingShowItem>> {
    return this.popularShowsQuery.execute(options);
  }

  /**
   * Finds shows with new episodes within a recent time window.
   * Groups by show and returns only the latest episode per show.
   */
  async findNewEpisodes(days: number, limit: number): Promise<NewEpisodeItem[]> {
    return this.newEpisodesQuery.execute(days, limit);
  }

  /**
   * Finds episodes airing within a date range for the global calendar.
   */
  async findEpisodesByDateRange(startDate: Date, endDate: Date): Promise<CalendarEpisode[]> {
    return this.calendarEpisodesQuery.execute(startDate, endDate);
  }

  /**
   * Gets shows for drop-off analysis.
   */
  async findShowsForAnalysis(limit: number): Promise<ShowListItem[]> {
    return withDbError(
      'find shows for analysis',
      this.logger,
      async () => {
        return this.db
          .select({
            tmdbId: schema.mediaItems.tmdbId,
            title: schema.mediaItems.title,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .where(eq(schema.mediaItems.type, MediaType.SHOW))
          .limit(limit);
      },
      { limit },
    );
  }

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   */
  async getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null> {
    return withDbError(
      'get drop-off analysis',
      this.logger,
      async () => {
        const result = await this.db
          .select({ dropOffAnalysis: schema.shows.dropOffAnalysis })
          .from(schema.shows)
          .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .where(eq(schema.mediaItems.tmdbId, tmdbId))
          .limit(1);

        return result[0]?.dropOffAnalysis ?? null;
      },
      { tmdbId },
    );
  }
}
