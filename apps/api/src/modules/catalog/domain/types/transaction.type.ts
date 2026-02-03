/**
 * Abstract transaction type for repository operations.
 * This allows domain layer to remain agnostic of the specific ORM implementation.
 *
 * Infrastructure layer (Drizzle repositories) should use toDrizzleTx()
 * from infrastructure/utils/drizzle-transaction.ts to convert to concrete type.
 */
export type DatabaseTransaction = unknown;
