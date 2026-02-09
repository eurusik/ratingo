import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, gt, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MS_PER_DAY } from '@/common/constants';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type FavoriteUpdateItem,
  type FavoriteUpdatesOptions,
  type UserMediaSummary,
} from '../../domain/repositories/user-media-state.repository.interface';

/** Season number 0 is used for "Specials" — we exclude them from episode queries. */
const SPECIALS_SEASON_NUMBER = 0;

/** If >= this many episodes share the same air date, it's a batch release (e.g. Netflix). */
const BATCH_RELEASE_THRESHOLD = 3;

/**
 * Fetches highly-rated shows with recent or upcoming episodes.
 *
 * Strategy: 3 sequential DB round-trips (steps 2a/2b run in parallel).
 * Each step depends on the previous result, so further parallelisation is not possible.
 *
 * 1. Base shows with user rating
 * 2. Latest aired + next upcoming episode per show (parallel via Promise.all)
 * 3. Batch release detection (count episodes sharing same air date)
 * 4. In-memory merge, filter by date range, limit
 *
 * @throws {DatabaseException} When any database query fails
 */
@Injectable()
export class FavoriteUpdatesQuery {
  private readonly logger = new Logger(FavoriteUpdatesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(userId: string, options: FavoriteUpdatesOptions): Promise<FavoriteUpdateItem[]> {
    return withDbError(
      'list favorite updates',
      this.logger,
      async () => {
        const now = new Date();
        const pastDate = new Date(now.getTime() - options.daysBack * MS_PER_DAY);
        const futureDate = new Date(now.getTime() + options.daysAhead * MS_PER_DAY);

        const baseRows = await this.fetchBaseShows(userId, options);
        if (baseRows.length === 0) return [];

        const showIds = baseRows.map((r) => r.showId);
        const [latestEpisodes, nextEpisodes] = await this.fetchEpisodes(showIds, now);

        const latestMap = new Map(latestEpisodes.map((e) => [e.showId, e]));
        const nextMap = new Map(nextEpisodes.map((e) => [e.showId, e]));

        const batchShowIds = await this.detectBatchReleases(latestEpisodes);

        return this.mergeResults(baseRows, latestMap, nextMap, batchShowIds, {
          pastDate,
          futureDate,
          limit: options.limit,
        });
      },
      { userId },
    );
  }

  private async fetchBaseShows(userId: string, options: FavoriteUpdatesOptions) {
    return this.db
      .select({
        mediaItemId: schema.userMediaState.mediaItemId,
        rating: schema.userMediaState.rating,
        showId: schema.shows.id,
        media: {
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          title: schema.mediaItems.title,
          slug: schema.mediaItems.slug,
          posterPath: schema.mediaItems.posterPath,
          releaseDate: schema.mediaItems.releaseDate,
        },
      })
      .from(schema.userMediaState)
      .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
      .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(
        and(
          eq(schema.userMediaState.userId, userId),
          gte(schema.userMediaState.rating, options.ratingThreshold),
          eq(schema.mediaItems.type, MediaType.SHOW),
        ),
      )
      .orderBy(desc(schema.userMediaState.rating))
      .limit(options.limit * 2);
  }

  private async fetchEpisodes(showIds: string[], now: Date) {
    return Promise.all([
      this.db
        .selectDistinctOn([schema.episodes.showId], {
          showId: schema.episodes.showId,
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
          title: schema.episodes.title,
          airDate: schema.episodes.airDate,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .where(
          and(
            inArray(schema.episodes.showId, showIds),
            isNotNull(schema.episodes.airDate),
            lte(schema.episodes.airDate, now),
            gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
          ),
        )
        .orderBy(
          schema.episodes.showId,
          desc(schema.episodes.airDate),
          desc(schema.seasons.number),
          desc(schema.episodes.number),
        ),

      this.db
        .selectDistinctOn([schema.episodes.showId], {
          showId: schema.episodes.showId,
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
          title: schema.episodes.title,
          airDate: schema.episodes.airDate,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .where(
          and(
            inArray(schema.episodes.showId, showIds),
            isNotNull(schema.episodes.airDate),
            gt(schema.episodes.airDate, now),
            gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
          ),
        )
        .orderBy(
          schema.episodes.showId,
          schema.episodes.airDate,
          schema.seasons.number,
          schema.episodes.number,
        ),
    ]);
  }

  private async detectBatchReleases(
    latestEpisodes: Array<{ showId: string; airDate: Date | null }>,
  ): Promise<Set<string>> {
    const airDatePairs = latestEpisodes
      .filter((e) => e.airDate != null)
      .map((e) => ({ showId: e.showId, airDate: e.airDate! }));

    if (airDatePairs.length === 0) return new Set();

    const batchCounts = await this.db
      .select({
        showId: schema.episodes.showId,
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
      .where(
        and(
          gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
          or(
            ...airDatePairs.map((p) =>
              and(eq(schema.episodes.showId, p.showId), eq(schema.episodes.airDate, p.airDate)),
            ),
          ),
        ),
      )
      .groupBy(schema.episodes.showId);

    const result = new Set<string>();
    for (const row of batchCounts) {
      if (row.count >= BATCH_RELEASE_THRESHOLD) {
        result.add(row.showId);
      }
    }
    return result;
  }

  private mergeResults(
    baseRows: Array<{
      mediaItemId: string;
      rating: number | null;
      showId: string;
      media: {
        id: string;
        type: string;
        title: string;
        slug: string;
        posterPath: string | null;
        releaseDate: Date | null;
      };
    }>,
    latestMap: Map<
      string,
      { seasonNumber: number; episodeNumber: number; title: string | null; airDate: Date | null }
    >,
    nextMap: Map<
      string,
      { seasonNumber: number; episodeNumber: number; title: string | null; airDate: Date | null }
    >,
    batchShowIds: Set<string>,
    { pastDate, futureDate, limit }: { pastDate: Date; futureDate: Date; limit: number },
  ): FavoriteUpdateItem[] {
    const results: FavoriteUpdateItem[] = [];

    for (const row of baseRows) {
      const latest = latestMap.get(row.showId);
      const next = nextMap.get(row.showId);

      const hasRecentOrUpcoming =
        (latest?.airDate && latest.airDate >= pastDate) ||
        (next?.airDate && next.airDate <= futureDate);

      if (!hasRecentOrUpcoming) continue;
      if (row.rating == null) continue;

      const isBatch = batchShowIds.has(row.showId);

      results.push({
        mediaItemId: row.mediaItemId,
        rating: row.rating,
        mediaSummary: this.mapMediaSummary(row.media),
        latestEpisode: latest
          ? {
              seasonNumber: latest.seasonNumber,
              episodeNumber: latest.episodeNumber,
              title: latest.title,
              airDate: latest.airDate,
              isBatchRelease: isBatch,
            }
          : null,
        nextEpisode: next
          ? {
              seasonNumber: next.seasonNumber,
              episodeNumber: next.episodeNumber,
              title: next.title,
              airDate: next.airDate,
              isBatchRelease: false,
            }
          : null,
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  private mapMediaSummary(media: {
    id: string;
    type: string;
    title: string;
    slug: string;
    posterPath: string | null;
    releaseDate: Date | null;
  }): UserMediaSummary {
    return {
      id: media.id,
      type: media.type as MediaType,
      title: media.title,
      slug: media.slug,
      poster: ImageMapper.toPoster(media.posterPath),
      releaseDate: media.releaseDate,
    };
  }
}
