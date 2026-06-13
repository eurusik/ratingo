import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';

/**
 * Retrieves IDs of media items for score recalculation with pagination.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class RecalculationIdsQuery {
  private readonly logger = new Logger(RecalculationIdsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(options: { type?: MediaType; limit: number; offset: number }): Promise<string[]> {
    return withDbError(
      'find IDs for recalculation',
      this.logger,
      async () => {
        const conditions = [isNull(schema.mediaItems.deletedAt)];

        if (options.type) {
          conditions.push(eq(schema.mediaItems.type, options.type));
        }

        const rows = await this.db
          .select({ id: schema.mediaItems.id })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(options.limit)
          .offset(options.offset);

        return rows.map((r) => r.id);
      },
      { type: options.type, limit: options.limit, offset: options.offset },
    );
  }
}
