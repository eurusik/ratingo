/**
 * Модуль для очищення застарілих записів
 */

import { db } from '@/db';
import { showAirings } from '@/db/schema';
import { eq, lt, sql } from 'drizzle-orm';
import type { PruneResult } from './types';

/**
 * Очищує застарілі ефіри з бази даних
 */
export async function pruneStaleAirings(): Promise<PruneResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Видаляємо ефіри старші за 30 днів

  // Спочатку знаходимо всі застарілі записи
  const staleAirings = await db
    .select({ id: showAirings.id })
    .from(showAirings)
    .where(lt(showAirings.airDate, sql`${cutoffDate.toISOString()}`));

  // Видаляємо кожен знайдений запис
  for (const airing of staleAirings) {
    await db.delete(showAirings).where(eq(showAirings.id, airing.id));
  }

  return {
    deleted: staleAirings.length,
    cutoffDate: cutoffDate.toISOString(),
  };
}
