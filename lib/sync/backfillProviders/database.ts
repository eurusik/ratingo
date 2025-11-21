/**
 * Модуль для роботи з базою даних провайдерів
 */

import { db } from '@/db';
import { watchProvidersRegistry, showWatchProviders } from '@/db/schema';
import { sql, eq, inArray } from 'drizzle-orm';
import type { ProviderData, ExistingProvider } from './types';

/**
 * Отримує унікальні ID провайдерів з таблиці зв'язків
 */
export async function getDistinctProviderIds(): Promise<number[]> {
  const rows = await db
    .select({ providerId: showWatchProviders.providerId })
    .from(showWatchProviders)
    .where(sql`"show_watch_providers"."provider_id" IS NOT NULL`)
    .groupBy(showWatchProviders.providerId);

  return rows.map((row) => Number(row.providerId)).filter(Boolean);
}

/**
 * Отримує існуючі провайдери з реєстру
 */
export async function getExistingProviders(providerIds: number[]): Promise<ExistingProvider[]> {
  const rows = await db
    .select({ id: watchProvidersRegistry.id, tmdbId: watchProvidersRegistry.tmdbId })
    .from(watchProvidersRegistry)
    .where(inArray(watchProvidersRegistry.tmdbId, providerIds));

  return rows.map((row) => ({
    id: Number(row.id),
    tmdbId: Number(row.tmdbId),
  }));
}

/**
 * Отримує дані провайдера з таблиці зв'язків
 */
export async function getProviderData(providerId: number): Promise<ProviderData | null> {
  const rows = await db
    .select({
      name: showWatchProviders.providerName,
      logoPath: showWatchProviders.logoPath,
    })
    .from(showWatchProviders)
    .where(eq(showWatchProviders.providerId, providerId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    providerId,
    name: row.name || null,
    logoPath: row.logoPath || null,
  };
}

/**
 * Оновлює існуючий провайдер в реєстрі
 */
export async function updateProviderRegistry(
  id: number,
  name: string | null,
  logoPath: string | null,
  slug: string | null
): Promise<void> {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (name !== null) updateData.name = name;
  if (logoPath !== null) updateData.logoPath = logoPath;
  if (slug !== null) updateData.slug = slug;

  await db.update(watchProvidersRegistry).set(updateData).where(eq(watchProvidersRegistry.id, id));
}

/**
 * Вставляє нового провайдера в реєстр
 */
export async function insertProviderRegistry(
  tmdbId: number,
  name: string | null,
  logoPath: string | null,
  slug: string | null
): Promise<void> {
  const insertData: any = {
    tmdbId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (name !== null) insertData.name = name;
  if (logoPath !== null) insertData.logoPath = logoPath;
  if (slug !== null) insertData.slug = slug;

  await db.insert(watchProvidersRegistry).values(insertData);
}
