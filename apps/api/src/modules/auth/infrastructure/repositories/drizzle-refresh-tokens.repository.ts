import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, gte, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type RefreshToken } from '../../domain/entities/refresh-token.entity';
import { type IRefreshTokensRepository } from '../../domain/repositories/refresh-tokens.repository.interface';

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
    return withDbError(
      'issue refresh token',
      this.logger,
      async () => {
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
      },
      { userId: token.userId },
    );
  }

  /**
   * Finds refresh token by ID.
   *
   * @param {string} id - Token identifier (jti)
   * @returns {Promise<RefreshToken | null>} Token or null
   */
  async findById(id: string): Promise<RefreshToken | null> {
    return withDbError(
      'fetch refresh token',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.refreshTokens)
          .where(eq(schema.refreshTokens.id, id));
        return row ? this.mapRow(row) : null;
      },
      { id },
    );
  }

  /**
   * Lists active (not revoked and not expired) tokens for user.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<RefreshToken[]>} Active tokens
   */
  async findValidByUser(userId: string): Promise<RefreshToken[]> {
    return withDbError(
      'list refresh tokens',
      this.logger,
      async () => {
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
      },
      { userId },
    );
  }

  /**
   * Revokes single token by ID.
   *
   * @param {string} id - Token identifier
   * @returns {Promise<void>} Nothing
   */
  async revoke(id: string): Promise<void> {
    return withDbError(
      'revoke refresh token',
      this.logger,
      () =>
        this.db
          .update(schema.refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(schema.refreshTokens.id, id))
          .then(() => undefined),
      { id },
    );
  }

  /**
   * Revokes all tokens for user.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<void>} Nothing
   */
  async revokeAllForUser(userId: string): Promise<void> {
    return withDbError(
      'revoke user refresh tokens',
      this.logger,
      () =>
        this.db
          .update(schema.refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(schema.refreshTokens.userId, userId))
          .then(() => undefined),
      { userId },
    );
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
