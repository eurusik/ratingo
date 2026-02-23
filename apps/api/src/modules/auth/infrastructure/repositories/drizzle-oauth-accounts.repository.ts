import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type OAuthAccount } from '../../domain/entities/oauth-account.entity';
import {
  type IOAuthAccountsRepository,
  type CreateOAuthAccountData,
} from '../../domain/repositories/oauth-accounts.repository.interface';
import { type OAuthProvider } from '../../domain/types';

/**
 * Drizzle implementation for OAuth account link storage.
 */
@Injectable()
export class DrizzleOAuthAccountsRepository implements IOAuthAccountsRepository {
  private readonly logger = new Logger(DrizzleOAuthAccountsRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccount | null> {
    return withDbError(
      'fetch oauth account by provider',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.oauthAccounts)
          .where(
            and(
              eq(schema.oauthAccounts.provider, provider),
              eq(schema.oauthAccounts.providerAccountId, providerAccountId),
            ),
          );
        return row ? this.mapRow(row) : null;
      },
      { provider, providerAccountId },
    );
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return withDbError(
      'fetch oauth accounts by user',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.oauthAccounts)
          .where(eq(schema.oauthAccounts.userId, userId));
        return rows.map((r) => this.mapRow(r));
      },
      { userId },
    );
  }

  async findByUserAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccount | null> {
    return withDbError(
      'fetch oauth account by user and provider',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.oauthAccounts)
          .where(
            and(
              eq(schema.oauthAccounts.userId, userId),
              eq(schema.oauthAccounts.provider, provider),
            ),
          );
        return row ? this.mapRow(row) : null;
      },
      { userId, provider },
    );
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    return withDbError(
      'create oauth account',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.oauthAccounts)
          .values({
            userId: data.userId,
            provider: data.provider,
            providerAccountId: data.providerAccountId,
            email: data.email,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
          })
          .returning();
        return this.mapRow(row);
      },
      { userId: data.userId, provider: data.provider },
    );
  }

  async deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<boolean> {
    return withDbError(
      'delete oauth account',
      this.logger,
      async () => {
        const result = await this.db
          .delete(schema.oauthAccounts)
          .where(
            and(
              eq(schema.oauthAccounts.userId, userId),
              eq(schema.oauthAccounts.provider, provider),
            ),
          )
          .returning({ id: schema.oauthAccounts.id });
        return result.length > 0;
      },
      { userId, provider },
    );
  }

  async countByUserId(userId: string): Promise<number> {
    return withDbError(
      'count oauth accounts',
      this.logger,
      async () => {
        const [result] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.oauthAccounts)
          .where(eq(schema.oauthAccounts.userId, userId));
        return result?.count ?? 0;
      },
      { userId },
    );
  }

  private mapRow(row: typeof schema.oauthAccounts.$inferSelect): OAuthAccount {
    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider as OAuthProvider,
      providerAccountId: row.providerAccountId,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
