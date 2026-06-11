import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, count, eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { USER_MEDIA_STATE } from '../../../user-media/public';

/**
 * Counts the number of shows a user is currently watching.
 *
 * Used by the personalized calendar to distinguish between:
 * - User has no shows in "watching" state (watchingShowsCount === 0)
 * - User has watching shows but none air this week (watchingShowsCount > 0, days empty)
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class WatchingShowsCountQuery {
  private readonly logger = new Logger(WatchingShowsCountQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Returns the number of media items the user has in "watching" state.
   *
   * @param {string} userId - The authenticated user's ID
   * @returns {Promise<number>} Count of shows currently being watched
   * @throws {DatabaseException} When database query fails
   */
  async execute(userId: string): Promise<number> {
    try {
      const [result] = await this.db
        .select({ count: count() })
        .from(schema.userMediaState)
        .innerJoin(schema.mediaItems, eq(schema.userMediaState.mediaItemId, schema.mediaItems.id))
        .where(
          and(
            eq(schema.userMediaState.userId, userId),
            eq(schema.userMediaState.state, USER_MEDIA_STATE.WATCHING),
            eq(schema.mediaItems.type, MediaType.SHOW),
          ),
        );

      return result?.count ?? 0;
    } catch (error) {
      this.logger.error(
        'Failed to count watching shows',
        error instanceof Error ? error.stack : undefined,
      );
      throw new DatabaseException('Failed to count watching shows', error);
    }
  }
}
