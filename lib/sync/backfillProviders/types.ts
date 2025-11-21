/**
 * Результат операції бекфілу провайдерів
 */
export interface BackfillProvidersResult {
  inserted: number;
  updated: number;
}

/**
 * Дані провайдера з таблиці зв'язків
 */
export interface ProviderData {
  providerId: number;
  name: string | null;
  logoPath: string | null;
}

/**
 * Дані для вставки/оновлення в реєстрі
 */
export interface ProviderRegistryData {
  tmdbId: number;
  name: string | null;
  logoPath: string | null;
  slug: string | null;
}

/**
 * Існуючий запис в реєстрі
 */
export interface ExistingProvider {
  id: number;
  tmdbId: number;
}
