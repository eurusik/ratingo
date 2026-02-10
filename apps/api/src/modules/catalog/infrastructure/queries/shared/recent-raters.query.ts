import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import * as schema from '../../../../../database/schema';
import type { RecentRater } from '../../../domain/types/common.types';

const RECENT_RATERS_LIMIT = 3;

@Injectable()
export class RecentRatersQuery {
  private readonly logger = new Logger(RecentRatersQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async fetchForMediaItem(mediaItemId: string): Promise<RecentRater[]> {
    return withDbError(
      'fetch recent raters for media item',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            userId: schema.users.id,
            username: schema.users.username,
            avatarUrl: schema.users.avatarUrl,
          })
          .from(schema.userMediaState)
          .innerJoin(schema.users, eq(schema.userMediaState.userId, schema.users.id))
          .where(
            and(
              eq(schema.userMediaState.mediaItemId, mediaItemId),
              isNotNull(schema.userMediaState.rating),
              eq(schema.users.isProfilePublic, true),
              eq(schema.users.showRatings, true),
            ),
          )
          .orderBy(desc(schema.userMediaState.updatedAt))
          .limit(RECENT_RATERS_LIMIT);

        return rows;
      },
      { mediaItemId },
    );
  }
}
