/**
 * Утилітарні функції для обробки фільмів.
 * Містить функції для вибору відео, завантаження даних з TMDB,
 * обчислення рейтингів та роботи з провайдерами.
 */

import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';
import { withRetry, cachedWithRetry } from '@/lib/sync/utils';
import type {
  TMDBVideo,
  WatchProvider,
  TMDBCastMember,
  TMDBMovieDetails,
  TMDBMovieTranslation,
} from '@/lib/types';
import type { ProcessMovieContext } from './types';
import type { NewMovie } from '@/db/schema';

/**
 * Вибирає пріоритетні відео YouTube для відображення трейлера.
 * Спочатку типи: 'Trailer' → 'Teaser' → 'Clip' → 'Featurette'.
 *
 * @param allVideos Масив усіх відео з TMDB
 * @returns Відфільтрований масив пріоритетних відео
 *
 * @example
 * ```typescript
 * const videos = selectPreferredVideos(allVideos);
 * console.log(`Знайдено ${videos.length} пріоритетних відео`);
 * ```
 */
export function selectPreferredVideos(allVideos: TMDBVideo[]): TMDBVideo[] {
  const youtubeVideos = (allVideos || []).filter((video) => video.site === 'YouTube');
  const preferredTypes = ['Trailer', 'Teaser', 'Clip', 'Featurette'];
  const videosWithPreferredTypes = youtubeVideos.filter((video) =>
    preferredTypes.includes(String(video.type || ''))
  );
  return videosWithPreferredTypes.length ? videosWithPreferredTypes : youtubeVideos;
}

/**
 * Завантажує відео та каст фільму з TMDB.
 *
 * @param tmdbId TMDB ID фільму
 * @returns Об'єкт з пріоритетними відео та акторським складом
 *
 * @example
 * ```typescript
 * const { preferredVideos, cast } = await fetchVideosAndCast(123);
 * ```
 */
export async function fetchVideosAndCast(
  tmdbId: number
): Promise<{ preferredVideos: TMDBVideo[]; cast: TMDBCastMember[] }> {
  const [videosData, credits] = await Promise.allSettled([
    withRetry(() => tmdbClient.getMovieVideos(tmdbId), 3, 300),
    withRetry(() => tmdbClient.getMovieCredits(tmdbId), 3, 300),
  ]);
  const allVideos: TMDBVideo[] =
    videosData.status === 'fulfilled' && Array.isArray(videosData.value?.results)
      ? (videosData.value.results as TMDBVideo[])
      : [];
  const preferredVideos = selectPreferredVideos(allVideos);
  const cast: TMDBCastMember[] = (
    credits.status === 'fulfilled' && Array.isArray(credits.value?.cast)
      ? credits.value.cast.slice(0, 20)
      : []
  ).map((c: TMDBCastMember & { id: number; name: string }) => ({
    id: c.id,
    name: c.name,
    character: c.character ?? null,
    profile_path: c.profile_path ?? null,
    order: typeof c.order === 'number' ? c.order : null,
  }));
  return { preferredVideos, cast };
}

/**
 * Визначає IMDb ID з Trakt або TMDB external ids.
 *
 * @param traktIds IMDb ID з Trakt (якщо є)
 * @param tmdbId TMDB ID фільму
 * @param ctx Контекст обробки з кешами
 * @returns IMDb ID або null
 *
 * @example
 * ```typescript
 * const imdbId = await resolveImdbId(traktMovie.ids, tmdbId, ctx);
 * ```
 */
export async function resolveImdbId(
  traktIds: { imdb?: string | null } | undefined,
  tmdbId: number,
  ctx: ProcessMovieContext
): Promise<string | null> {
  const direct = traktIds?.imdb || null;
  if (direct) return direct;
  const ext = await cachedWithRetry(
    ctx.tmdbExternalIdsCache,
    tmdbId,
    'tmdb.movie.externalIds',
    () => tmdbClient.getMovieExternalIds(tmdbId)
  );
  return ext?.imdb_id || null;
}

/**
 * Отримує агреговані рейтинги OMDb для IMDb ID.
 *
 * @param imdbId IMDb ID фільму
 * @returns Об'єкт з рейтингами IMDb, кількістю голосів та Metacritic
 *
 * @example
 * ```typescript
 * const { imdbRating, imdbVotes, ratingMetacritic } = await fetchOmdbAggregatedRatings(imdbId);
 * ```
 */
