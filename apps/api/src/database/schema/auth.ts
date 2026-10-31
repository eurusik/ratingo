import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, index, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(), // jti
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('refresh_tokens_user_idx').on(t.userId),
    expiresIdx: index('refresh_tokens_expires_idx').on(t.expiresAt),
  }),
);

/**
 * OAuth Exchange Codes
 * Short-lived one-time codes for secure token delivery after OAuth callback.
 * Code is stored as HMAC-SHA256 hash for security.
 */
export const oauthExchangeCodes = pgTable(
  'oauth_exchange_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    codeHash: text('code_hash').notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    codeHashIdx: index('oauth_exchange_codes_hash_idx').on(t.codeHash),
    expiresIdx: index('oauth_exchange_codes_expires_idx').on(t.expiresAt),
  }),
);

/**
 * OAUTH ACCOUNTS (Multi-provider link table)
 * One user can have multiple OAuth providers linked.
 * Part of auth aggregate — managed by auth module's repository.
 */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** Provider identifier: 'google', 'facebook' */
    provider: text('provider').notNull(),
    /** Provider-specific user ID (e.g., Google sub, Facebook ID) */
    providerAccountId: text('provider_account_id').notNull(),
    /** Email from this OAuth provider (for conflict detection) */
    email: text('email'),
    /** Display name from provider profile */
    displayName: text('display_name'),
    /** Avatar URL from provider profile */
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    /** Each provider account can only be linked to one user */
    providerAccountUniq: uniqueIndex('oauth_accounts_provider_account_uniq').on(
      t.provider,
      t.providerAccountId,
    ),
    /** Each user can have only one account per provider */
    userProviderUniq: uniqueIndex('oauth_accounts_user_provider_uniq').on(t.userId, t.provider),
    userIdx: index('oauth_accounts_user_idx').on(t.userId),
    providerIdx: index('oauth_accounts_provider_idx').on(t.provider),
  }),
);

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));
