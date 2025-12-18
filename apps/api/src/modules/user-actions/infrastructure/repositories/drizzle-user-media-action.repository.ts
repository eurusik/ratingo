import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  IUserMediaActionRepository,
  CreateUserMediaActionData,
} from '../../domain/repositories/user-media-action.repository.interface';
import { UserMediaAction } from '../../domain/entities/user-media-action.entity';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

/**
 * Drizzle implementation of user media action repository.
 */
@Injectable()
export class DrizzleUserMediaActionRepository implements IUserMediaActionRepository {
  private readonly logger = new Logger(DrizzleUserMediaActionRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Creates a new action event.
   *
   * @param {CreateUserMediaActionData} data - Action data
   * @returns {Promise<UserMediaAction>} Created action
   */
  async create(data: CreateUserMediaActionData): Promise<UserMediaAction> {
    try {
      const [row] = await this.db
        .insert(schema.userMediaActions)
        .values({
          userId: data.userId,
          mediaItemId: data.mediaItemId,
          action: data.action,
          context: data.context ?? null,
          reasonKey: data.reasonKey ?? null,
          payload: data.payload ?? null,
        })
        .returning();
      return this.mapRow(row);
    } catch (error) {
      this.logger.error(`create failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to create user media action', {
        userId: data.userId,
        mediaItemId: data.mediaItemId,
        action: data.action,
      });
    }
  }

  /**
   * Lists actions for a user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<UserMediaAction[]>} Actions
   */
  async listByUser(userId: string, limit = 50, offset = 0): Promise<UserMediaAction[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.userMediaActions)
        .where(eq(schema.userMediaActions.userId, userId))
        .orderBy(desc(schema.userMediaActions.createdAt))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => this.mapRow(r));
    } catch (error) {
      this.logger.error(`listByUser failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list user media actions', { userId });
    }
  }

  /**
   * Lists actions for a specific media item by user.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaAction[]>} Actions
   */
  async listByUserAndMedia(userId: string, mediaItemId: string): Promise<UserMediaAction[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.userMediaActions)
        .where(
          and(
            eq(schema.userMediaActions.userId, userId),
            eq(schema.userMediaActions.mediaItemId, mediaItemId),
          ),
        )
        .orderBy(desc(schema.userMediaActions.createdAt));
      return rows.map((r) => this.mapRow(r));
    } catch (error) {
      this.logger.error(`listByUserAndMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list user media actions for media', {
        userId,
        mediaItemId,
      });
    }
  }

  private mapRow(row: typeof schema.userMediaActions.$inferSelect): UserMediaAction {
    return {
      id: row.id,
      userId: row.userId,
      mediaItemId: row.mediaItemId,
      action: row.action,
      context: row.context,
      reasonKey: row.reasonKey,
      payload: row.payload as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }
}
