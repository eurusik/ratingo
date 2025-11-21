/**
 * @fileoverview Основна функція обробки фільмів з Trakt
 */

import { db } from '@/db';
import { movies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { calculateTrendingScore } from '@/lib/utils';
import {
  upsertMovie,
  upsertMovieRatings,
  upsertRatingBuckets,
  upsertMovieVideos,
  upsertProvidersRegistry,
  upsertMovieWatchProviders,
  upsertContentRatings,
  upsertMovieCast,
  upsertWatchersSnapshot,
} from '@/lib/sync/movies/upserts';
import {
  fetchVideosAndCast,
  resolveImdbId,
  fetchOmdbAggregatedRatings,
  fetchTraktRatingsForMovie,
  computePrimaryRating,
  combineWatchProvidersWithFallback,
  fetchContentRatingsByRegion,
  buildMovieRecord,
} from './utils';
import { cachedWithRetry } from '@/lib/sync/utils';
import { tmdbClient } from '@/lib/api/tmdb';
import type { ProcessMovieContext, ProcessMovieResult, TraktMovieItem } from './types';

/**
 * Обробляє один елемент фільму з Trakt: завантажує TMDB деталі/переклад/відео/каст,
 * агрегує рейтинги OMDb і Trakt, обчислює дельти популярності та тренд-скор,
 * формує запис і виконує upsert у відповідні таблиці.
 *
 * @param traktItem Елемент від Trakt із полем `movie` та `watchers`
 * @param ctx Контекст обробки: кеші TMDB, мапи популярності, maxWatchers
 * @returns Підсумковий статус із кількістю оновлень/додань/снапшотів
 */
export async function processMovie(
  traktItem: TraktMovieItem,
  ctx: ProcessMovieContext
): Promise<ProcessMovieResult> {
  const res: ProcessMovieResult = {
    updated: 0,
    added: 0,
    skipped: false,
    ratingsUpdated: 0,
    bucketsUpserted: 0,
    snapshotsInserted: 0,
    snapshotsUnchanged: 0,
    snapshotsProcessed: 0,
  };
  console.log(`Processing movie: ${traktItem.movie.title}`);
  try {
    const traktMovie = traktItem.movie;
    const tmdbId = traktMovie?.ids?.tmdb;
    if (!tmdbId) {
      res.skipped = true;
      return res;
    }
    const [details, translation] = await Promise.all([
      cachedWithRetry(ctx.tmdbDetailsCache, tmdbId, 'tmdb.movie.details', () =>
        tmdbClient.getMovieDetails(tmdbId)
      ),
      cachedWithRetry(ctx.tmdbTranslationCache, tmdbId, 'tmdb.movie.translation', () =>
        tmdbClient.getMovieTranslation(tmdbId)
      ),
    ]);

    const { preferredVideos, cast } = await fetchVideosAndCast(tmdbId);

    const imdbId = await resolveImdbId(traktMovie.ids, tmdbId, ctx);
    const { imdbRating, imdbVotes, ratingMetacritic } = await fetchOmdbAggregatedRatings(imdbId);

    const traktIdOrSlug: string | number =
      typeof traktMovie.ids.slug === 'string'
        ? traktMovie.ids.slug
        : typeof traktMovie.ids.trakt === 'number'
          ? traktMovie.ids.trakt
          : 0;
    const { ratingTraktAvg, ratingTraktVotes, ratingDistribution } =
      await fetchTraktRatingsForMovie(traktIdOrSlug);

    const primaryRating = computePrimaryRating(details.vote_average, ratingTraktAvg, imdbRating);
    const trendingScore = calculateTrendingScore(
      Number(details.vote_average || 0),
      Number(traktItem.watchers || 0),
      ctx.maxWatchers
    );

    const prevRow = await db
      .select({ ratingTraktPrev: movies.ratingTrakt })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1);
    const previousWatchers =
      typeof prevRow[0]?.ratingTraktPrev === 'number' ? Number(prevRow[0].ratingTraktPrev) : null;
    const watchersCount = Number(traktItem.watchers || 0);
    const watchersDelta = previousWatchers !== null ? watchersCount - previousWatchers : 0;

    const sumRecentThreeMonths =
      (ctx.monthly.m0[tmdbId] || 0) + (ctx.monthly.m1[tmdbId] || 0) + (ctx.monthly.m2[tmdbId] || 0);
    const sumPreviousThreeMonths =
      (ctx.monthly.m3[tmdbId] || 0) + (ctx.monthly.m4[tmdbId] || 0) + (ctx.monthly.m5[tmdbId] || 0);
    const deltaThreeMonths = sumRecentThreeMonths - sumPreviousThreeMonths;

    const combinedWatchProviders = await combineWatchProvidersWithFallback(tmdbId, ctx);
    const contentRatings = await fetchContentRatingsByRegion(tmdbId);

    const movieData = buildMovieRecord({
      tmdbId,
      traktMovie,
      details,
      translation,
      ratings: {
        imdbRating,
        imdbVotes,
        ratingMetacritic,
        traktAvg: ratingTraktAvg,
        traktVotes: ratingTraktVotes,
      },
      watchers: watchersCount,
      watchersDelta,
      delta3m: deltaThreeMonths,
      primaryRating,
      trendingScore,
      preferredVideos,
      watchProviders: combinedWatchProviders,
      cast,
    });

    await db.transaction(async (tx) => {
      const { movieId, isUpdate } = await upsertMovie(tx, tmdbId, movieData);
      if (isUpdate) res.updated++;
      else res.added++;

      await upsertMovieRatings(tx, movieId, ratingTraktAvg, ratingTraktVotes);
      res.ratingsUpdated++;

      const bucketsChanged = await upsertRatingBuckets(tx, movieId, ratingDistribution);
      res.bucketsUpserted += bucketsChanged;

      await upsertMovieVideos(tx, movieId, preferredVideos);

      if (combinedWatchProviders.length) {
        try {
          await upsertProvidersRegistry(tx, combinedWatchProviders);
        } catch (e) {
          console.error('Failed to upsert providers registry', e);
        }
        await upsertMovieWatchProviders(tx, movieId, combinedWatchProviders);
      }

      await upsertContentRatings(tx, movieId, contentRatings);

      await upsertMovieCast(tx, movieId, cast);

      res.snapshotsProcessed++;
      const snapshotResult = await upsertWatchersSnapshot(tx, tmdbId, movieId, watchersCount);
      if (snapshotResult === 'inserted') res.snapshotsInserted++;
      else res.snapshotsUnchanged++;
    });
  } catch (error) {
    res.error = `Movie sync error`;
    console.error('Movie sync error:', error);
  }
  return res;
}
