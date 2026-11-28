import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { type EpisodeOverview } from '@/modules/catalog/domain/repositories/show.repository.interface';

@Injectable()
export class SeasonOverviewsQuery {
  private readonly logger = new Logger(SeasonOverviewsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  execute(slug: string, seasonNumber: number): Promise<EpisodeOverview[]> {
    return withDbError(
      'fetch season overviews',
      this.logger,
      () => this.select(slug, seasonNumber),
      { slug, seasonNumber },
    );
  }

  select(slug: string, seasonNumber: number) {
    return this.db
      .select({ number: schema.episodes.number, overview: schema.episodes.overview })
      .from(schema.mediaItems)
      .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .innerJoin(
        schema.seasons,
        and(eq(schema.seasons.showId, schema.shows.id), eq(schema.seasons.number, seasonNumber)),
      )
      .innerJoin(schema.episodes, eq(schema.episodes.seasonId, schema.seasons.id))
      .where(
        and(
          eq(schema.mediaItems.slug, slug),
          eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
          isNull(schema.mediaItems.deletedAt),
        ),
      )
      .orderBy(asc(schema.episodes.number), asc(schema.episodes.id));
  }
}
