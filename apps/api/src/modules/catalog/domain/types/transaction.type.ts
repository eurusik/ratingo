/**
 * Abstract transaction type for repository operations.
 * This allows domain layer to remain agnostic of the specific ORM implementation.
 * The actual type is Drizzle's transaction, but we use unknown to avoid coupling.
 */
export type DatabaseTransaction = unknown;
