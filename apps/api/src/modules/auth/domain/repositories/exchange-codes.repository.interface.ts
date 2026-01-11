/**
 * Injection token for exchange codes repository.
 */
export const EXCHANGE_CODES_REPOSITORY = Symbol('EXCHANGE_CODES_REPOSITORY');

/**
 * Reasons for exchange code consumption failure.
 */
export const ConsumeCodeFailureReason = {
  NOT_FOUND: 'not_found',
  EXPIRED: 'expired',
  ALREADY_USED: 'already_used',
} as const;

export type ConsumeCodeFailureReasonType =
  (typeof ConsumeCodeFailureReason)[keyof typeof ConsumeCodeFailureReason];

/**
 * Exchange code record entity.
 */
export interface ExchangeCodeRecord {
  id: string;
  codeHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Result of consuming an exchange code.
 * Distinguishes between different failure reasons for proper error handling.
 */
export type ConsumeCodeResult =
  | { success: true; record: ExchangeCodeRecord }
  | { success: false; reason: ConsumeCodeFailureReasonType };

/**
 * Repository for OAuth exchange code storage.
 * Exchange codes are short-lived one-time codes for secure token delivery.
 */
export interface IExchangeCodesRepository {
  /**
   * Creates a new exchange code record.
   */
  create(
    data: Omit<ExchangeCodeRecord, 'id' | 'usedAt' | 'createdAt'>,
  ): Promise<ExchangeCodeRecord>;

  /**
   * Atomically consumes an exchange code.
   * Finds by hash where not used and not expired, marks as used.
   */
  consumeCode(codeHash: string): Promise<ConsumeCodeResult>;

  /**
   * Deletes expired and used codes older than retention period.
   */
  cleanupExpired(retentionHours?: number): Promise<number>;
}
