import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, gt, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type AltTitlesBackfillCandidate,
  type IAltTitlesBackfillRepository,
} from '../../domain/repositories/alt-titles-backfill.repository.interface';
import { type BackfillPage } from '../../domain/repositories/backfill-page.interface';

@Injectable()
export class AltTitlesBackfillRepository implements IAltTitlesBackfillRepository {
  private readonly logger = new Logger(AltTitlesBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findCandidates({ cursor, limit }: BackfillPage): Promise<AltTitlesBackfillCandidate[]> {
    const conditions = [
      isNull(schema.mediaItems.alternativeTitles),
      isNull(schema.mediaItems.deletedAt),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    return withDbError('find alt-titles backfill candidates', this.logger, () =>
      this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(limit),
    );
  }
}
