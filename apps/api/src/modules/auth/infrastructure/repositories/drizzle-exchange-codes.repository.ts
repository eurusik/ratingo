import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EXCHANGE_CODE_EXPIRED_RETENTION_HOURS,
  EXCHANGE_CODE_USED_RETENTION_HOURS,
} from '../../auth.constants';
import {
  ConsumeCodeFailureReason,
  type ConsumeCodeResult,
  type ExchangeCodeRecord,
  type IExchangeCodesRepository,
} from '../../domain/repositories/exchange-codes.repository.interface';

// Time conversion constants
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;

/**
 * Drizzle implementation for OAuth exchange code storage.
 */
@Injectable()
export class DrizzleExchangeCodesRepository implements IExchangeCodesRepository {
  private readonly logger = new Logger(DrizzleExchangeCodesRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async create(
    data: Omit<ExchangeCodeRecord, 'id' | 'usedAt' | 'createdAt'>,
  ): Promise<ExchangeCodeRecord> {
    try {
      const [row] = await this.db
        .insert(schema.oauthExchangeCodes)
        .values({
          codeHash: data.codeHash,
          userId: data.userId,
          expiresAt: data.expiresAt,
          ip: data.ip ?? null,
          userAgent: data.userAgent ?? null,
        })
        .returning();
      return this.mapRow(row);
    } catch (error) {
      this.logger.error(`create failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to create exchange code', error, { userId: data.userId });
    }
  }

  /**
   * Atomically consumes an exchange code using UPDATE...RETURNING.
   */
  async consumeCode(codeHash: string): Promise<ConsumeCodeResult> {
    try {
      const now = new Date();

      // Atomic update: find valid code and mark as used in one operation
      const [updated] = await this.db
        .update(schema.oauthExchangeCodes)
        .set({ usedAt: now })
        .where(
          and(
            eq(schema.oauthExchangeCodes.codeHash, codeHash),
            isNull(schema.oauthExchangeCodes.usedAt),
            gt(schema.oauthExchangeCodes.expiresAt, now),
          ),
        )
        .returning();

      if (updated) {
        return { success: true, record: this.mapRow(updated) };
      }

      // No rows updated - determine why
      const [existing] = await this.db
        .select()
        .from(schema.oauthExchangeCodes)
        .where(eq(schema.oauthExchangeCodes.codeHash, codeHash));

      if (!existing) {
        return { success: false, reason: ConsumeCodeFailureReason.NOT_FOUND };
      }

      if (existing.usedAt !== null) {
        return { success: false, reason: ConsumeCodeFailureReason.ALREADY_USED };
      }

      if (existing.expiresAt <= now) {
        return { success: false, reason: ConsumeCodeFailureReason.EXPIRED };
      }

      // Should not reach here, but fallback to not_found
      return { success: false, reason: ConsumeCodeFailureReason.NOT_FOUND };
    } catch (error) {
      this.logger.error(`consumeCode failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to consume exchange code', error);
    }
  }

  async cleanupExpired(retentionHours = EXCHANGE_CODE_EXPIRED_RETENTION_HOURS): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - retentionHours * MS_PER_HOUR);

      // Delete codes that are:
      // 1. Expired more than retentionHours ago, OR
      // 2. Used more than 1 hour ago (shorter retention for used codes)
      const usedCutoff = new Date(Date.now() - EXCHANGE_CODE_USED_RETENTION_HOURS * MS_PER_HOUR);

      const result = await this.db
        .delete(schema.oauthExchangeCodes)
        .where(
          or(
            lt(schema.oauthExchangeCodes.expiresAt, cutoff),
            and(
              sql`${schema.oauthExchangeCodes.usedAt} IS NOT NULL`,
              lt(schema.oauthExchangeCodes.usedAt, usedCutoff),
            ),
          ),
        )
        .returning({ id: schema.oauthExchangeCodes.id });

      const count = result.length;
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired/used exchange codes`);
      }
      return count;
    } catch (error) {
      this.logger.error(`cleanupExpired failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to cleanup exchange codes', error);
    }
  }

  private mapRow(row: typeof schema.oauthExchangeCodes.$inferSelect): ExchangeCodeRecord {
    return {
      id: row.id,
      codeHash: row.codeHash,
      userId: row.userId,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }
}
