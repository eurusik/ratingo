import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type * as schema from '../../../../database/schema';
import { type DatabaseTransaction } from '../../domain/types/transaction.type';

/**
 * Drizzle-specific transaction type for infrastructure layer.
 * This is the concrete implementation detail - domain layer uses abstract DatabaseTransaction.
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