export async function fetchOmdbAggregatedRatings(
  imdbId: string | null
): Promise<{
  imdbRating: number | null;
  imdbVotes: number | null;
  ratingMetacritic: number | null;
}> {
  let imdbRating: number | null = null;
  let imdbVotes: number | null = null;
  let ratingMetacritic: number | null = null;
  if (!process.env.OMDB_API_KEY || !imdbId) return { imdbRating, imdbVotes, ratingMetacritic };
  try {
    const agg = await withRetry(() => omdbClient.getAggregatedRatingsMovie(imdbId), 3, 300);
    imdbRating =
      typeof agg.imdbRating === 'number' && Number.isFinite(agg.imdbRating) ? agg.imdbRating : null;
    imdbVotes =
      typeof agg.imdbVotes === 'number' && Number.isFinite(agg.imdbVotes) ? agg.imdbVotes : null;
    ratingMetacritic =
      typeof agg.metacritic === 'number' && Number.isFinite(agg.metacritic)
        ? agg.metacritic
        : typeof agg.metascore === 'number' && Number.isFinite(agg.metascore)
          ? agg.metascore
          : null;
  } catch {}
  return { imdbRating, imdbVotes, ratingMetacritic };
}

/**
 * Рейтинги Trakt для фільму: середній, кількість, дистрибуція.
 *
 * @param idOrSlug ID або slug фільму в Trakt
 * @returns Об'єкт з рейтингами Trakt
 *
 * @example
 * ```typescript
 * const { ratingTraktAvg, ratingTraktVotes, ratingDistribution } = await fetchTraktRatingsForMovie('game-of-thrones');
 * ```
 */
export async function fetchTraktRatingsForMovie(
  idOrSlug: string | number
): Promise<{
  ratingTraktAvg: number | null;
  ratingTraktVotes: number | null;
  ratingDistribution?: Record<string, number>;
}> {
  try {
    const r = await withRetry(() => traktClient.getMovieRatings(idOrSlug), 3, 300);
    const ratingTraktAvg = typeof r.rating === 'number' ? r.rating : null;
    const ratingTraktVotes = typeof r.votes === 'number' ? r.votes : null;
    const ratingDistribution: Record<string, number> | undefined = r.distribution;
    return { ratingTraktAvg, ratingTraktVotes, ratingDistribution };
  } catch {
    return { ratingTraktAvg: null, ratingTraktVotes: null };
  }
}

/**
 * Обчислює основний рейтинг на базі TMDB/Trakt/IMDb.
 *
 * @param tmdbVoteAverage Рейтинг з TMDB
 * @param traktAvg Рейтинг з Trakt
 * @param imdb Рейтинг з IMDb
 * @returns Обчислений первинний рейтинг
 *
 * @example
 * ```typescript
 * const primaryRating = computePrimaryRating(8.5, 8.2, 8.7);
 * ```
 */
export function computePrimaryRating(
  tmdbVoteAverage?: number | null,
  traktAvg?: number | null,
  imdb?: number | null
): number | null {
  return (tmdbVoteAverage ? Number(tmdbVoteAverage) : null) ?? traktAvg ?? imdb ?? null;
}

/**
 * Комбінує провайдерів UA+US з фолбеком на будь-які регіони.
 *
 * @param tmdbId TMDB ID фільму
 * @param ctx Контекст обробки з кешами
 * @returns Масив об'єднаних провайдерів
 *
 * @example
 * ```typescript
 * const providers = await combineWatchProvidersWithFallback(tmdbId, ctx);
 * ```
 */
export async function combineWatchProvidersWithFallback(
  tmdbId: number,
  ctx: ProcessMovieContext
): Promise<WatchProvider[]> {
  const uaProviders = await cachedWithRetry(
    ctx.tmdbProvidersCache,
    `${tmdbId}|UA`,
    'tmdb.movie.providers.UA',
    () => tmdbClient.getMovieWatchProvidersByRegion(tmdbId, 'UA')
  );
  const usProviders = await cachedWithRetry(
    ctx.tmdbProvidersCache,
    `${tmdbId}|US`,
    'tmdb.movie.providers.US',
    () => tmdbClient.getMovieWatchProvidersByRegion(tmdbId, 'US')
  );
  const providersMap = new Map<string, WatchProvider>();
  for (const provider of [...(uaProviders || []), ...(usProviders || [])]) {
    const compositeKey = `${provider.region}:${provider.id}`;
    if (!providersMap.has(compositeKey)) providersMap.set(compositeKey, provider);
  }
  let combinedProviders = Array.from(providersMap.values());
  if (!combinedProviders.length) {
    try {
      const anyProviders = await withRetry(
        () => tmdbClient.getMovieWatchProvidersAny(tmdbId),
        3,
        300
      );
      if (Array.isArray(anyProviders) && anyProviders.length)
        combinedProviders = anyProviders as WatchProvider[];
    } catch {}
  }
  return combinedProviders;
}

