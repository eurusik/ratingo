import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, gte, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { IRefreshTokensRepository } from '../../domain/repositories/refresh-tokens.repository.interface';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

/**
 * Drizzle implementation for refresh token storage.
 */
@Injectable()
export class DrizzleRefreshTokensRepository implements IRefreshTokensRepository {
  private readonly logger = new Logger(DrizzleRefreshTokensRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Stores a new refresh token.
   *
   * @param {Omit<RefreshToken, 'createdAt'>} token - Token payload
   * @returns {Promise<RefreshToken>} Persisted token
   */
  async issue(token: Omit<RefreshToken, 'createdAt'>): Promise<RefreshToken> {
    try {
      const [row] = await this.db
        .insert(schema.refreshTokens)
        .values({
          id: token.id,
          userId: token.userId,
          tokenHash: token.tokenHash,
          userAgent: token.userAgent ?? null,
          ip: token.ip ?? null,
          expiresAt: token.expiresAt,
          revokedAt: token.revokedAt ?? null,
        })
        .returning();
      return this.mapRow(row);
    } catch (error) {
      this.logger.error(`issue failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to issue refresh token', { userId: token.userId });
    }
  }

  /**
   * Finds refresh token by ID.
   *
   * @param {string} id - Token identifier (jti)
   * @returns {Promise<RefreshToken | null>} Token or null
   */
  async findById(id: string): Promise<RefreshToken | null> {
    try {
      const [row] = await this.db
        .select()
        .from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.id, id));
      return row ? this.mapRow(row) : null;
    } catch (error) {
      this.logger.error(`findById failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch refresh token', { id });
    }
  }

  /**
   * Lists active (not revoked and not expired) tokens for user.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<RefreshToken[]>} Active tokens
   */
  async findValidByUser(userId: string): Promise<RefreshToken[]> {
    try {
      const now = new Date();
      const rows = await this.db
        .select()
        .from(schema.refreshTokens)
        .where(
          and(
            eq(schema.refreshTokens.userId, userId),
            isNull(schema.refreshTokens.revokedAt),
            gte(schema.refreshTokens.expiresAt, now),
          ),
        );
      return rows.map((r) => this.mapRow(r));
    } catch (error) {
      this.logger.error(`findValidByUser failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list refresh tokens', { userId });
    }
  }

  /**
   * Revokes single token by ID.
   *
   * @param {string} id - Token identifier
   * @returns {Promise<void>}
   */
  async revoke(id: string): Promise<void> {
    try {
      await this.db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.id, id));
    } catch (error) {
      this.logger.error(`revoke failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to revoke refresh token', { id });
    }
  }

  /**
   * Revokes all tokens for user.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<void>}
   */
  async revokeAllForUser(userId: string): Promise<void> {
    try {
      await this.db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.userId, userId));
    } catch (error) {
      this.logger.error(`revokeAllForUser failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to revoke user refresh tokens', { userId });
    }
  }

  private mapRow(row: typeof schema.refreshTokens.$inferSelect): RefreshToken {
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      userAgent: row.userAgent,
      ip: row.ip,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }
}
