/**
 * Головний модуль backfillProviders
 *
 * Відповідає за заповнення реєстру провайдерів з існуючих даних
 */

import {
  getDistinctProviderIds,
  getExistingProviders,
  getProviderData,
  updateProviderRegistry,
  insertProviderRegistry,
} from './database';

import { prepareProviderData } from './processors';

import type { BackfillProvidersResult } from './types';

/**
 * Заповнює реєстр провайдерів з існуючої таблиці зв'язків
 *
 * @returns Кількість вставлених та оновлених записів
 */
export async function backfillProviderRegistryFromJoinTable(): Promise<BackfillProvidersResult> {
  // Отримуємо унікальні ID провайдерів
  const providerIds = await getDistinctProviderIds();
  if (providerIds.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  // Отримуємо існуючі провайдери для перевірки дублікатів
  const existingProviders = await getExistingProviders(providerIds);
  const existingByTmdbId = new Map(existingProviders.map((p) => [p.tmdbId, p.id]));

  let inserted = 0;
  let updated = 0;

  // Обробляємо кожного провайдера
  for (const providerId of providerIds) {
    try {
      // Отримуємо дані провайдера
      const providerData = await getProviderData(providerId);
      if (!providerData) continue;

      // Підготовлюємо дані для реєстру
      const registryData = prepareProviderData(providerId, providerData);
      if (!registryData) continue;

      const existingId = existingByTmdbId.get(providerId);

      if (existingId) {
        // Оновлюємо існуючий запис
        await updateProviderRegistry(
          existingId,
          registryData.name,
          registryData.logoPath,
          registryData.slug
        );
        updated++;
      } else {
        // Вставляємо новий запис
        await insertProviderRegistry(
          registryData.tmdbId,
          registryData.name,
          registryData.logoPath,
          registryData.slug
        );
        inserted++;
      }
    } catch (error) {
      console.error(`Failed to process provider ${providerId}:`, error);
      // Продовжуємо обробку інших провайдерів
    }
  }

  return { inserted, updated };
}
