/**
 * Backfill провайдерів - тонкий агрегатор
 *
 * Делегує логіку до модулів в піддиректорії ./backfillProviders/
 * для кращої організації та підтримуваності коду.
 */

import type { BackfillProvidersResult } from './backfillProviders/types';

/**
 * Заповнює реєстр провайдерів з існуючої таблиці зв'язків
 *
 * @returns Кількість вставлених та оновлених записів
 */
export async function backfillProviderRegistryFromJoinTable(): Promise<BackfillProvidersResult> {
  const { backfillProviderRegistryFromJoinTable: backfill } = await import(
    './backfillProviders/index'
  );
  return backfill();
}
