import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, exists, gt, isNull, or, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { hasUkrainianEpisodeTitle, hasUkrainianText } from '@/database/episode-text-conditions';
import * as schema from '@/database/schema';
import {
  type EpisodeDetails,
  type EpisodeDetailsBackfillCandidate,
  type EpisodeDetailsUpdate,
  type StoredEpisode,
} from '@/modules/ingestion/domain/models/episode-details.model';
import { type BackfillPage } from '@/modules/ingestion/domain/repositories/backfill-page.interface';
import { type IEpisodeDetailsBackfillRepository } from '@/modules/ingestion/domain/repositories/episode-details-backfill.repository.interface';

const UPDATE_CHUNK_SIZE = 500;

@Injectable()
export class EpisodeDetailsBackfillRepository implements IEpisodeDetailsBackfillRepository {
  private readonly logger = new Logger(EpisodeDetailsBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findCandidates({ cursor, limit }: BackfillPage): Promise<EpisodeDetailsBackfillCandidate[]> {
    const episodeMissingDetails = this.db
      .select({ id: schema.episodes.id })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
      .where(
        and(
          eq(schema.episodes.showId, schema.shows.id),
          gt(schema.seasons.number, 0),
          or(
            sql`NOT ${hasUkrainianEpisodeTitle(sql`${schema.episodes.title}`)}`,
            sql`NOT ${hasUkrainianText(sql`${schema.episodes.overview}`)}`,
            isNull(schema.episodes.airDate),
            isNull(schema.episodes.runtime),
            isNull(schema.episodes.stillPath),
            isNull(schema.episodes.voteAverage),
          ),
        ),
      );

    const conditions = [isNull(schema.mediaItems.deletedAt), exists(episodeMissingDetails)];
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
        .where(and(eq(schema.episodes.showId, showId), gt(schema.seasons.number, 0)))
        .orderBy(asc(schema.seasons.number), asc(schema.episodes.number)),
    );
  }

  async updateEpisodeDetails(updates: readonly EpisodeDetailsUpdate[]): Promise<void> {
    for (let start = 0; start < updates.length; start += UPDATE_CHUNK_SIZE) {
      const chunk = updates.slice(start, start + UPDATE_CHUNK_SIZE);
      await withDbError('update backfilled episode details', this.logger, () =>
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
        `),
      );
    }
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
