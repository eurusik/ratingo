import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, exists, gt, isNull, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { hasUkrainianEpisodeTitle } from '@/database/episode-text-conditions';
import * as schema from '@/database/schema';
import {
  type EpisodeTextsBackfillCandidate,
  type EpisodeTextUpdate,
  type StoredEpisodeText,
} from '@/modules/ingestion/domain/models/episode-text.model';
import { type BackfillPage } from '@/modules/ingestion/domain/repositories/backfill-page.interface';
import { type IEpisodeTextsBackfillRepository } from '@/modules/ingestion/domain/repositories/episode-texts-backfill.repository.interface';

const UPDATE_CHUNK_SIZE = 500;

@Injectable()
export class EpisodeTextsBackfillRepository implements IEpisodeTextsBackfillRepository {
  private readonly logger = new Logger(EpisodeTextsBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findCandidates({ cursor, limit }: BackfillPage): Promise<EpisodeTextsBackfillCandidate[]> {
    const untranslatedEpisode = this.db
      .select({ id: schema.episodes.id })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
      .where(
        and(
          eq(schema.episodes.showId, schema.shows.id),
          gt(schema.seasons.number, 0),
          sql`NOT ${hasUkrainianEpisodeTitle(sql`${schema.episodes.title}`)}`,
        ),
      );

    const conditions = [isNull(schema.mediaItems.deletedAt), exists(untranslatedEpisode)];
    if (cursor) conditions.push(gt(schema.shows.id, cursor));

    return withDbError('find episode texts backfill candidates', this.logger, () =>
      this.db
        .select({ showId: schema.shows.id, tmdbId: schema.mediaItems.tmdbId })
        .from(schema.shows)
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .where(and(...conditions))
        .orderBy(asc(schema.shows.id))
        .limit(limit),
    );
  }

  findEpisodes(showId: string): Promise<StoredEpisodeText[]> {
    return withDbError('find episode texts for backfill', this.logger, () =>
      this.db
        .select({
          id: schema.episodes.id,
          seasonNumber: schema.seasons.number,
          number: schema.episodes.number,
          title: schema.episodes.title,
          overview: schema.episodes.overview,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .where(and(eq(schema.episodes.showId, showId), gt(schema.seasons.number, 0)))
        .orderBy(asc(schema.seasons.number), asc(schema.episodes.number)),
    );
  }

  async updateEpisodeTexts(updates: readonly EpisodeTextUpdate[]): Promise<void> {
    for (let start = 0; start < updates.length; start += UPDATE_CHUNK_SIZE) {
      const chunk = updates.slice(start, start + UPDATE_CHUNK_SIZE);
      await withDbError('update backfilled episode texts', this.logger, () =>
        this.db.execute(sql`
          UPDATE ${schema.episodes} AS e
          SET title = v.title, overview = v.overview
          FROM (VALUES ${sql.join(chunk.map(toValuesRow), sql`, `)})
            AS v(id, title, overview, previous_title, previous_overview)
          WHERE e.id = v.id
            AND e.title IS NOT DISTINCT FROM v.previous_title
            AND e.overview IS NOT DISTINCT FROM v.previous_overview
        `),
      );
    }
  }
}

function toValuesRow(update: EpisodeTextUpdate): SQL {
  return sql`(${update.id}::uuid, ${update.title}::text, ${update.overview}::text, ${update.previousTitle}::text, ${update.previousOverview}::text)`;
}
