import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, gte, inArray, isNull, lt, not, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { effectiveMovieReleaseDate } from '@/database/movie-release-conditions';
import * as schema from '@/database/schema';
import { SUBSCRIPTION_TRIGGER } from '@/modules/user-actions/domain/entities/user-subscription.entity';
import {
  type ClaimedMovieRelease,
  type MovieReleaseTrigger,
  type ReleaseDayWindow,
} from '@/modules/user-actions/domain/repositories/user-subscription.repository.interface';
import {
  type ClaimedMovieReleaseRow,
  toMovieReleaseNotice,
} from '@/modules/user-actions/infrastructure/mappers/claimed-movie-release.mapper';

const OTHER_SUBSCRIPTIONS_ALIAS = 'other_subs';
const otherSubscriptions = alias(schema.userSubscriptions, OTHER_SUBSCRIPTIONS_ALIAS);

@Injectable()
export class ClaimMovieReleasesQuery {
  private readonly logger = new Logger(ClaimMovieReleasesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async claim(
    trigger: MovieReleaseTrigger,
    window: ReleaseDayWindow,
  ): Promise<ClaimedMovieRelease[]> {
    const rows = await this.claimMovieReleaseRows(trigger, window);
    const claimed: ClaimedMovieRelease[] = [];
    const unresolvedIds: string[] = [];
    for (const row of rows) {
      const release = toMovieReleaseNotice(trigger, row);
      if (release)
        claimed.push({ id: row.id, userId: row.userId, mediaItemId: row.mediaItemId, release });
      else unresolvedIds.push(row.id);
    }
    if (unresolvedIds.length > 0) {
      this.logger.error(
        `Claimed ${unresolvedIds.length} ${trigger} subscriptions without a release date`,
      );
      await this.handBack(unresolvedIds);
    }
    return claimed;
  }

  async handBack(subscriptionIds: string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    return withDbError(
      'release movie release claims',
      this.logger,
      async () => {
        await this.db
          .update(schema.userSubscriptions)
          .set({ lastNotifiedAt: null, updatedAt: new Date() })
          .where(inArray(schema.userSubscriptions.id, subscriptionIds));
      },
      { count: subscriptionIds.length },
    );
  }

  private claimMovieReleaseRows(
    trigger: MovieReleaseTrigger,
    window: ReleaseDayWindow,
  ): Promise<ClaimedMovieReleaseRow[]> {
    const claimedAt = new Date();
    return withDbError(
      'claim movie release notifications',
      this.logger,
      () =>
        this.db
          .update(schema.userSubscriptions)
          .set({ lastNotifiedAt: claimedAt, updatedAt: claimedAt })
          .from(schema.movies)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.movies.mediaItemId))
          .where(this.claimableMovieRelease(trigger, window))
          .returning({
            id: schema.userSubscriptions.id,
            userId: schema.userSubscriptions.userId,
            mediaItemId: schema.userSubscriptions.mediaItemId,
            theatricalReleaseDate: schema.movies.theatricalReleaseDate,
            digitalReleaseDate: schema.movies.digitalReleaseDate,
            releaseDate: schema.mediaItems.releaseDate,
            releases: schema.movies.releases,
          }),
      { trigger, from: window.from.toISOString() },
    );
  }

  private claimableMovieRelease(
    trigger: MovieReleaseTrigger,
    window: ReleaseDayWindow,
  ): SQL | undefined {
    const triggerDate = this.movieTriggerDate(trigger);
    return and(
      eq(schema.movies.mediaItemId, schema.userSubscriptions.mediaItemId),
      eq(schema.userSubscriptions.trigger, trigger),
      eq(schema.userSubscriptions.isActive, true),
      isNull(schema.userSubscriptions.lastNotifiedAt),
      isNull(schema.mediaItems.deletedAt),
      this.withinWindow(triggerDate, window),
      sql`${schema.userSubscriptions.createdAt} < ${triggerDate} + interval '1 day'`,
      trigger === SUBSCRIPTION_TRIGGER.RELEASE
        ? not(this.digitalReleaseNotifiedInSameWindow(window))
        : undefined,
    );
  }

  private withinWindow(date: SQL<Date | null>, window: ReleaseDayWindow): SQL | undefined {
    return and(gte(date, window.from.toISOString()), lt(date, window.toExclusive.toISOString()));
  }

  private movieTriggerDate(trigger: MovieReleaseTrigger): SQL<Date | null> {
    return trigger === SUBSCRIPTION_TRIGGER.RELEASE
      ? effectiveMovieReleaseDate()
      : sql<Date | null>`${schema.movies.digitalReleaseDate}`;
  }

  private digitalReleaseNotifiedInSameWindow(window: ReleaseDayWindow): SQL {
    const activeStreamingSubscription = and(
      eq(otherSubscriptions.userId, schema.userSubscriptions.userId),
      eq(otherSubscriptions.mediaItemId, schema.userSubscriptions.mediaItemId),
      eq(otherSubscriptions.trigger, SUBSCRIPTION_TRIGGER.ON_STREAMING),
      eq(otherSubscriptions.isActive, true),
    );
    const digitalReleaseDate = sql<Date | null>`${schema.movies.digitalReleaseDate}`;
    return sql`(${this.withinWindow(digitalReleaseDate, window)} and exists (select 1 from ${schema.userSubscriptions} ${sql.identifier(OTHER_SUBSCRIPTIONS_ALIAS)} where ${activeStreamingSubscription}))`;
  }
}
