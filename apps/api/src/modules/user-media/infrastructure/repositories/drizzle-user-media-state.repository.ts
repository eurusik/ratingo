import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type UserMediaState,
  USER_MEDIA_STATE,
} from '../../domain/entities/user-media-state.entity';
import {
  type ContinuePoint,
  type FavoriteUpdateItem,
  type FavoriteUpdatesOptions,
  type IUserMediaStateRepository,
  type ListWithMediaOptions,
  type ProgressSummary,
  USER_MEDIA_LIST_SORT,
  type UserMediaStats,
  type UserMediaSummary,
  type UpsertUserMediaStateData,
} from '../../domain/repositories/user-media-state.repository.interface';
import { FavoriteUpdatesQuery } from '../queries/favorite-updates.query';

@Injectable()
export class DrizzleUserMediaStateRepository implements IUserMediaStateRepository {
  private static readonly BATCH_SIZE = 500;

  private readonly logger = new Logger(DrizzleUserMediaStateRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly favoriteUpdatesQuery: FavoriteUpdatesQuery,
  ) {}

  async upsert(data: UpsertUserMediaStateData): Promise<UserMediaState> {
    return withDbError(
      'upsert user media state',
      this.logger,
      async () => {
        const updateSet: Record<string, unknown> = {
          state: data.state,
          updatedAt: new Date(),
        };

        if (data.rating !== undefined) updateSet.rating = data.rating;
        if (data.progress !== undefined) updateSet.progress = data.progress;
        if (data.notes !== undefined) updateSet.notes = data.notes;

        const [row] = await this.db
          .insert(schema.userMediaState)
          .values({
            userId: data.userId,
            mediaItemId: data.mediaItemId,
            state: data.state,
            ...(data.rating !== undefined && { rating: data.rating }),
            ...(data.progress !== undefined && { progress: data.progress }),
            ...(data.notes !== undefined && { notes: data.notes }),
          })
          .onConflictDoUpdate({
            target: [schema.userMediaState.userId, schema.userMediaState.mediaItemId],
            set: updateSet,
          })
          .returning();
        return this.mapRow(row);
      },
      { userId: data.userId, mediaItemId: data.mediaItemId },
    );
  }

