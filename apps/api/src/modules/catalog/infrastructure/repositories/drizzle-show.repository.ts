import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, asc, and, gte, lte } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IShowRepository, ShowListItem, CalendarEpisode } from '../../domain/repositories/show.repository.interface';
import { DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import { NormalizedSeason } from '../../../ingestion/domain/models/normalized-media.model';

type DbTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0];

/**
 * Drizzle implementation of IShowRepository.
 * Handles show-specific database operations.
 */
@Injectable()
export class DrizzleShowRepository implements IShowRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Upserts show details, seasons, and episodes transactionally.
   */
  async upsertDetails(
    tx: DbTransaction,
    mediaId: string,
    details: {
      totalSeasons?: number | null;
      totalEpisodes?: number | null;
      lastAirDate?: Date | null;
      nextAirDate?: Date | null;
      status?: string | null;
      seasons?: NormalizedSeason[];
    }
  ): Promise<void> {
    // 1. Upsert Show Base
    const [show] = await tx
      .insert(schema.shows)
      .values({
        mediaItemId: mediaId,
        totalSeasons: details.totalSeasons,
        totalEpisodes: details.totalEpisodes,
        lastAirDate: details.lastAirDate,
        nextAirDate: details.nextAirDate,
        status: details.status,
      })
      .onConflictDoUpdate({
        target: schema.shows.mediaItemId,
        set: {
          totalSeasons: details.totalSeasons,
          totalEpisodes: details.totalEpisodes,
          lastAirDate: details.lastAirDate,
          nextAirDate: details.nextAirDate,
          status: details.status,
        },
      })
      .returning({ id: schema.shows.id });

    const showId = show.id;

    // 2. Upsert Seasons & Episodes
    if (details.seasons?.length) {
      for (const season of details.seasons) {
        // Upsert Season
        const [seasonRecord] = await tx
          .insert(schema.seasons)
          .values({
            showId: showId,
            tmdbId: season.tmdbId,
            number: season.number,
            name: season.name,
            overview: season.overview,
            posterPath: season.posterPath,
            airDate: season.airDate,
            episodeCount: season.episodeCount,
          })
          .onConflictDoUpdate({
            target: [schema.seasons.showId, schema.seasons.number],
            set: {
              tmdbId: season.tmdbId,
              name: season.name,
              overview: season.overview,
              posterPath: season.posterPath,
              airDate: season.airDate,
              episodeCount: season.episodeCount,
            },
          })
          .returning({ id: schema.seasons.id });

        // Upsert Episodes
        if (season.episodes?.length) {
          for (const ep of season.episodes) {
            await tx
              .insert(schema.episodes)
              .values({
                seasonId: seasonRecord.id,
                showId: showId,
                tmdbId: ep.tmdbId,
                number: ep.number,
                title: ep.title,
                overview: ep.overview,
                airDate: ep.airDate,
                runtime: ep.runtime,
                stillPath: ep.stillPath,
                voteAverage: ep.rating,
              })
              .onConflictDoUpdate({
                target: [schema.episodes.seasonId, schema.episodes.number],
                set: {
                  tmdbId: ep.tmdbId,
                  title: ep.title,
                  overview: ep.overview,
                  airDate: ep.airDate,
                  runtime: ep.runtime,
                  stillPath: ep.stillPath,
                  voteAverage: ep.rating,
                },
              });
          }
        }
      }
    }
  }

  /**
   * Finds episodes airing within a date range for the global calendar.
   */
  async findEpisodesByDateRange(startDate: Date, endDate: Date): Promise<CalendarEpisode[]> {
    const results = await this.db
      .select({
        showId: schema.shows.mediaItemId,
        showTitle: schema.mediaItems.title,
        posterPath: schema.mediaItems.posterPath,
        seasonNumber: schema.seasons.number,
        episodeNumber: schema.episodes.number,
        title: schema.episodes.title,
        overview: schema.episodes.overview,
        airDate: schema.episodes.airDate,
        runtime: schema.episodes.runtime,
        stillPath: schema.episodes.stillPath,
      })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
      .innerJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
      .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(
        and(
          gte(schema.episodes.airDate, startDate),
          lte(schema.episodes.airDate, endDate)
        )
      )
      .orderBy(asc(schema.episodes.airDate));

    return results.map(row => ({
      showId: row.showId,
      showTitle: row.showTitle,
      posterPath: row.posterPath,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      title: row.title,
      overview: row.overview,
      airDate: row.airDate!, // Safe assertion due to query constraint
      runtime: row.runtime,
      stillPath: row.stillPath,
    }));
  }

  /**
   * Gets shows for drop-off analysis.
   */
  async findShowsForAnalysis(limit: number): Promise<ShowListItem[]> {
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
  }

  /**
   * Saves drop-off analysis for a show.
   * Uses single query with subquery for efficiency.
   */
  async saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void> {
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
  }

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   */
  async getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null> {
    const result = await this.db
      .select({ dropOffAnalysis: schema.shows.dropOffAnalysis })
      .from(schema.shows)
      .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(eq(schema.mediaItems.tmdbId, tmdbId))
      .limit(1);

    return result[0]?.dropOffAnalysis || null;
  }
}
