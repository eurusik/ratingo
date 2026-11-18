import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray, isNull, notExists, notInArray, or, type SQL, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type CalendarEpisode,
  type CalendarEpisodesOptions,
  type IShowRepository,
  type NewEpisodeItem,
  type ShowDetails,
  type ShowIdentity,
  type ShowListItem,
  type TrendingShowItem,
  type TrendingShowsOptions,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import type { TrendingQueryResult } from '@/modules/catalog/domain/types/query.types';
import { type DatabaseTransaction } from '@/modules/catalog/domain/types/transaction.type';
import type { NormalizedSeason } from '@/modules/shared/contracts';
import { type DropOffAnalysis } from '@/modules/shared/drop-off-analyzer';

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
interface PrunedEpisode {
  airDate: Date | null;
}

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
      if (this.coversAllSeasons(details.seasons, details.totalSeasons)) {
        await this.pruneStaleSeasons(
          drizzleTx,
          showId,
          details.seasons.map((s) => s.number),
        );
      }
    }
  }

  /**
   * Upserts seasons and their episodes.
   */
  private async upsertSeasons(
    drizzleTx: DrizzleTransaction,
    showId: string,
    seasons: NormalizedSeason[],
  ): Promise<void> {
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

      const seasonCameWithEpisodes = season.episodes.length > 0;
      if (seasonCameWithEpisodes) {
        const pruned = await this.deletePrunableEpisodesMissingFrom(
          drizzleTx,
          seasonRecord.id,
          season.episodes.map((ep) => ep.number),
        );
        this.logPrunedEpisodes(pruned, `season ${season.number} of show ${showId}`);
      }
    }
  }

  private coversAllSeasons(seasons: NormalizedSeason[], totalSeasons?: number | null): boolean {
    const regularSeasonCount = seasons.filter((s) => s.number > 0).length;
    return regularSeasonCount >= (totalSeasons ?? 0);
  }

  private async deletePrunableEpisodesMissingFrom(
    drizzleTx: DrizzleTransaction,
    seasonId: string,
    keptEpisodeNumbers: number[],
  ): Promise<PrunedEpisode[]> {
    return drizzleTx
      .delete(schema.episodes)
      .where(
        and(
          eq(schema.episodes.seasonId, seasonId),
          notInArray(schema.episodes.number, keptEpisodeNumbers),
          this.isPrunableEpisode(drizzleTx),
        ),
      )
      .returning({ airDate: schema.episodes.airDate });
  }

  private logPrunedEpisodes(pruned: PrunedEpisode[], scope: string): void {
    if (pruned.length === 0) return;
    const undated = pruned.filter((episode) => episode.airDate === null).length;
    this.logger.log(
      `Pruned ${pruned.length} stale episode(s) from ${scope}; ${undated} were undated and lost any watch marks with them`,
    );
  }

  private async pruneStaleSeasons(
    drizzleTx: DrizzleTransaction,
    showId: string,
    keptSeasonNumbers: number[],
  ): Promise<void> {
    const isStaleSeason = and(
      eq(schema.seasons.showId, showId),
      notInArray(schema.seasons.number, keptSeasonNumbers),
    );

    const prunedEpisodes = await this.deletePrunableEpisodesOfSeasons(drizzleTx, isStaleSeason);
    this.logPrunedEpisodes(prunedEpisodes, `stale seasons of show ${showId}`);
    const removedNumbers = await this.deleteEmptySeasons(drizzleTx, isStaleSeason);

    if (removedNumbers.length > 0) {
      this.logger.log(`Pruned stale season(s) ${removedNumbers.join(', ')} of show ${showId}`);
    }
  }

  private async deletePrunableEpisodesOfSeasons(
    drizzleTx: DrizzleTransaction,
    seasonFilter: SQL | undefined,
  ): Promise<PrunedEpisode[]> {
    return drizzleTx
      .delete(schema.episodes)
      .where(
        and(
          inArray(
            schema.episodes.seasonId,
            drizzleTx.select({ id: schema.seasons.id }).from(schema.seasons).where(seasonFilter),
          ),
          this.isPrunableEpisode(drizzleTx),
        ),
      )
      .returning({ airDate: schema.episodes.airDate });
  }

  private async deleteEmptySeasons(
    drizzleTx: DrizzleTransaction,
    seasonFilter: SQL | undefined,
  ): Promise<number[]> {
    const removed = await drizzleTx
      .delete(schema.seasons)
      .where(
        and(
          seasonFilter,
          notExists(
            drizzleTx
              .select({ id: schema.episodes.id })
              .from(schema.episodes)
              .where(eq(schema.episodes.seasonId, schema.seasons.id)),
          ),
        ),
      )
      .returning({ number: schema.seasons.number });
    return removed.map((s) => s.number);
  }

  private isPrunableEpisode(drizzleTx: DrizzleTransaction): SQL | undefined {
    return or(
      isNull(schema.episodes.airDate),
      notExists(
        drizzleTx
          .select({ episodeId: schema.userEpisodeProgress.episodeId })
          .from(schema.userEpisodeProgress)
          .where(eq(schema.userEpisodeProgress.episodeId, schema.episodes.id)),
      ),
    );
  }

  /**
   * Upserts episodes for a season using batch INSERT.
   * Uses single INSERT with ON CONFLICT DO UPDATE for better performance.
   */
  private async upsertEpisodes(
    drizzleTx: DrizzleTransaction,
    seasonId: string,
    showId: string,
    episodes: NormalizedSeason['episodes'] | undefined,
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
        // COALESCE keeps existing enrichment (e.g. TMDB tmdbId/stillPath) when a
        // sparser provider (e.g. TVMaze) sends null for the column.
        set: {
          tmdbId: sql`COALESCE(excluded.tmdb_id, ${schema.episodes.tmdbId})`,
          title: sql`COALESCE(excluded.title, ${schema.episodes.title})`,
          overview: sql`COALESCE(excluded.overview, ${schema.episodes.overview})`,
          airDate: sql`COALESCE(excluded.air_date, ${schema.episodes.airDate})`,
          runtime: sql`COALESCE(excluded.runtime, ${schema.episodes.runtime})`,
          stillPath: sql`COALESCE(excluded.still_path, ${schema.episodes.stillPath})`,
          voteAverage: sql`COALESCE(excluded.vote_average, ${schema.episodes.voteAverage})`,
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
   * Finds episodes airing within a date range for the global or personalized calendar.
   */
  async findEpisodesByDateRange(
    startDate: Date,
    endDate: Date,
    options?: CalendarEpisodesOptions,
  ): Promise<CalendarEpisode[]> {
    return this.calendarEpisodesQuery.execute(startDate, endDate, options);
  }

  /**
   * Finds minimal show identity by slug (id, tmdbId, lastSyncedAt).
   * Slug is unique per (type, slug), so filter type=show and exclude soft-deleted rows.
   */
  async findIdentityBySlug(slug: string): Promise<ShowIdentity | null> {
    return withDbError(
      'find show identity by slug',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            lastSyncedAt: schema.mediaItems.lastSyncedAt,
          })
          .from(schema.mediaItems)
          .where(
            and(
              eq(schema.mediaItems.slug, slug),
              eq(schema.mediaItems.type, MediaType.SHOW),
              isNull(schema.mediaItems.deletedAt),
            ),
          )
          .limit(1);

        return result[0] ?? null;
      },
      { slug },
    );
  }

  /**
   * Gets shows for drop-off analysis.
   * Excludes soft-deleted shows and returns the stalest first (never analyzed, then oldest
   * analyzedAt) so repeated batch runs rotate through the catalog instead of re-analyzing
   * the same arbitrary N shows.
   */
  async findShowsForAnalysis(limit: number): Promise<ShowListItem[]> {
    return withDbError(
      'find shows for analysis',
      this.logger,
      async () => {
        return (
          this.db
            .select({
              tmdbId: schema.mediaItems.tmdbId,
              title: schema.mediaItems.title,
            })
            .from(schema.mediaItems)
            .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
            .where(
              and(eq(schema.mediaItems.type, MediaType.SHOW), isNull(schema.mediaItems.deletedAt)),
            )
            // analyzedAt is an ISO-8601 string inside the jsonb, so text order == chronological order
            .orderBy(
              sql`${schema.shows.dropOffAnalysis}->>'analyzedAt' ASC NULLS FIRST`,
              schema.mediaItems.id,
            )
            .limit(limit)
        );
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