/**
 * Отримує вікові рейтинги TMDB для регіонів UA та US.
 *
 * @param tmdbId TMDB ID фільму
 * @returns Об'єкт з рейтингами для UA та US
 *
 * @example
 * ```typescript
 * const { UA, US } = await fetchContentRatingsByRegion(tmdbId);
 * ```
 */
export async function fetchContentRatingsByRegion(
  tmdbId: number
): Promise<{ UA: string | null; US: string | null }> {
  const [crUaRes, crUsRes] = await Promise.allSettled([
    withRetry(() => tmdbClient.getMovieContentRatingByRegion(tmdbId, 'UA'), 3, 300),
    withRetry(() => tmdbClient.getMovieContentRatingByRegion(tmdbId, 'US'), 3, 300),
  ]);
  const UA = crUaRes.status === 'fulfilled' ? crUaRes.value : null;
  const US = crUsRes.status === 'fulfilled' ? crUsRes.value : null;
  return { UA, US };
}

/**
 * Формує запис фільму для вставки/оновлення у таблиці `movies`.
 *
 * @param input Об'єкт з усіма необхідними даними для фільму
 * @returns Сформований запис фільму
 *
 * @example
 * ```typescript
 * const movieData = buildMovieRecord({
 *   tmdbId: 123,
 *   traktMovie: movieItem,
 *   details: tmdbDetails,
 *   translation: ukTranslation,
 *   ratings: { imdbRating: 8.5, imdbVotes: 1000, ratingMetacritic: 85, traktAvg: 8.2, traktVotes: 500 },
 *   watchers: 1234,
 *   watchersDelta: 100,
 *   delta3m: 50,
 *   primaryRating: 8.3,
 *   trendingScore: 75.5,
 *   preferredVideos: videos,
 *   watchProviders: providers,
 *   cast: castMembers
 * });
 * ```
 */
export function buildMovieRecord(input: {
  tmdbId: number;
  traktMovie: { title?: string | null; ids: { imdb?: string | null } };
  details: TMDBMovieDetails;
  translation: TMDBMovieTranslation | null;
  ratings: {
    imdbRating: number | null;
    imdbVotes: number | null;
    ratingMetacritic: number | null;
    traktAvg: number | null;
    traktVotes: number | null;
  };
  watchers: number;
  watchersDelta: number;
  delta3m: number;
  primaryRating: number | null;
  trendingScore: number;
  preferredVideos: TMDBVideo[];
  watchProviders: WatchProvider[];
  cast: TMDBCastMember[];
}): NewMovie {
  const {
    tmdbId,
    traktMovie,
    details,
    translation,
    ratings,
    watchers,
    watchersDelta,
    delta3m,
    primaryRating,
    trendingScore,
    preferredVideos,
    watchProviders,
    cast,
  } = input;
  return {
    tmdbId,
    imdbId: traktMovie.ids.imdb || null,
    title: traktMovie.title || details.title,
    titleUk: translation?.titleUk || null,
    overview: details.overview || null,
    overviewUk: translation?.overviewUk || null,
    poster: details.poster_path || null,
    posterUk: translation?.posterUk || null,
    backdrop: details.backdrop_path || null,
    ratingTmdb: details.vote_average || null,
    ratingTmdbCount: details.vote_count || null,
    popularityTmdb: details.popularity || null,
    ratingImdb: ratings.imdbRating ?? null,
    imdbVotes: ratings.imdbVotes ?? null,
    ratingMetacritic: ratings.ratingMetacritic ?? null,
    ratingTraktAvg: ratings.traktAvg ?? null,
    ratingTraktVotes: ratings.traktVotes ?? null,
    ratingTrakt: watchers,
    watchersDelta,
    delta3m,
    primaryRating,
    trendingScore,
    releaseDate: details.release_date || null,
    runtime: details.runtime ?? null,
    genres: Array.isArray(details.genres) ? details.genres : [],
    videos: preferredVideos,
    status: details.status || null,
    tagline: details.tagline || null,
    watchProviders,
    cast,
    trendingUpdatedAt: new Date(),
    updatedAt: new Date(),
  } as NewMovie;
}
