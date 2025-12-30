/**
 * Provider info with media count.
 */
export interface ProviderInfo {
  id: string;
  name: string;
  count: number;
}

/**
 * Abstract interface for Providers storage operations.
 * Extracts unique streaming providers from media catalog.
 */
export interface IProvidersRepository {
  /**
   * Gets unique streaming providers from catalog.
   * Extracts provider names from watch_providers JSONB across all regions.
   *
   * @returns {Promise<ProviderInfo[]>} Providers sorted by media count desc
   */
  findAllProviders(): Promise<ProviderInfo[]>;
}

/**
 * Injection token for the Providers repository.
 */
export const PROVIDERS_REPOSITORY = Symbol('PROVIDERS_REPOSITORY');
