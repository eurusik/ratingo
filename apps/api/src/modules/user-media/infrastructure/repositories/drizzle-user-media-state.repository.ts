import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  IUserMediaStateRepository,
  UserMediaStats,
  UpsertUserMediaStateData,
} from '../../domain/repositories/user-media-state.repository.interface';
import { UserMediaState } from '../../domain/entities/user-media-state.entity';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../catalog/infrastructure/mappers/image.mapper';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

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
   * @param {UpsertUserMediaStateData} data - Payload
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
   * @param {string[]} mediaItemIds - Media item IDs
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
   * @param {number} [limit=20] - Max items
   * @param {number} [offset=0] - Offset
   * @returns {Promise<UserMediaState[]>} States
   */
  async listByUser(userId: string, limit = 20, offset = 0): Promise<UserMediaState[]> {
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
    limit = 20,
    offset = 0,
  ): Promise<
    Array<
      UserMediaState & {
        mediaSummary: {
          id: string;
          type: MediaType;
          title: string;
          slug: string;
          poster: ImageDto | null;
        };
      }
    >
  > {
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
          },
        })
        .from(schema.userMediaState)
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userMediaState.mediaItemId))
        .where(eq(schema.userMediaState.userId, userId))
        .orderBy(desc(schema.userMediaState.updatedAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        ...this.mapRow(r.state),
        mediaSummary: {
          id: r.media.id,
          type: r.media.type as MediaType,
          title: r.media.title,
          slug: r.media.slug,
          poster: ImageMapper.toPoster(r.media.posterPath),
        },
      }));
    } catch (error) {
      this.logger.error(`listWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list user media state with media', { userId });
    }
  }

  /**
   * Finds one with media summary.
   */
  async findOneWithMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<
    | (UserMediaState & {
        mediaSummary: {
          id: string;
          type: MediaType;
          title: string;
          slug: string;
          poster: ImageDto | null;
        };
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
          },
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
        mediaSummary: {
          id: row.media.id,
          type: row.media.type as MediaType,
          title: row.media.title,
          slug: row.media.slug,
          poster: ImageMapper.toPoster(row.media.posterPath),
        },
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
}
