import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { type BackfillPage } from '@/modules/ingestion/domain/repositories/backfill-page.interface';
import {
  type IImdbBackfillRepository,
  type ImdbBackfillCandidate,
} from '@/modules/ingestion/domain/repositories/imdb-backfill.repository.interface';

@Injectable()
export class ImdbBackfillRepository implements IImdbBackfillRepository {
  private readonly logger = new Logger(ImdbBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findShowCandidates({ cursor, limit }: BackfillPage): Promise<ImdbBackfillCandidate[]> {
    const conditions = [
      eq(schema.mediaItems.type, MediaType.SHOW),
      isNull(schema.mediaItems.imdbId),
      isNull(schema.mediaItems.deletedAt),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    return withDbError('find IMDb backfill candidates', this.logger, () =>
      this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(limit),
    );
  }

  async saveShowImdbId(tmdbId: number, imdbId: string): Promise<void> {
    await withDbError(
      'persist IMDb id',
      this.logger,
      () =>
        this.db
          .update(schema.mediaItems)
          .set({ imdbId })
          .where(
            and(eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, MediaType.SHOW)),
          ),
      { tmdbId, imdbId },
    );
  }
}