  async upsertWithGuard(
    data: UpsertUserMediaStateData,
    guard: (existing: UserMediaState | null) => void | never,
  ): Promise<UserMediaState> {
    return withDbError(
      'upsert user media state with guard',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          // SELECT ... FOR UPDATE acquires a row-level lock, blocking concurrent
          // writers on the same (userId, mediaItemId) pair until the transaction commits.
          const [lockedRow] = await tx
            .select()
            .from(schema.userMediaState)
            .where(
              and(
                eq(schema.userMediaState.userId, data.userId),
                eq(schema.userMediaState.mediaItemId, data.mediaItemId),
              ),
            )
            .for('update');

          const existing = lockedRow ? this.mapRow(lockedRow) : null;

          // Guard throws AppException on invariant violation; transaction auto-rolls back.
          guard(existing);

          const updateSet: Record<string, unknown> = {
            state: data.state,
            updatedAt: new Date(),
          };

          if (data.rating !== undefined) updateSet.rating = data.rating;
          if (data.progress !== undefined) updateSet.progress = data.progress;
          if (data.notes !== undefined) updateSet.notes = data.notes;

          const [row] = await tx
            .insert(schema.userMediaState)
            .values({
              userId: data.userId,
              mediaItemId: data.mediaItemId,
              state: data.state,
              ...(data.rating !== undefined && { rating: data.rating }),
              ...(data.progress !== undefined && { progress: data.progress }),
              ...(data.notes !== undefined && { notes: data.notes }),
            })
            .onConflictDoUpdate({
              target: [schema.userMediaState.userId, schema.userMediaState.mediaItemId],
              set: updateSet,
            })
            .returning();

          return this.mapRow(row);
        });
      },
      { userId: data.userId, mediaItemId: data.mediaItemId },
    );
  }

  async updateStateIfIn(
    userId: string,
    mediaItemId: string,
    fromStates: ReadonlyArray<UserMediaState['state']>,
    toState: UserMediaState['state'],
  ): Promise<{ previous: UserMediaState['state']; current: UserMediaState } | null> {
    return withDbError(
      'conditional update user media state',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          const [current] = await tx
            .select({ state: schema.userMediaState.state })
            .from(schema.userMediaState)
            .where(
              and(
                eq(schema.userMediaState.userId, userId),
                eq(schema.userMediaState.mediaItemId, mediaItemId),
              ),
            )
            .for('update');

          if (!current || !fromStates.includes(current.state as UserMediaState['state'])) {
            return null;
          }

          const previous = current.state as UserMediaState['state'];
          const [updated] = await tx
            .update(schema.userMediaState)
            .set({ state: toState, updatedAt: new Date() })
            .where(
              and(
                eq(schema.userMediaState.userId, userId),
                eq(schema.userMediaState.mediaItemId, mediaItemId),
              ),
            )
            .returning();

          return { previous, current: this.mapRow(updated) };
        });
      },
      { userId, mediaItemId },
    );
  }

  async delete(userId: string, mediaItemId: string): Promise<void> {
    return withDbError(
      'delete user media state',
      this.logger,
      async () => {
        await this.db
          .delete(schema.userMediaState)
          .where(
            and(
              eq(schema.userMediaState.userId, userId),
              eq(schema.userMediaState.mediaItemId, mediaItemId),
            ),
          );
      },
      { userId, mediaItemId },
    );
  }

  async listContinueWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<Array<UserMediaState & { mediaSummary: UserMediaSummary }>> {
    return withDbError(
      'list continue items with media',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            state: schema.userMediaState,
            media: {
              id: schema.mediaItems.id,
              type: schema.mediaItems.type,
              title: schema.mediaItems.title,
              slug: schema.mediaItems.slug,
              posterPath: schema.mediaItems.posterPath,
              releaseDate: schema.mediaItems.releaseDate,
            },
          })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(
            and(
              eq(schema.userMediaState.userId, userId),
              isNotNull(schema.userMediaState.progress),
            ),
          )
          .orderBy(desc(schema.userMediaState.updatedAt))
          .limit(limit)
          .offset(offset);

        return rows.map((r) => ({
          ...this.mapRow(r.state),
          mediaSummary: this.mapMediaSummary(r.media),
        }));
      },
      { userId },
    );
  }

  async getStats(userId: string): Promise<UserMediaStats> {
    return withDbError(
      'fetch user media stats',
      this.logger,
      async () => {
        const [row] = await this.db
          .select({
            moviesRated: sql<number>`count(distinct ${schema.userMediaState.mediaItemId}) filter (where ${schema.mediaItems.type} = ${MediaType.MOVIE} and ${schema.userMediaState.rating} is not null)`,
            showsRated: sql<number>`count(distinct ${schema.userMediaState.mediaItemId}) filter (where ${schema.mediaItems.type} = ${MediaType.SHOW} and ${schema.userMediaState.rating} is not null)`,
            watchlistCount: sql<number>`count(distinct ${schema.userMediaState.mediaItemId}) filter (where ${schema.userMediaState.state} = ${USER_MEDIA_STATE.PLANNED})`,
          })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(eq(schema.userMediaState.userId, userId));

        return {
          moviesRated: Number(row?.moviesRated ?? 0),
          showsRated: Number(row?.showsRated ?? 0),
          watchlistCount: Number(row?.watchlistCount ?? 0),
        };
      },
      { userId },
    );
  }

  async findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]> {
    if (!mediaItemIds.length) return [];
    return withDbError(
      'fetch user media states by media IDs',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.userMediaState)
          .where(
            and(
              eq(schema.userMediaState.userId, userId),
              inArray(schema.userMediaState.mediaItemId, mediaItemIds),
            ),
          );
        return rows.map((r) => this.mapRow(r));
      },
      { userId, mediaItemIds },
    );
  }

  async findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null> {
    return withDbError(
      'fetch user media state',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.userMediaState)
          .where(
            and(
              eq(schema.userMediaState.userId, userId),
              eq(schema.userMediaState.mediaItemId, mediaItemId),
            ),
          );
        return row ? this.mapRow(row) : null;
      },
      { userId, mediaItemId },
    );
  }

  async listByUser(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<UserMediaState[]> {
    return withDbError(
      'list user media state',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.userMediaState)
          .where(eq(schema.userMediaState.userId, userId))
          .orderBy(desc(schema.userMediaState.updatedAt))
          .limit(limit)
          .offset(offset);
        return rows.map((r) => this.mapRow(r));
      },
      { userId },
    );
  }

  async listWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
    options?: ListWithMediaOptions,
  ): Promise<
    Array<
      UserMediaState & {
        mediaSummary: UserMediaSummary;
        progressSummary?: ProgressSummary | null;
      }
    >
  > {
    return withDbError(
      'list user media state with media',
      this.logger,
      async () => {
        const whereParts = [eq(schema.userMediaState.userId, userId)];

        if (options?.ratedOnly) {
          whereParts.push(isNotNull(schema.userMediaState.rating));
        }

        if (options?.states?.length) {
          whereParts.push(inArray(schema.userMediaState.state, options.states));
        }

        if (options?.type) {
          whereParts.push(eq(schema.mediaItems.type, options.type));
        }

        const orderBy = this.buildListOrderBy(options?.sort);

        const rows = await this.db
          .select({
            state: schema.userMediaState,
            media: {
              id: schema.mediaItems.id,
              type: schema.mediaItems.type,
              title: schema.mediaItems.title,
              slug: schema.mediaItems.slug,
              posterPath: schema.mediaItems.posterPath,
              releaseDate: schema.mediaItems.releaseDate,
            },
            progressTotal: sql<number | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                SELECT COUNT(*)::int FROM ${schema.episodes} e
                JOIN ${schema.seasons} s ON s.id = e.season_id
                JOIN ${schema.shows} sh ON sh.id = s.show_id
                WHERE sh.media_item_id = ${schema.mediaItems.id}
                AND s.number > 0
              ) ELSE NULL END
            `.as('progress_total'),
            progressWatched: sql<number | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                SELECT COUNT(*)::int FROM ${schema.userEpisodeProgress} uep
                JOIN ${schema.episodes} e ON e.id = uep.episode_id
                JOIN ${schema.seasons} s ON s.id = e.season_id
                JOIN ${schema.shows} sh ON sh.id = s.show_id
                WHERE sh.media_item_id = ${schema.mediaItems.id}
                AND uep.user_id = ${userId}
                AND s.number > 0
              ) ELSE NULL END
            `.as('progress_watched'),
          })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(and(...whereParts))
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset);

        return rows.map((r) => ({
          ...this.mapRow(r.state),
          mediaSummary: this.mapMediaSummary(r.media),
          progressSummary:
            r.progressTotal !== null && r.progressWatched !== null
              ? { watched: r.progressWatched, total: r.progressTotal }
              : null,
        }));
      },
      { userId },
    );
  }

  /** Counts with identical filters to {@link listWithMedia} — keep WHERE clauses in sync. */
  async countWithMedia(userId: string, options?: ListWithMediaOptions): Promise<number> {
    return withDbError(
      'count user media state with media',
      this.logger,
      async () => {
        const whereParts = [eq(schema.userMediaState.userId, userId)];

        if (options?.ratedOnly) {
          whereParts.push(isNotNull(schema.userMediaState.rating));
        }

        if (options?.states?.length) {
          whereParts.push(inArray(schema.userMediaState.state, options.states));
        }

        if (options?.type) {
          whereParts.push(eq(schema.mediaItems.type, options.type));
        }

        const [row] = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(and(...whereParts));

        return Number(row?.count ?? 0);
      },
      { userId },
    );
  }

  async listActivityWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
    type?: MediaType,
  ): Promise<Array<UserMediaState & { mediaSummary: UserMediaSummary }>> {
    return withDbError(
      'list user media activity with media',
      this.logger,
      async () => {
        const whereParts = [
          eq(schema.userMediaState.userId, userId),
          or(
            eq(schema.userMediaState.state, USER_MEDIA_STATE.WATCHING),
            isNotNull(schema.userMediaState.progress),
          )!,
        ];

        if (type) {
          whereParts.push(eq(schema.mediaItems.type, type));
        }

        const rows = await this.db
          .select({
            state: schema.userMediaState,
            media: {
              id: schema.mediaItems.id,
              type: schema.mediaItems.type,
              title: schema.mediaItems.title,
              slug: schema.mediaItems.slug,
              posterPath: schema.mediaItems.posterPath,
              releaseDate: schema.mediaItems.releaseDate,
            },
          })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(and(...whereParts))
          .orderBy(desc(schema.userMediaState.updatedAt))
          .limit(limit)
          .offset(offset);

        return rows.map((r) => ({
          ...this.mapRow(r.state),
          mediaSummary: this.mapMediaSummary(r.media),
        }));
      },
      { userId },
    );
  }

  /** Counts with identical filters to {@link listActivityWithMedia} — keep WHERE clauses in sync. */
  async countActivityWithMedia(userId: string, type?: MediaType): Promise<number> {
    return withDbError(
      'count user media activity with media',
      this.logger,
      async () => {
        const whereParts = [
          eq(schema.userMediaState.userId, userId),
          or(
            eq(schema.userMediaState.state, USER_MEDIA_STATE.WATCHING),
            isNotNull(schema.userMediaState.progress),
          )!,
        ];

        if (type) {
          whereParts.push(eq(schema.mediaItems.type, type));
        }

        const [row] = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(and(...whereParts));
        return Number(row?.count ?? 0);
      },
      { userId },
    );
  }

  /** Counts with identical filters to {@link listContinueWithMedia} — keep WHERE clauses in sync. */
  async countContinueWithMedia(userId: string): Promise<number> {
    return withDbError(
      'count continue items with media',
      this.logger,
      async () => {
        const [row] = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.userMediaState)
          .where(
            and(
              eq(schema.userMediaState.userId, userId),
              isNotNull(schema.userMediaState.progress),
            ),
          );
        return Number(row?.count ?? 0);
      },
      { userId },
    );
  }

  private buildListOrderBy(sort?: ListWithMediaOptions['sort']): SQL[] {
    switch (sort) {
      case USER_MEDIA_LIST_SORT.RATING:
        return [desc(schema.userMediaState.rating), desc(schema.userMediaState.updatedAt)];
      case USER_MEDIA_LIST_SORT.RELEASE_DATE:
        return [desc(schema.mediaItems.releaseDate), desc(schema.userMediaState.updatedAt)];
      case USER_MEDIA_LIST_SORT.RECENT:
      default:
        return [desc(schema.userMediaState.updatedAt)];
    }
  }

  async findOneWithMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<
    | (UserMediaState & {
        mediaSummary: UserMediaSummary;
        progressSummary?: ProgressSummary | null;
        continuePoint?: ContinuePoint | null;
      })
    | null
  > {
    return withDbError(
      'fetch user media state with media',
      this.logger,
      async () => {
        const [row] = await this.db
          .select({
            state: schema.userMediaState,
            media: {
              id: schema.mediaItems.id,
              type: schema.mediaItems.type,
              title: schema.mediaItems.title,
              slug: schema.mediaItems.slug,
              posterPath: schema.mediaItems.posterPath,
              releaseDate: schema.mediaItems.releaseDate,
            },
            progressTotal: sql<number | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                SELECT COUNT(*)::int FROM ${schema.episodes} e
                JOIN ${schema.seasons} s ON s.id = e.season_id
                JOIN ${schema.shows} sh ON sh.id = s.show_id
                WHERE sh.media_item_id = ${schema.mediaItems.id}
                AND s.number > 0
              ) ELSE NULL END
            `.as('progress_total'),
            progressWatched: sql<number | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                SELECT COUNT(*)::int FROM ${schema.userEpisodeProgress} uep
                JOIN ${schema.episodes} e ON e.id = uep.episode_id
                JOIN ${schema.seasons} s ON s.id = e.season_id
                JOIN ${schema.shows} sh ON sh.id = s.show_id
                WHERE sh.media_item_id = ${schema.mediaItems.id}
                AND uep.user_id = ${userId}
                AND s.number > 0
              ) ELSE NULL END
            `.as('progress_watched'),
            continuePoint: sql<{ season: number; episode: number } | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                WITH last_watched AS (
                  SELECT s.number AS sn, e.number AS en
                  FROM ${schema.userEpisodeProgress} uep
                  JOIN ${schema.episodes} e ON e.id = uep.episode_id
                  JOIN ${schema.seasons} s ON s.id = e.season_id
                  JOIN ${schema.shows} sh ON sh.id = s.show_id
                  WHERE sh.media_item_id = ${schema.mediaItems.id}
                  AND uep.user_id = ${userId}
                  ORDER BY s.number DESC, e.number DESC
                  LIMIT 1
                ),
                next_episode AS (
                  SELECT s.number AS season, e.number AS episode
                  FROM ${schema.episodes} e
                  JOIN ${schema.seasons} s ON s.id = e.season_id
                  JOIN ${schema.shows} sh ON sh.id = s.show_id
                  WHERE sh.media_item_id = ${schema.mediaItems.id}
                  AND s.number > 0
                  AND NOT EXISTS (
                    SELECT 1 FROM ${schema.userEpisodeProgress} uep
                    WHERE uep.user_id = ${userId} AND uep.episode_id = e.id
                  )
                  AND (
                    NOT EXISTS (SELECT 1 FROM last_watched)
                    OR s.number > (SELECT sn FROM last_watched)
                    OR (s.number = (SELECT sn FROM last_watched) AND e.number > (SELECT en FROM last_watched))
                  )
                  ORDER BY s.number ASC, e.number ASC
                  LIMIT 1
                )
                SELECT json_build_object('season', season, 'episode', episode) FROM next_episode
              ) ELSE NULL END
            `.as('continue_point'),
          })
          .from(schema.userMediaState)
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
          .where(
            and(
              eq(schema.userMediaState.userId, userId),
              eq(schema.userMediaState.mediaItemId, mediaItemId),
            ),
          )
          .limit(1);

        if (!row) return null;

        return {
          ...this.mapRow(row.state),
          mediaSummary: this.mapMediaSummary(row.media),
          progressSummary:
            row.progressTotal !== null && row.progressWatched !== null
              ? { watched: row.progressWatched, total: row.progressTotal }
              : null,
          continuePoint: row.continuePoint ?? null,
        };
      },
      { userId, mediaItemId },
    );
  }

  /**
   * Lists highly-rated shows with recent or upcoming episodes.
   * Delegates to dedicated FavoriteUpdatesQuery for complex multi-step logic.
   */
  async listFavoriteUpdates(
    userId: string,
    options: FavoriteUpdatesOptions,
  ): Promise<FavoriteUpdateItem[]> {
    return this.favoriteUpdatesQuery.execute(userId, options);
  }

  async findByMediaAndState(
    mediaItemId: string,
    state: UserMediaState['state'],
  ): Promise<Array<{ userId: string }>> {
    return withDbError(
      'find users by media and state',
      this.logger,
      async () =>
        this.db
          .select({ userId: schema.userMediaState.userId })
          .from(schema.userMediaState)
          .where(
            and(
              eq(schema.userMediaState.mediaItemId, mediaItemId),
              eq(schema.userMediaState.state, state),
            ),
          ),
      { mediaItemId, state },
    );
  }

  async bulkTransitionCaughtUpToWatching(mediaItemId: string): Promise<UserMediaState[]> {
    return withDbError(
      'bulk transition caught_up to watching',
      this.logger,
      async () => {
        const rows = await this.db
          .update(schema.userMediaState)
          .set({ state: USER_MEDIA_STATE.WATCHING, updatedAt: new Date() })
          .where(
            and(
              eq(schema.userMediaState.mediaItemId, mediaItemId),
              eq(schema.userMediaState.state, USER_MEDIA_STATE.CAUGHT_UP),
            ),
          )
          .returning();
        return rows.map((r) => this.mapRow(r));
      },
      { mediaItemId },
    );
  }

  /**
   * Bulk upsert user media states for CSV imports.
   *
   * Processes in batches of {@link BATCH_SIZE} to stay within Postgres parameter limits.
   * When `overwrite` is false: INSERT … ON CONFLICT DO NOTHING.
   * When `overwrite` is true: ON CONFLICT UPDATE using no-downgrade state priority —
   *   CASE/WHEN values must mirror STATE_PRIORITY in import.constants.ts; update both if states change.
   */
  async bulkImport(
    userId: string,
    items: Array<{ mediaItemId: string; state: string; rating: number | null }>,
    overwrite: boolean,
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < items.length; i += DrizzleUserMediaStateRepository.BATCH_SIZE) {
      const batch = items.slice(i, i + DrizzleUserMediaStateRepository.BATCH_SIZE);

      await withDbError(
        'bulk import user media states',
        this.logger,
        async () => {
          const values = batch.map((item) => ({
            userId,
            mediaItemId: item.mediaItemId,
            state: item.state as (typeof schema.userMediaState.$inferInsert)['state'],
            rating: item.rating,
          }));

          if (!overwrite) {
            const result = await this.db
              .insert(schema.userMediaState)
              .values(values)
              .onConflictDoNothing({
                target: [schema.userMediaState.userId, schema.userMediaState.mediaItemId],
              })
              .returning({ id: schema.userMediaState.id });

            imported += result.length;
            skipped += batch.length - result.length;
          } else {
            const result = await this.db
              .insert(schema.userMediaState)
              .values(values)
              .onConflictDoUpdate({
                target: [schema.userMediaState.userId, schema.userMediaState.mediaItemId],
                set: {
                  // Only overwrite rating when the incoming value is not null, to avoid
                  // destroying an existing rating when a lower-priority import has no rating.
                  rating: sql`CASE WHEN EXCLUDED.rating IS NOT NULL THEN EXCLUDED.rating ELSE ${schema.userMediaState.rating} END`,
                  state: sql`CASE
                    WHEN CASE EXCLUDED.state
                      WHEN 'planned'   THEN 1
                      WHEN 'watching'  THEN 2
                      WHEN 'paused'    THEN 3
                      WHEN 'dropped'   THEN 4
                      WHEN 'caught_up' THEN 5
                      WHEN 'completed' THEN 6
                      ELSE 0
                    END > CASE ${schema.userMediaState.state}
                      WHEN 'planned'   THEN 1
                      WHEN 'watching'  THEN 2
                      WHEN 'paused'    THEN 3
                      WHEN 'dropped'   THEN 4
                      WHEN 'caught_up' THEN 5
                      WHEN 'completed' THEN 6
                      ELSE 0
                    END
                    THEN EXCLUDED.state
                    ELSE ${schema.userMediaState.state}
                  END`,
                  updatedAt: sql`NOW()`,
                },
              })
              .returning({ id: schema.userMediaState.id });

            // All rows result in a returned row (insert or update); we count all as imported.
            imported += result.length;
            skipped += batch.length - result.length;
          }
        },
        { userId, batchOffset: i },
      );
    }

    return { imported, skipped };
  }

  private mapRow(row: typeof schema.userMediaState.$inferSelect): UserMediaState {
    return {
      id: row.id,
      userId: row.userId,
      mediaItemId: row.mediaItemId,
      state: row.state as UserMediaState['state'],
      rating: row.rating,
      progress: row.progress,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapMediaSummary(media: {
    id: string;
    type: string;
    title: string;
    slug: string;
    posterPath: string | null;
    releaseDate: Date | null;
  }): UserMediaSummary {
    return {
      id: media.id,
      type: media.type as MediaType,
      title: media.title,
      slug: media.slug,
      poster: ImageMapper.toPoster(media.posterPath),
      releaseDate: media.releaseDate,
    };
  }
}
