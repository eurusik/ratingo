import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type UserMediaState } from '../../domain/entities/user-media-state.entity';
import { USER_MEDIA_STATE } from '../../domain/entities/user-media-state.entity';
import {
  type ContinuePoint,
  type IUserMediaStateRepository,
  type ListWithMediaOptions,
  type ProgressSummary,
  USER_MEDIA_LIST_SORT,
  type UserMediaStats,
  type UserMediaSummary,
  type UpsertUserMediaStateData,
} from '../../domain/repositories/user-media-state.repository.interface';

/**
 * Drizzle implementation of user media state repository.
 */
@Injectable()
export class DrizzleUserMediaStateRepository implements IUserMediaStateRepository {
  private readonly logger = new Logger(DrizzleUserMediaStateRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Upserts user media state.
   *
   * @param {UpsertUserMediaStateData} data - Upsert payload
   * @returns {Promise<UserMediaState>} Persisted state
   */
  async upsert(data: UpsertUserMediaStateData): Promise<UserMediaState> {
    try {
      const [row] = await this.db
        .insert(schema.userMediaState)
        .values({
          userId: data.userId,
          mediaItemId: data.mediaItemId,
          state: data.state,
          rating: data.rating ?? null,
          progress: data.progress ?? null,
          notes: data.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [schema.userMediaState.userId, schema.userMediaState.mediaItemId],
          set: {
            state: data.state,
            rating: data.rating ?? null,
            progress: data.progress ?? null,
            notes: data.notes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return this.mapRow(row);
    } catch (error) {
      this.logger.error(`upsert failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to upsert user media state', {
        userId: data.userId,
        mediaItemId: data.mediaItemId,
      });
    }
  }

  /**
   * Deletes user media state.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<void>}
   */
  async delete(userId: string, mediaItemId: string): Promise<void> {
    try {
      await this.db
        .delete(schema.userMediaState)
        .where(
          and(
            eq(schema.userMediaState.userId, userId),
            eq(schema.userMediaState.mediaItemId, mediaItemId),
          ),
        );
    } catch (error) {
      this.logger.error(`delete failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to delete user media state', {
        userId,
        mediaItemId,
      });
    }
  }

  /**
   * Lists "Continue" items with media summary.
   *
   * Semantics: `progress IS NOT NULL`.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<any[]>} Continue items with media summary
   * @throws {DatabaseException} When query fails
   */
  async listContinueWithMedia(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0) {
    try {
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
          and(eq(schema.userMediaState.userId, userId), isNotNull(schema.userMediaState.progress)),
        )
        .orderBy(desc(schema.userMediaState.updatedAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        ...this.mapRow(r.state),
        mediaSummary: this.mapMediaSummary(r.media),
      }));
    } catch (error) {
      this.logger.error(`listContinueWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list continue items with media', { userId });
    }
  }

  /**
   * Gets aggregated user media stats.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<UserMediaStats>} Aggregated stats
   * @throws {DatabaseException} When query fails
   */
  async getStats(userId: string): Promise<UserMediaStats> {
    try {
      const [row] = await this.db
        .select({
          moviesRated: sql<number>`count(distinct ${schema.userMediaState.mediaItemId}) filter (where ${schema.mediaItems.type} = ${MediaType.MOVIE} and ${schema.userMediaState.rating} is not null)`,
          showsRated: sql<number>`count(distinct ${schema.userMediaState.mediaItemId}) filter (where ${schema.mediaItems.type} = ${MediaType.SHOW} and ${schema.userMediaState.rating} is not null)`,
          watchlistCount: sql<number>`count(distinct ${schema.userMediaState.mediaItemId}) filter (where ${schema.userMediaState.state} = 'planned')`,
        })
        .from(schema.userMediaState)
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
        .where(eq(schema.userMediaState.userId, userId));

      return {
        moviesRated: Number(row?.moviesRated ?? 0),
        showsRated: Number(row?.showsRated ?? 0),
        watchlistCount: Number(row?.watchlistCount ?? 0),
      };
    } catch (error) {
      this.logger.error(`getStats failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch user media stats', { userId });
    }
  }

  /**
   * Finds states for a user across multiple media IDs.
   *
   * @param {string} userId - User identifier
   * @param {string[]} mediaItemIds - Media item identifiers
   * @returns {Promise<UserMediaState[]>} States
   */
  async findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]> {
    if (!mediaItemIds.length) return [];
    try {
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
    } catch (error) {
      this.logger.error(`findManyByMediaIds failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch user media states by media IDs', {
        userId,
        mediaItemIds,
      });
    }
  }

  /**
   * Finds state by user and media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaState | null>} State or null
   */
  async findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null> {
    try {
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
    } catch (error) {
      this.logger.error(`findOne failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch user media state', { userId, mediaItemId });
    }
  }

  /**
   * Lists states for a user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<UserMediaState[]>} States
   */
  async listByUser(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<UserMediaState[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.userMediaState)
        .where(eq(schema.userMediaState.userId, userId))
        .orderBy(desc(schema.userMediaState.updatedAt))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => this.mapRow(r));
    } catch (error) {
      this.logger.error(`listByUser failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list user media state', { userId });
    }
  }

  /**
   * Lists states with media summary.
   */
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
    try {
      const whereParts = [eq(schema.userMediaState.userId, userId)];

      if (options?.ratedOnly) {
        whereParts.push(isNotNull(schema.userMediaState.rating));
      }

      if (options?.states?.length) {
        whereParts.push(inArray(schema.userMediaState.state, options.states));
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
    } catch (error) {
      this.logger.error(`listWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list user media state with media', { userId });
    }
  }

  /**
   * Counts states for listWithMedia with the same filters.
   *
   * @param {string} userId - User identifier
   * @param {ListWithMediaOptions} options - Count options
   * @returns {Promise<number>} Total count
   * @throws {DatabaseException} When query fails
   */
  async countWithMedia(userId: string, options?: ListWithMediaOptions): Promise<number> {
    try {
      const whereParts = [eq(schema.userMediaState.userId, userId)];

      if (options?.ratedOnly) {
        whereParts.push(isNotNull(schema.userMediaState.rating));
      }

      if (options?.states?.length) {
        whereParts.push(inArray(schema.userMediaState.state, options.states));
      }

      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userMediaState)
        .where(and(...whereParts));

      return Number(row?.count ?? 0);
    } catch (error) {
      this.logger.error(`countWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to count user media state with media', { userId });
    }
  }

  /**
   * Lists activity items with media summary.
   * Semantics: state = 'watching' OR progress IS NOT NULL.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<any[]>} Activity list items
   * @throws {DatabaseException} When query fails
   */
  async listActivityWithMedia(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0) {
    try {
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
            or(
              eq(schema.userMediaState.state, USER_MEDIA_STATE.WATCHING),
              isNotNull(schema.userMediaState.progress),
            ),
          ),
        )
        .orderBy(desc(schema.userMediaState.updatedAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        ...this.mapRow(r.state),
        mediaSummary: this.mapMediaSummary(r.media),
      }));
    } catch (error) {
      this.logger.error(`listActivityWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list user media activity with media', { userId });
    }
  }

  /**
   * Counts activity items.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total activity items
   * @throws {DatabaseException} When query fails
   */
  async countActivityWithMedia(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userMediaState)
        .where(
          and(
            eq(schema.userMediaState.userId, userId),
            or(
              eq(schema.userMediaState.state, USER_MEDIA_STATE.WATCHING),
              isNotNull(schema.userMediaState.progress),
            ),
          ),
        );
      return Number(row?.count ?? 0);
    } catch (error) {
      this.logger.error(`countActivityWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to count user media activity with media', { userId });
    }
  }

  /**
   * Counts "Continue" items.
   *
   * Semantics: `progress IS NOT NULL`.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total continue items
   * @throws {DatabaseException} When query fails
   */
  async countContinueWithMedia(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userMediaState)
        .where(
          and(eq(schema.userMediaState.userId, userId), isNotNull(schema.userMediaState.progress)),
        );
      return Number(row?.count ?? 0);
    } catch (error) {
      this.logger.error(`countContinueWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to count continue items with media', { userId });
    }
  }

  /**
   * Builds order by clauses for listWithMedia.
   *
   * @param {ListWithMediaOptions['sort']} sort - Sort option
   * @returns {any[]} Drizzle orderBy list
   */
  private buildListOrderBy(sort?: ListWithMediaOptions['sort']) {
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

  /**
   * Finds a single state with media summary, progress, and continue point.
   */
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
    try {
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
                AND e.id NOT IN (
                  SELECT uep.episode_id FROM ${schema.userEpisodeProgress} uep
                  WHERE uep.user_id = ${userId}
                )
                AND (
                  s.number > (SELECT sn FROM last_watched)
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
    } catch (error) {
      this.logger.error(`findOneWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch user media state with media', {
        userId,
        mediaItemId,
      });
    }
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
