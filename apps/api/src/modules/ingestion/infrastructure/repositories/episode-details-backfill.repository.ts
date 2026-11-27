import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, exists, gt, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { hasUkrainianEpisodeTitle } from '@/database/episode-text-conditions';
import * as schema from '@/database/schema';
import { SPECIALS_SEASON_NUMBER } from '@/modules/ingestion/domain/constants/episode-details.constants';
import {
  type EpisodeDetails,
  type EpisodeDetailsBackfillCandidate,
  type EpisodeDetailsCandidatePage,
  type EpisodeDetailsUpdate,
  type EpisodeTitleRepairCandidate,
  type StoredEpisode,
} from '@/modules/ingestion/domain/models/episode-details.model';
import { type BackfillPage } from '@/modules/ingestion/domain/repositories/backfill-page.interface';
import { type IEpisodeDetailsBackfillRepository } from '@/modules/ingestion/domain/repositories/episode-details-backfill.repository.interface';

import { episodeNeedsTmdbDetails } from '../queries/episode-details-conditions';

const UPDATE_CHUNK_SIZE = 500;

@Injectable()
export class EpisodeDetailsBackfillRepository implements IEpisodeDetailsBackfillRepository {
  private readonly logger = new Logger(EpisodeDetailsBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findCandidates({
    cursor,
    limit,
    asOf,
    checkedBefore,
  }: EpisodeDetailsCandidatePage): Promise<EpisodeDetailsBackfillCandidate[]> {
    const conditions = [
      isNull(schema.mediaItems.deletedAt),
      or(
        isNull(schema.shows.episodeDetailsCheckedAt),
        lt(schema.shows.episodeDetailsCheckedAt, checkedBefore),
      ),
      exists(this.regularEpisodes(episodeNeedsTmdbDetails(asOf))),
    ];
    if (cursor) conditions.push(gt(schema.shows.id, cursor));

    return withDbError('find episode details backfill candidates', this.logger, () =>
      this.db
        .select({ showId: schema.shows.id, tmdbId: schema.mediaItems.tmdbId })
        .from(schema.shows)
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .where(and(...conditions))
        .orderBy(asc(schema.shows.id))
        .limit(limit),
    );
  }

  async findTitleRepairCandidates({
    cursor,
    limit,
  }: BackfillPage): Promise<EpisodeTitleRepairCandidate[]> {
    const conditions = [
      isNull(schema.mediaItems.deletedAt),
      isNotNull(schema.mediaItems.imdbId),
      exists(this.regularEpisodes(hasUkrainianEpisodeTitle(sql`${schema.episodes.title}`))),
    ];
    if (cursor) conditions.push(gt(schema.shows.id, cursor));

    const rows = await withDbError('find episode title repair candidates', this.logger, () =>
      this.db
        .select({
          showId: schema.shows.id,
          tmdbId: schema.mediaItems.tmdbId,
          imdbId: schema.mediaItems.imdbId,
        })
        .from(schema.shows)
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .where(and(...conditions))
        .orderBy(asc(schema.shows.id))
        .limit(limit),
    );
    return rows.flatMap(({ imdbId, ...row }) => (imdbId ? [{ ...row, imdbId }] : []));
  }

  private regularEpisodes(condition: SQL) {
    return this.db
      .select({ id: schema.episodes.id })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
      .where(
        and(
          eq(schema.episodes.showId, schema.shows.id),
          gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
          condition,
        ),
      );
  }

  findEpisodes(showId: string): Promise<StoredEpisode[]> {
    return withDbError('find episodes for details backfill', this.logger, () =>
      this.db
        .select({
          id: schema.episodes.id,
          seasonNumber: schema.seasons.number,
          number: schema.episodes.number,
          title: schema.episodes.title,
          overview: schema.episodes.overview,
          airDate: schema.episodes.airDate,
          runtime: schema.episodes.runtime,
          stillPath: schema.episodes.stillPath,
          rating: schema.episodes.voteAverage,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .where(
          and(
            eq(schema.episodes.showId, showId),
            gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
          ),
        )
        .orderBy(asc(schema.seasons.number), asc(schema.episodes.number)),
    );
  }

  async updateEpisodeDetails(updates: readonly EpisodeDetailsUpdate[]): Promise<number> {
    let applied = 0;
    for (let start = 0; start < updates.length; start += UPDATE_CHUNK_SIZE) {
      const chunk = updates.slice(start, start + UPDATE_CHUNK_SIZE);
      const rows = await withDbError('update backfilled episode details', this.logger, () =>
        this.db.execute(sql`
          UPDATE ${schema.episodes} AS e
          SET title = v.title,
            overview = v.overview,
            air_date = v.air_date,
            runtime = v.runtime,
            still_path = v.still_path,
            vote_average = v.vote_average
          FROM (VALUES ${sql.join(chunk.map(toValuesRow), sql`, `)})
            AS v(id, title, overview, air_date, runtime, still_path, vote_average,
              previous_title, previous_overview, previous_air_date, previous_runtime,
              previous_still_path, previous_vote_average)
          WHERE e.id = v.id
            AND e.title IS NOT DISTINCT FROM v.previous_title
            AND e.overview IS NOT DISTINCT FROM v.previous_overview
            AND e.air_date IS NOT DISTINCT FROM v.previous_air_date
            AND e.runtime IS NOT DISTINCT FROM v.previous_runtime
            AND e.still_path IS NOT DISTINCT FROM v.previous_still_path
            AND e.vote_average IS NOT DISTINCT FROM v.previous_vote_average
          RETURNING e.id
        `),
      );
      applied += rows.length;
    }
    return applied;
  }

  async markChecked(showId: string, checkedAt: Date): Promise<void> {
    await withDbError('mark episode details checked', this.logger, () =>
      this.db
        .update(schema.shows)
        .set({ episodeDetailsCheckedAt: checkedAt })
        .where(eq(schema.shows.id, showId)),
    );
  }

  async fillSeasonAirDatesFromEpisodes(): Promise<number> {
    const filled = await withDbError('fill season air dates from episodes', this.logger, () =>
      this.db.execute(sql`
        UPDATE ${schema.seasons} AS s
        SET air_date = first_aired.air_date
        FROM (
          SELECT season_id, min(air_date) AS air_date
          FROM ${schema.episodes}
          WHERE air_date IS NOT NULL
          GROUP BY season_id
        ) AS first_aired
        WHERE s.id = first_aired.season_id
          AND s.air_date IS NULL
        RETURNING s.id
      `),
    );
    return filled.length;
  }
}

function detailsValues(details: EpisodeDetails): SQL {
  return sql`${details.title}::text, ${details.overview}::text, ${details.airDate?.toISOString() ?? null}::timestamp, ${details.runtime}::integer, ${details.stillPath}::text, ${details.rating}::double precision`;
}

function toValuesRow({ id, next, previous }: EpisodeDetailsUpdate): SQL {
  return sql`(${id}::uuid, ${detailsValues(next)}, ${detailsValues(previous)})`;
}
