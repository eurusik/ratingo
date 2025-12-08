/**
 * Watch provider data for syncing.
 */
export interface WatchProviderData {
  providerId: number;
  name: string;
  logoPath?: string | null;
  type: string;
  displayPriority?: number;
}

/**
 * Transaction type for repository operations.
 */
export type DbTransaction = any; // Will be properly typed by implementation

/**
 * Abstract interface for Watch Provider storage operations.
 */
export interface IProviderRepository {
  /**
   * Syncs watch providers for a media item within a transaction.
   * Updates provider registry and links providers to the media item.
   */
  syncProviders(tx: DbTransaction, mediaId: string, providers: WatchProviderData[]): Promise<void>;
}

export const PROVIDER_REPOSITORY = Symbol('PROVIDER_REPOSITORY');
