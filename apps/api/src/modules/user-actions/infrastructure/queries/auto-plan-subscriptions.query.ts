import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, not, or, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { SAVED_ITEM_LIST } from '@/modules/user-actions/domain/entities';
import { type SubscriptionTrigger } from '@/modules/user-actions/domain/entities/user-subscription.entity';

@Injectable()
export class AutoPlanSubscriptionsQuery {
  private readonly logger = new Logger(AutoPlanSubscriptionsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findTriggersClosedToAutoPlan(
    userId: string,
    mediaItemId: string,
  ): Promise<SubscriptionTrigger[]> {
    return withDbError(
      'find triggers closed to auto plan',
      this.logger,
      async () => {
        const rows = await this.db
          .select({ trigger: schema.userSubscriptions.trigger })
          .from(schema.userSubscriptions)
          .where(
            and(
              this.forMedia(userId, mediaItemId),
              or(schema.userSubscriptions.isActive, not(schema.userSubscriptions.autoPlan)),
            ),
          );
        return rows.map((row) => row.trigger as SubscriptionTrigger);
      },
      { userId, mediaItemId },
    );
  }

  deactivateAbandoned(userId: string, mediaItemId: string): Promise<SubscriptionTrigger[]> {
    return withDbError(
      'deactivate abandoned auto plan subscriptions',
      this.logger,
      async () => {
        const rows = await this.db
          .update(schema.userSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              this.forMedia(userId, mediaItemId),
              schema.userSubscriptions.isActive,
              schema.userSubscriptions.autoPlan,
              not(this.stillSavedForLater(userId, mediaItemId)),
            ),
          )
          .returning({ trigger: schema.userSubscriptions.trigger });
        return rows.map((row) => row.trigger as SubscriptionTrigger);
      },
      { userId, mediaItemId },
    );
  }

  private forMedia(userId: string, mediaItemId: string) {
    return and(
      eq(schema.userSubscriptions.userId, userId),
      eq(schema.userSubscriptions.mediaItemId, mediaItemId),
    );
  }

  private stillSavedForLater(userId: string, mediaItemId: string) {
    return sql`exists (
      select 1 from ${schema.userSavedItems}
      where ${schema.userSavedItems.userId} = ${userId}
        and ${schema.userSavedItems.mediaItemId} = ${mediaItemId}
        and ${schema.userSavedItems.list} = ${SAVED_ITEM_LIST.FOR_LATER}
    )`;
  }
}
