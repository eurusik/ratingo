import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type IShowStatusPort } from '../../domain/ports/show-status.port';

const ONGOING_STATUSES = new Set<string>([ShowStatus.RETURNING_SERIES, ShowStatus.IN_PRODUCTION]);

@Injectable()
export class DrizzleShowStatusAdapter implements IShowStatusPort {
  private readonly logger = new Logger(DrizzleShowStatusAdapter.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async isOngoing(showId: string): Promise<boolean> {
    const result = await withDbError(
      'check show ongoing status',
      this.logger,
      async () =>
        this.db
          .select({ status: schema.shows.status })
          .from(schema.shows)
          .where(eq(schema.shows.id, showId))
          .limit(1),
      { showId },
    );

    if (result.length === 0) return false;

    return ONGOING_STATUSES.has(result[0].status ?? '');
  }
}
