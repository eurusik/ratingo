import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, desc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';
import { ImageMapper } from '@/common/mappers/image.mapper';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import type {
  AnticipatedShow,
  AnticipatedShowsQueryOptions,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import { EvaluationContext } from '@/modules/catalog-policy/public';

import { eligibleUnderActivePolicy } from './shared/movie-release-conditions';

interface AnticipatedShowRow {
  mediaItemId: string;
  slug: string;
  title: string;
  posterPath: string | null;
  premiereDate: Date | null;
  listCount: number;
}

@Injectable()
export class AnticipatedShowsQuery {
  private readonly logger = new Logger(AnticipatedShowsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  execute(options: AnticipatedShowsQueryOptions): Promise<AnticipatedShow[]> {
    return withDbError(
      'fetch anticipated shows',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            mediaItemId: schema.mediaItems.id,
            slug: schema.mediaItems.slug,
            title: schema.mediaItems.title,
            posterPath: schema.mediaItems.posterPath,
            premiereDate: schema.mediaItems.releaseDate,
            listCount: schema.traktAnticipatedShows.listCount,
          })
          .from(schema.traktAnticipatedShows)
          .innerJoin(
            schema.mediaItems,
            and(
              eq(schema.mediaItems.tmdbId, schema.traktAnticipatedShows.tmdbId),
              eq(schema.mediaItems.type, MediaType.SHOW),
            ),
          )
          .where(
            and(
              gte(schema.traktAnticipatedShows.listCount, options.minListCount),
              eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
              isNull(schema.mediaItems.deletedAt),
              isNotNull(schema.mediaItems.posterPath),
              gte(schema.mediaItems.releaseDate, options.from),
              lt(schema.mediaItems.releaseDate, options.toExclusive),
              eligibleUnderActivePolicy([EvaluationContext.UPCOMING]),
            ),
          )
          .orderBy(
            asc(schema.mediaItems.releaseDate),
            desc(schema.traktAnticipatedShows.listCount),
            asc(schema.mediaItems.id),
          )
          .limit(options.limit);

        return rows.flatMap(toAnticipatedShow);
      },
      { limit: options.limit },
    );
  }
}

function toAnticipatedShow(row: AnticipatedShowRow): AnticipatedShow[] {
  const poster = ImageMapper.toPoster(row.posterPath);
  if (!poster || !row.premiereDate) return [];
  return [
    {
      mediaItemId: row.mediaItemId,
      slug: row.slug,
      title: row.title,
      poster,
      premiereDate: row.premiereDate,
      listCount: row.listCount,
    },
  ];
}
