import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import type { NormalizedSeason } from '../../../ingestion/public';
import { type DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import {
  type CalendarEpisode,
  type IShowRepository,
  type ShowDetails,
  type ShowListItem,
  type TrendingShowItem,
  type TrendingShowsOptions,
} from '../../domain/repositories/show.repository.interface';
import type { WithTotal } from '../../domain/types/query.types';
import { type DatabaseTransaction, toDrizzleTx } from '../../domain/types/transaction.type';
import { PersistenceMapper } from '../mappers/persistence.mapper';
import { CalendarEpisodesQuery } from '../queries/calendar-episodes.query';
import { ShowDetailsQuery } from '../queries/show-details.query';
import { TrendingShowsQuery } from '../queries/trending-shows.query';

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
    private readonly showDetailsQuery: ShowDetailsQuery,
    private readonly calendarEpisodesQuery: CalendarEpisodesQuery,
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
      .values(PersistenceMapper.toShowInsert(mediaId, details))
      .onConflictDoUpdate({
        target: schema.shows.mediaItemId,
        set: PersistenceMapper.toShowUpdate(details),
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
    drizzleTx: ReturnType<typeof toDrizzleTx>,
    showId: string,
    seasons: ShowDetailsPayload['seasons'],
  ): Promise<void> {
    if (!seasons) return;

    for (const season of seasons) {
      const [seasonRecord] = await drizzleTx
        .insert(schema.seasons)
        .values(PersistenceMapper.toSeasonInsert(showId, season))
        .onConflictDoUpdate({
          target: [schema.seasons.showId, schema.seasons.number],
          set: PersistenceMapper.toSeasonUpdate(season),
        })
        .returning({ id: schema.seasons.id });

      await this.upsertEpisodes(drizzleTx, seasonRecord.id, showId, season.episodes);
    }
  }

  /**
   * Upserts episodes for a season.
   */
  private async upsertEpisodes(
    drizzleTx: ReturnType<typeof toDrizzleTx>,
    seasonId: string,
    showId: string,
    episodes: ShowDetailsPayload['seasons'][number]['episodes'] | undefined,
  ): Promise<void> {
    if (!episodes?.length) return;

    for (const ep of episodes) {
      await drizzleTx
        .insert(schema.episodes)
        .values(PersistenceMapper.toEpisodeInsert(seasonId, showId, ep))
        .onConflictDoUpdate({
          target: [schema.episodes.seasonId, schema.episodes.number],
          set: PersistenceMapper.toEpisodeUpdate(ep),
        });
    }
  }

  /**
   * Saves drop-off analysis for a show.
   */
  async saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void> {
    try {
      await this.db
        .update(schema.shows)
        .set({ dropOffAnalysis: analysis })
        .where(
          eq(
            schema.shows.mediaItemId,
            this.db
              .select({ id: schema.mediaItems.id })
              .from(schema.mediaItems)
              .where(eq(schema.mediaItems.tmdbId, tmdbId))
              .limit(1),
          ),
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to save drop-off analysis for ${tmdbId}: ${message}`);
      throw new DatabaseException(`Failed to save drop-off analysis for ${tmdbId}`, {
        originalError: message,
      });
    }
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
  async findTrending(options: TrendingShowsOptions): Promise<WithTotal<TrendingShowItem>> {
    return this.trendingShowsQuery.execute(options) as unknown as WithTotal<TrendingShowItem>;
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
    try {
      const shows = await this.db
        .select({
          tmdbId: schema.mediaItems.tmdbId,
          title: schema.mediaItems.title,
        })
        .from(schema.mediaItems)
        .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(eq(schema.mediaItems.type, MediaType.SHOW))
        .limit(limit);

      return shows;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find shows for analysis: ${message}`);
      throw new DatabaseException('Failed to fetch shows for analysis', {
        originalError: message,
      });
    }
  }

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   */
  async getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null> {
    try {
      const result = await this.db
        .select({ dropOffAnalysis: schema.shows.dropOffAnalysis })
        .from(schema.shows)
        .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(eq(schema.mediaItems.tmdbId, tmdbId))
        .limit(1);

      return result[0]?.dropOffAnalysis || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get drop-off analysis for ${tmdbId}: ${message}`);
      throw new DatabaseException(`Failed to get drop-off analysis for ${tmdbId}`, {
        originalError: message,
      });
    }
  }
}
