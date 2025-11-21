/**
 * Модуль для роботи з ефірами
 */

import { db } from '@/db';
import { showAirings } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { AiringData } from './types';

/**
 * Перевіряє чи існує ефір
 */
export async function getExistingAiring(
  tmdbId: number,
  season: number | null,
  episode: number | null
): Promise<{ id: number } | null> {
  // Створюємо умови динамічно, щоб уникнути проблем з null значеннями
  const conditions = [eq(showAirings.tmdbId, tmdbId)];

  if (season !== null) {
    conditions.push(eq(showAirings.season, season));
  } else {
    conditions.push(isNull(showAirings.season));
  }

  if (episode !== null) {
    conditions.push(eq(showAirings.episode, episode));
  } else {
    conditions.push(isNull(showAirings.episode));
  }

  const rows = await db
    .select({ id: showAirings.id })
    .from(showAirings)
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Оновлює існуючий ефір
 */
export async function updateAiring(id: number, data: AiringData): Promise<void> {
  await db
    .update(showAirings)
    .set({
      showId: data.showId,
      traktId: data.traktId,
      title: data.title,
      episodeTitle: data.episodeTitle,
      airDate: data.airDate,
      network: data.network,
      type: data.type,
      updatedAt: new Date(),
    })
    .where(eq(showAirings.id, id));
}

/**
 * Вставляє новий ефір
 */
export async function insertAiring(data: AiringData): Promise<void> {
  await db.insert(showAirings).values({
    showId: data.showId,
    tmdbId: data.tmdbId,
    traktId: data.traktId,
    title: data.title,
    episodeTitle: data.episodeTitle,
    season: data.season,
    episode: data.episode,
    airDate: data.airDate,
    network: data.network,
    type: data.type,
  });
}
