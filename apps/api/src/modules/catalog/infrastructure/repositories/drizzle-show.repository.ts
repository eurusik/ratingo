import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  IShowRepository,
  ShowListItem,
  CalendarEpisode,
  ShowDetails,
  TrendingShowItem,
  TrendingShowsOptions,
} from '../../domain/repositories/show.repository.interface';
import { DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import { PersistenceMapper } from '../mappers/persistence.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

// Query Objects
import { TrendingShowsQuery } from '../queries/trending-shows.query';
import { ShowDetailsQuery } from '../queries/show-details.query';
import { CalendarEpisodesQuery } from '../queries/calendar-episodes.query';

type DbTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0];

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
    private readonly calendarEpisodesQuery: CalendarEpisodesQuery
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Write Operations (kept in repository)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Upserts show details, seasons, and episodes transactionally.
   */
  async upsertDetails(tx: DbTransaction, mediaId: string, details: any): Promise<void> {
    const [show] = await tx
      .insert(schema.shows)
      .values(PersistenceMapper.toShowInsert(mediaId, details))
      .onConflictDoUpdate({
        target: schema.shows.mediaItemId,
        set: PersistenceMapper.toShowUpdate(details),
      })
      .returning({ id: schema.shows.id });

    const showId = show.id;

    if (details.seasons?.length) {
      for (const season of details.seasons) {
        const [seasonRecord] = await tx
          .insert(schema.seasons)
          .values(PersistenceMapper.toSeasonInsert(showId, season))
          .onConflictDoUpdate({
            target: [schema.seasons.showId, schema.seasons.number],
            set: PersistenceMapper.toSeasonUpdate(season),
          })
          .returning({ id: schema.seasons.id });

        if (season.episodes?.length) {
          for (const ep of season.episodes) {
            await tx
              .insert(schema.episodes)
              .values(PersistenceMapper.toEpisodeInsert(seasonRecord.id, showId, ep))
              .onConflictDoUpdate({
                target: [schema.episodes.seasonId, schema.episodes.number],
                set: PersistenceMapper.toEpisodeUpdate(ep),
              });
          }
        }
      }
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
              .limit(1)
          )
        );
    } catch (error) {
      this.logger.error(
        `Failed to save drop-off analysis for ${tmdbId}: ${error.message}`,
        error.stack
      );
      throw new DatabaseException(`Failed to save drop-off analysis for ${tmdbId}`, {
        originalError: error.message,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Read Operations (delegated to Query Objects)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Finds full show details by slug.
   */
  async findBySlug(slug: string): Promise<ShowDetails | null> {
    return this.showDetailsQuery.execute(slug);
  }

  /**
   * Finds trending shows with filtering and pagination.
   */
  async findTrending(options: TrendingShowsOptions): Promise<TrendingShowItem[]> {
    return this.trendingShowsQuery.execute(options);
  }

  /**
   * Finds episodes airing within a date range for the global calendar.
   */
  async findEpisodesByDateRange(startDate: Date, endDate: Date): Promise<CalendarEpisode[]> {
    return this.calendarEpisodesQuery.execute(startDate, endDate);
  }

  // ─────────────────────────────────────────────────────────────────
  // Simple Read Operations (kept in repository - too small to extract)
  // ─────────────────────────────────────────────────────────────────

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
      this.logger.error(`Failed to find shows for analysis: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch shows for analysis', {
        originalError: error.message,
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
      this.logger.error(
        `Failed to get drop-off analysis for ${tmdbId}: ${error.message}`,
        error.stack
      );
      throw new DatabaseException(`Failed to get drop-off analysis for ${tmdbId}`, {
        originalError: error.message,
      });
    }
  }
}
