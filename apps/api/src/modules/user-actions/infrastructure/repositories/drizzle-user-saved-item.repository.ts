import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  IUserSavedItemRepository,
  UpsertSavedItemData,
  SavedItemWithMedia,
} from '../../domain/repositories/user-saved-item.repository.interface';
import { UserSavedItem, SavedItemList } from '../../domain/entities/user-saved-item.entity';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../catalog/infrastructure/mappers/image.mapper';

/**
 * Drizzle implementation of user saved item repository.
 */
@Injectable()
export class DrizzleUserSavedItemRepository implements IUserSavedItemRepository {
  private readonly logger = new Logger(DrizzleUserSavedItemRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Upserts a saved item.
   *
   * @param {UpsertSavedItemData} data - Upsert payload
   * @returns {Promise<UserSavedItem>} Persisted item
   */
  async upsert(data: UpsertSavedItemData): Promise<UserSavedItem> {
    try {
      const [row] = await this.db
        .insert(schema.userSavedItems)
        .values({
          userId: data.userId,
          mediaItemId: data.mediaItemId,
          list: data.list,
          reasonKey: data.reasonKey ?? null,
        })
        .onConflictDoUpdate({
          target: [
            schema.userSavedItems.userId,
            schema.userSavedItems.mediaItemId,
            schema.userSavedItems.list,
          ],
          set: {
            updatedAt: new Date(),
            reasonKey: data.reasonKey ?? null,
          },
        })
        .returning();
      return this.mapRow(row);
    } catch (error) {
      this.logger.error(`upsert failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to upsert saved item', {
        userId: data.userId,
        mediaItemId: data.mediaItemId,
        list: data.list,
      });
    }
  }

  /**
   * Removes a saved item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SavedItemList} list - List type
   * @returns {Promise<boolean>} True if deleted
   */
  async remove(userId: string, mediaItemId: string, list: SavedItemList): Promise<boolean> {
    try {
      const result = await this.db
        .delete(schema.userSavedItems)
        .where(
          and(
            eq(schema.userSavedItems.userId, userId),
            eq(schema.userSavedItems.mediaItemId, mediaItemId),
            eq(schema.userSavedItems.list, list),
          ),
        )
        .returning({ id: schema.userSavedItems.id });
      return result.length > 0;
    } catch (error) {
      this.logger.error(`remove failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to remove saved item', { userId, mediaItemId, list });
    }
  }

  /**
   * Finds a saved item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SavedItemList} list - List type
   * @returns {Promise<UserSavedItem | null>} Item or null
   */
  async findOne(
    userId: string,
    mediaItemId: string,
    list: SavedItemList,
  ): Promise<UserSavedItem | null> {
    try {
      const [row] = await this.db
        .select()
        .from(schema.userSavedItems)
        .where(
          and(
            eq(schema.userSavedItems.userId, userId),
            eq(schema.userSavedItems.mediaItemId, mediaItemId),
            eq(schema.userSavedItems.list, list),
          ),
        )
        .limit(1);
      return row ? this.mapRow(row) : null;
    } catch (error) {
      this.logger.error(`findOne failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find saved item', { userId, mediaItemId, list });
    }
  }

  /**
   * Checks if item is saved in any list.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<SavedItemList[]>} Lists where item is saved
   */
  async findListsForMedia(userId: string, mediaItemId: string): Promise<SavedItemList[]> {
    try {
      const rows = await this.db
        .select({ list: schema.userSavedItems.list })
        .from(schema.userSavedItems)
        .where(
          and(
            eq(schema.userSavedItems.userId, userId),
            eq(schema.userSavedItems.mediaItemId, mediaItemId),
          ),
        );
      return rows.map((r) => r.list as SavedItemList);
    } catch (error) {
      this.logger.error(`findListsForMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find lists for media', { userId, mediaItemId });
    }
  }

  /**
   * Lists saved items with media summary.
   *
   * @param {string} userId - User identifier
   * @param {SavedItemList} list - List type
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<SavedItemWithMedia[]>} Items with media
   */
  async listWithMedia(
    userId: string,
    list: SavedItemList,
    limit = 20,
    offset = 0,
  ): Promise<SavedItemWithMedia[]> {
    try {
      const rows = await this.db
        .select({
          item: schema.userSavedItems,
          media: {
            id: schema.mediaItems.id,
            type: schema.mediaItems.type,
            title: schema.mediaItems.title,
            slug: schema.mediaItems.slug,
            posterPath: schema.mediaItems.posterPath,
            releaseDate: schema.mediaItems.releaseDate,
          },
        })
        .from(schema.userSavedItems)
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.userSavedItems.mediaItemId))
        .where(and(eq(schema.userSavedItems.userId, userId), eq(schema.userSavedItems.list, list)))
        .orderBy(desc(schema.userSavedItems.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        ...this.mapRow(r.item),
        mediaSummary: {
          id: r.media.id,
          type: r.media.type as MediaType,
          title: r.media.title,
          slug: r.media.slug,
          poster: ImageMapper.toPoster(r.media.posterPath),
          releaseDate: r.media.releaseDate,
        },
      }));
    } catch (error) {
      this.logger.error(`listWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list saved items with media', { userId, list });
    }
  }

  /**
   * Counts saved items in a list.
   *
   * @param {string} userId - User identifier
   * @param {SavedItemList} list - List type
   * @returns {Promise<number>} Count
   */
  async count(userId: string, list: SavedItemList): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userSavedItems)
        .where(and(eq(schema.userSavedItems.userId, userId), eq(schema.userSavedItems.list, list)));
      return Number(row?.count ?? 0);
    } catch (error) {
      this.logger.error(`count failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to count saved items', { userId, list });
    }
  }

  /**
   * Gets lists for multiple media items in batch.
   *
   * @param {string} userId - User identifier
   * @param {string[]} mediaItemIds - Media item identifiers
   * @returns {Promise<Map<string, SavedItemList[]>>} Map of mediaItemId to lists
   */
  async findListsForMediaBatch(
    userId: string,
    mediaItemIds: string[],
  ): Promise<Map<string, SavedItemList[]>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    try {
      const rows = await this.db
        .select({
          mediaItemId: schema.userSavedItems.mediaItemId,
          list: schema.userSavedItems.list,
        })
        .from(schema.userSavedItems)
        .where(
          and(
            eq(schema.userSavedItems.userId, userId),
            sql`${schema.userSavedItems.mediaItemId} = ANY(${mediaItemIds})`,
          ),
        );

      const result = new Map<string, SavedItemList[]>();
      for (const row of rows) {
        const lists = result.get(row.mediaItemId) ?? [];
        lists.push(row.list as SavedItemList);
        result.set(row.mediaItemId, lists);
      }
      return result;
    } catch (error) {
      this.logger.error(`findListsForMediaBatch failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to get batch save status', {
        userId,
        count: mediaItemIds.length,
      });
    }
  }

  private mapRow(row: typeof schema.userSavedItems.$inferSelect): UserSavedItem {
    return {
      id: row.id,
      userId: row.userId,
      mediaItemId: row.mediaItemId,
      list: row.list as SavedItemList,
      reasonKey: row.reasonKey ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
