import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type * as schema from '../../../../database/schema';

/**
 * Abstract transaction type for repository operations.
 * This allows domain layer to remain agnostic of the specific ORM implementation.
 * The actual type is Drizzle's transaction, but we use unknown to avoid coupling.
 */
export type DatabaseTransaction = unknown;

/**
 * Drizzle-specific transaction type for infrastructure layer.
 */
export type DrizzleTransaction = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]
>[0];

/**
 * Converts abstract DatabaseTransaction to Drizzle-specific transaction.
 * Use this in infrastructure repositories to get type-safe access to Drizzle methods.
 */
export function toDrizzleTx(tx: DatabaseTransaction): DrizzleTransaction {
  return tx as DrizzleTransaction;
}
