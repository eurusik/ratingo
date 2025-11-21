/**
 * Модуль для обробки провайдерів
 */

import type { ProviderData, ProviderRegistryData } from './types';

/**
 * Генерує slug з назви провайдера
 */
export function generateProviderSlug(name: string | null): string | null {
  if (!name || !name.trim()) return null;

  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Підготовлює дані для вставки/оновлення провайдера
 */
export function prepareProviderData(
  providerId: number,
  providerData: ProviderData | null
): ProviderRegistryData | null {
  if (!providerData) return null;

  return {
    tmdbId: providerId,
    name: providerData.name,
    logoPath: providerData.logoPath,
    slug: generateProviderSlug(providerData.name),
  };
}

/**
 * Перевіряє чи потрібно оновлювати провайдера
 */
export function shouldUpdateProvider(
  existingData: ProviderRegistryData,
  newData: ProviderRegistryData
): boolean {
  return (
    existingData.name !== newData.name ||
    existingData.logoPath !== newData.logoPath ||
    existingData.slug !== newData.slug
  );
}
