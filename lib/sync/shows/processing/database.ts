/**
 * Робота з базою даних для шоу: створення, оновлення, рейтинги, провайдери.
 *
 * @example
 * import { upsertShow, upsertShowRatings, upsertShowRatingBuckets } from '@/lib/sync/shows/processing';
 * const { showId, isUpdate } = await upsertShow(tx, tmdbId, showData);
 * await upsertShowRatings(tx, showId, ratingTraktAvg, ratingTraktVotes);
 * const bucketsChanged = await upsertShowRatingBuckets(tx, showId, ratingDistribution);
 */

import type { NewShow, NewShowWatchersSnapshot } from '@/db/schema';
import {
  shows,
  showRatings,
  showWatchProviders,
  showRatingBuckets,
  showWatchersSnapshots,
} from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Створює або оновлює запис шоу в базі даних.
 *
 * @param tx Транзакція бази даних
 * @param tmdbId TMDB ID шоу
 * @param showData Дані шоу для створення/оновлення
 * @returns Об'єкт з ID шоу та прапорцем, чи було оновлення
 *
 * @example
 * const { showId, isUpdate } = await upsertShow(tx, 123, showData);
 */
export async function upsertShow(
  tx: any,
  tmdbId: number,
  showData: NewShow
): Promise<{ showId: number; isUpdate: boolean }> {
  const result = await tx
    .insert(shows)
    .values(showData)
    .onConflictDoUpdate({
      target: shows.tmdbId,
      set: {
        title: showData.title,
        titleUk: showData.titleUk,
        overview: showData.overview,
        overviewUk: showData.overviewUk,
        poster: showData.poster,
        posterUk: showData.posterUk,
        backdrop: showData.backdrop,
        ratingTmdb: showData.ratingTmdb,
        ratingTmdbCount: showData.ratingTmdbCount,
        popularityTmdb: showData.popularityTmdb,
        ratingImdb: showData.ratingImdb,
        imdbVotes: showData.imdbVotes,
        ratingMetacritic: showData.ratingMetacritic,
        firstAirDate: showData.firstAirDate,
        status: showData.status,
        tagline: showData.tagline,
        numberOfSeasons: showData.numberOfSeasons,
        numberOfEpisodes: showData.numberOfEpisodes,
        latestSeasonNumber: showData.latestSeasonNumber,
        latestSeasonEpisodes: showData.latestSeasonEpisodes,
        lastEpisodeSeason: showData.lastEpisodeSeason,
        lastEpisodeNumber: showData.lastEpisodeNumber,
        lastEpisodeAirDate: showData.lastEpisodeAirDate,
        nextEpisodeSeason: showData.nextEpisodeSeason,
        nextEpisodeNumber: showData.nextEpisodeNumber,
        nextEpisodeAirDate: showData.nextEpisodeAirDate,
        contentRating: showData.contentRating,
        trendingScore: showData.trendingScore,
        delta3m: showData.delta3m,
        watchersDelta: showData.watchersDelta,
        ratingTrakt: showData.ratingTrakt,
        trendingUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning({ id: shows.id });

  const showId = result[0].id;
  const isUpdate = true;

  return { showId, isUpdate };
}

/**
 * Створює або оновлює рейтинги шоу.
 *
 * @param tx Транзакція бази даних
 * @param showId ID шоу
 * @param ratingTraktAvg Середній рейтинг Trakt
 * @param ratingTraktVotes Кількість голосів Trakt
 * @example
 * await upsertShowRatings(tx, 123, 8.5, 1500);
 */
export async function upsertShowRatings(
  tx: any,
  showId: number,
  ratingTraktAvg: number | null,
  ratingTraktVotes: number | null
): Promise<void> {
  if (ratingTraktAvg === null && ratingTraktVotes === null) return;

  await tx
    .insert(showRatings)
    .values({
      showId,
      source: 'trakt',
      avg: ratingTraktAvg,
      votes: ratingTraktVotes,
    })
    .onConflictDoUpdate({
      target: [showRatings.showId, showRatings.source],
      set: {
        avg: ratingTraktAvg,
        votes: ratingTraktVotes,
        updatedAt: new Date(),
      },
    });
}

/**
 * Створює або оновлює провайдерів перегляду шоу.
 *
 * @param tx Транзакція бази даних
 * @param showId ID шоу
 * @param providers Масив провайдерів перегляду
 * @example
 * await upsertShowWatchProviders(tx, 123, providers);
 */
export async function upsertShowWatchProviders(
  tx: any,
  showId: number,
  providers: any[]
): Promise<void> {
  if (!providers || providers.length === 0) return;

  for (const provider of providers) {
    await tx
      .insert(showWatchProviders)
      .values({
        showId,
        region: provider.region,
        providerId: provider.providerId,
        providerName: provider.providerName,
        logoPath: provider.logoPath,
        linkUrl: provider.linkUrl,
        category: provider.category,
        rank: provider.rank,
      })
      .onConflictDoUpdate({
        target: [
          showWatchProviders.showId,
          showWatchProviders.region,
          showWatchProviders.providerId,
          showWatchProviders.category,
        ],
        set: {
          providerName: provider.providerName,
          logoPath: provider.logoPath,
          linkUrl: provider.linkUrl,
          rank: provider.rank,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Створює або оновлює дистрибуцію рейтингів по категоріях.
 *
 * @param tx Транзакція бази даних
 * @param showId ID шоу
 * @param ratingDistribution Дистрибуція рейтингів по категоріях
 * @returns Кількість змінених записів
 * @example
 * const bucketsChanged = await upsertShowRatingBuckets(tx, 123, ratingDistribution);
 */
export async function upsertShowRatingBuckets(
  tx: any,
  showId: number,
  ratingDistribution: Record<string, number> | undefined
): Promise<number> {
  if (!ratingDistribution) return 0;

  let changed = 0;
  const entries = Object.entries(ratingDistribution);

  for (const [bucket, count] of entries) {
    const result = await tx
      .insert(showRatingBuckets)
      .values({
        showId,
        source: 'trakt',
        bucket,
        count,
      })
      .onConflictDoUpdate({
        target: [showRatingBuckets.showId, showRatingBuckets.source, showRatingBuckets.bucket],
        set: {
          count,
          updatedAt: new Date(),
        },
      });

    if (result.rowsAffected > 0) changed++;
  }

  return changed;
}

/**
 * Створює або оновлює знімок глядачів шоу.
 *
 * @param tx Транзакція бази даних
 * @param tmdbId TMDB ID шоу
 * @param showId ID шоу в базі даних
 * @param watchers Кількість глядачів
 * @returns 'inserted' якщо створено новий запис, 'unchanged' якщо не змінено
 *
 * @example
 * const result = await upsertShowWatchersSnapshot(tx, 123, 456, 1000);
 */
export async function upsertShowWatchersSnapshot(
  tx: any,
  tmdbId: number,
  showId: number,
  watchers: number
): Promise<'inserted' | 'unchanged'> {
  // Перевіряємо, чи є вже знімок за останні 24 години
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existing = await tx
    .select({ id: showWatchersSnapshots.id })
    .from(showWatchersSnapshots)
    .where(
      and(eq(showWatchersSnapshots.showId, showId), gte(showWatchersSnapshots.createdAt, dayAgo))
    )
    .limit(1);

  if (existing.length > 0) {
    return 'unchanged';
  }

  // Створюємо новий знімок
  const snapshotData: NewShowWatchersSnapshot = {
    showId,
    tmdbId,
    watchers,
    createdAt: new Date(),
  };

  await tx.insert(showWatchersSnapshots).values(snapshotData);
  return 'inserted';
}
