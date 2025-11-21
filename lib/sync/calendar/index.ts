/**
 * Основний модуль синхронізації календаря
 */

import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';
import { createCalendarConfig } from './dates';
import { getTrendingShows } from './shows';
import { getExistingAiring, updateAiring, insertAiring } from './airings';
import { getShowIdByTmdbId } from './shows';
import type { CalendarSyncResult, TraktAiringData, AiringData } from './types';

/**
 * Синхронізує ефіри з Trakt календаря для трендових шоу
 */
export async function runCalendarSync(trendingSetArg?: Set<number>): Promise<CalendarSyncResult> {
  let processed = 0;
  let inserted = 0;
  let updated = 0;

  const config = createCalendarConfig();

  // Отримуємо множину трендових шоу
  const trendingSet =
    trendingSetArg && trendingSetArg.size > 0 ? trendingSetArg : new Set(await getTrendingShows());

  // Отримуємо дані з календаря Trakt
  const calendarData = await withRetry(() =>
    traktClient.getCalendarShows(config.startDate, config.days)
  );

  // Обробляємо кожен елемент календаря
  for (const item of calendarData) {
    try {
      const result = await processCalendarItem(item, trendingSet);
      if (result) {
        processed++;
        if (result === 'inserted') inserted++;
        else if (result === 'updated') updated++;
      }
    } catch {
      // Ігноруємо помилки обробки окремих елементів
    }
  }

  return { processed, inserted, updated };
}

/**
 * Обробляє окремий елемент з календаря
 */
async function processCalendarItem(
  item: TraktAiringData,
  trendingSet: Set<number>
): Promise<'inserted' | 'updated' | null> {
  const showData = item.show;
  const episode = item.episode;
  const tmdbId = showData?.ids?.tmdb;

  if (!tmdbId || !episode || !trendingSet.has(tmdbId)) {
    return null;
  }

  // Підготовлюємо дані для ефіру
  const airingData: AiringData = {
    showId: await getShowIdByTmdbId(tmdbId),
    tmdbId,
    traktId: showData.ids?.trakt ?? null,
    title: showData.title ?? null,
    episodeTitle: episode.title ?? null,
    season: episode.season ?? null,
    episode: episode.number ?? null,
    airDate: item.first_aired ?? null,
    network: (showData as any).network ?? null,
    type: 'episode',
  };

  // Перевіряємо чи існує такий ефір
  const existingAiring = await getExistingAiring(
    airingData.tmdbId,
    airingData.season,
    airingData.episode
  );

  if (existingAiring) {
    // Оновлюємо існуючий ефір
    await updateAiring(existingAiring.id, airingData);
    return 'updated';
  } else {
    // Вставляємо новий ефір
    await insertAiring(airingData);
    return 'inserted';
  }
}
