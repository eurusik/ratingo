/**
 * Основна функція обробки одного Trakt-елемента.
 * Виконує: фільтрацію аніме, завантаження TMDB/OMDb/Trakt,
 * апсерти у БД, снить шот, пов'язані шоу та довідники.
 *
 * @param traktItem Trakt trending show item
 * @param ctx Контекст обробки
 * @returns Результат обробки
 *
 * @example
 * const traktItem = {
 *   watchers: 1234,
 *   show: {
 *     ids: { tmdb: 1399 },
 *     title: 'Game of Thrones',
 *     year: 2011
 *   }
 * };
 * const ctx = createProcessShowContext();
 * const result = await processShow(traktItem, ctx);
 * console.log(`Updated: ${result.updated}, Added: ${result.added}`);
 */

import { db } from '@/db';
import { shows } from '@/db/schema';
import type { TraktTrendingShow } from '@/lib/types';
import type { ProcessShowContext, ProcessShowResult } from './types';

// Імпортуємо модулі
import { createShowApiClients } from './api';
import { extractSeasonEpisode, mergeProviders, isAnimeItem, prepareShowData } from './processing';
import { computeDeltas } from './metrics';
import {
  upsertShow,
  upsertShowRatings,
  upsertShowRatingBuckets,
  upsertShowWatchProviders,
  upsertShowWatchersSnapshot,
} from './database';
import { getRelatedTmdbIds } from '@/lib/sync/related';
import { ensureRelatedShows, linkRelated } from './related';

export async function processShow(
  traktItem: TraktTrendingShow,
  ctx: ProcessShowContext
): Promise<ProcessShowResult> {
  const res: ProcessShowResult = {
    updated: 0,
    added: 0,
    skipped: false,
    ratingsUpdated: 0,
    bucketsUpserted: 0,
    snapshotsInserted: 0,
    snapshotsUnchanged: 0,
    snapshotsProcessed: 0,
    relatedShowsInserted: 0,
    relatedLinksAdded: 0,
    relatedSourceCounts: { trakt: 0, tmdb: 0 },
    relatedCandidatesTotal: 0,
    relatedShowsWithCandidates: 0,
  };

  try {
    const ANIME_GENRE_ID = 16;
    const traktShow = traktItem.show;
    const tmdbId = traktShow?.ids?.tmdb;

    if (!tmdbId) {
      res.skipped = true;
      return res;
    }

    // Раннє пропускання за ключовими словами в назві Trakt
    const titleLower = String(traktShow.title || '').toLowerCase();
    if (ctx.animeKeywords.some((k) => titleLower.includes(k))) {
      res.skipped = true;
      return res;
    }

    // Створюємо API клієнтів
    const apiClients = createShowApiClients({ caches: ctx, onRetryLabel: ctx.onRetryLabel });

    // Отримуємо основні дані
    const [tmdbShowData, ukTranslation] = await Promise.all([
      apiClients.getShowDetails(tmdbId),
      apiClients.getShowTranslation(tmdbId),
    ]);

    if (
      !tmdbShowData ||
      isAnimeItem(tmdbShowData, ukTranslation, ctx.animeKeywords, ANIME_GENRE_ID)
    ) {
      res.skipped = true;
      return res;
    }

    // Отримуємо додаткові дані паралельно
    const [
      { videosPreferred, cast },
      { watchProvidersUa, watchProvidersUs, contentRatingUa, contentRatingUs },
      { imdbRating, imdbVotes, ratingMetacritic },
      { rating: ratingTraktAvg, votes: ratingTraktVotes, distribution: ratingDistribution },
    ] = await Promise.all([
      // Відео та акторський склад
      (async () => {
        const [videosData, credits] = await Promise.allSettled([
          apiClients.getShowVideos(tmdbId),
          apiClients.getShowCredits(tmdbId),
        ]);

        const allVideos = videosData.status === 'fulfilled' ? videosData.value : [];
        const preferredTypes = ['Trailer', 'Teaser', 'Clip', 'Featurette', 'Promo'];
        const youtubeVideos = allVideos.filter((video) => video.site === 'YouTube');
        const youtubeFiltered = youtubeVideos.filter((video) =>
          preferredTypes.includes(String(video.type || ''))
        );
        const allFiltered = allVideos.filter((video) =>
          preferredTypes.includes(String(video.type || ''))
        );

        const videosPreferred = youtubeFiltered.length
          ? youtubeFiltered
          : allFiltered.length
            ? allFiltered
            : youtubeVideos.length
              ? youtubeVideos
              : allVideos;

        const cast =
          credits.status === 'fulfilled' &&
          credits.value &&
          Array.isArray((credits.value as any)?.cast)
            ? (credits.value as any).cast.slice(0, 12)
            : [];

        return { videosPreferred, cast };
      })(),

      // Провайдери та контент-рейтинги
      (async () => {
        const [uaProviders, usProviders, uaRating, usRating] = await Promise.all([
          apiClients.getWatchProviders(tmdbId, 'UA'),
          apiClients.getWatchProviders(tmdbId, 'US'),
          apiClients.getContentRating(tmdbId, 'UA'),
          apiClients.getContentRating(tmdbId, 'US'),
        ]);

        return {
          watchProvidersUa: uaProviders || [],
          watchProvidersUs: usProviders || [],
          contentRatingUa: uaRating,
          contentRatingUs: usRating,
        };
      })(),

      // OMDb рейтинги
      (async () => {
        let imdbRating: number | null = null;
        let imdbVotes: number | null = null;
        let ratingMetacritic: number | null = null;

        if (process.env.OMDB_API_KEY) {
          try {
            const imdbId =
              traktShow.ids.imdb || (await apiClients.getExternalIds(tmdbId))?.imdb_id || null;
            if (imdbId) {
              const { omdbClient } = await import('@/lib/api/omdb');
              const agg = await omdbClient.getAggregatedRatings(imdbId);
              imdbRating =
                typeof agg.imdbRating === 'number' && Number.isFinite(agg.imdbRating)
                  ? agg.imdbRating
                  : null;
              imdbVotes =
                typeof agg.imdbVotes === 'number' && Number.isFinite(agg.imdbVotes)
                  ? agg.imdbVotes
                  : null;
              ratingMetacritic =
                typeof agg.metacritic === 'number' && Number.isFinite(agg.metacritic)
                  ? agg.metacritic
                  : typeof agg.metascore === 'number' && Number.isFinite(agg.metascore)
                    ? agg.metascore
                    : null;
            }
          } catch {}
        }

        return { imdbRating, imdbVotes, ratingMetacritic };
      })(),

      // Trakt рейтинги
      apiClients.getTraktRatings(traktShow.ids.slug || String(traktShow.ids.trakt)),
    ]);

    // Обчислюємо метрики
    const { trendingScore, delta3mVal, watchersDelta } = await computeDeltas(
      tmdbId,
      traktItem.watchers,
      tmdbShowData.vote_average ?? null,
      ctx
    );

    // Кандидати на пов'язані шоу
    ctx.currentTrendingTmdbIds.add(tmdbId);
    const { ids: relatedTmdbIds, source: relatedSource } = await getRelatedTmdbIds(
      tmdbId,
      traktShow.ids.slug || traktShow.ids.trakt
    );
    res.relatedCandidatesTotal += relatedTmdbIds.length;
    if (relatedTmdbIds.length > 0) res.relatedShowsWithCandidates += 1;

    // Підготовляємо дані для збереження
    const seasonInfo = extractSeasonEpisode(tmdbShowData);
    const watchProvidersCombined = mergeProviders(watchProvidersUa, watchProvidersUs);

    const showData = prepareShowData(
      tmdbShowData,
      ukTranslation,
      watchProvidersCombined,
      contentRatingUa,
      contentRatingUs,
      imdbRating,
      imdbVotes,
      ratingMetacritic,
      false, // isAnime - вже перевірили вище
      seasonInfo,
      trendingScore,
      delta3mVal,
      watchersDelta,
      traktItem.watchers
    );

    // Зберігаємо дані в транзакції
    await db.transaction(async (tx: any) => {
      const { showId, isUpdate } = await upsertShow(tx, tmdbId, showData);
      if (isUpdate) res.updated++;
      else res.added++;

      await upsertShowRatings(tx, showId, ratingTraktAvg, ratingTraktVotes);
      res.ratingsUpdated++;

      const bucketsChanged = await upsertShowRatingBuckets(tx, showId, ratingDistribution);
      res.bucketsUpserted += bucketsChanged;

      await upsertShowWatchProviders(tx, showId, watchProvidersCombined);

      res.snapshotsProcessed++;
      const snapResult = await upsertShowWatchersSnapshot(tx, tmdbId, showId, traktItem.watchers);
      if (snapResult === 'inserted') res.snapshotsInserted++;
      else res.snapshotsUnchanged++;

      if (relatedTmdbIds.length > 0) {
        const inserted = await ensureRelatedShows(tx, relatedTmdbIds, ctx);
        res.relatedShowsInserted += inserted;
        const addedLinks = await linkRelated(tx, showId, relatedTmdbIds, relatedSource);
        res.relatedLinksAdded += addedLinks;
        res.relatedSourceCounts[relatedSource] += addedLinks;
      }
    });
  } catch (error) {
    res.error = `Show sync error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(error);
  }

  return res;
}
