/**
 * Обробка даних шоу: витягування сезонів/епізодів, об'єднання провайдерів, визначення аніме, підготовка даних.
 *
 * @example
 * import { extractSeasonEpisode, mergeProviders, isAnimeItem } from '@/lib/sync/shows/processing/processing';
 * const seasonInfo = extractSeasonEpisode(tmdbShowData);
 * const mergedProviders = mergeProviders(uaProviders, usProviders);
 * const isAnime = isAnimeItem(showData, translation, animeKeywords, ANIME_GENRE_ID);
 */

import type { NewShow } from '@/db/schema';
import type { TMDBShowDetails, TMDBShowTranslation, WatchProvider } from '@/lib/types';

/**
 * Витягує агреговані дані про сезони/епізоди з TMDB деталей шоу.
 *
 * @param tmdbShowData Деталі шоу TMDB
 * @returns Номери та дати для останнього й наступного епізодів, останнього сезону
 *
 * @example
 * const info = extractSeasonEpisode(tmdbShowData);
 * console.log(info.latestSeasonNumber, info.lastEpisodeAirDate);
 */
export function extractSeasonEpisode(tmdbShowData: TMDBShowDetails): {
  latestSeasonNumber: number | null;
  latestSeasonEpisodes: number | null;
  lastEpisodeSeason: number | null;
  lastEpisodeNumber: number | null;
  lastEpisodeAirDate: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeAirDate: string | null;
} {
  const seasonsArr = Array.isArray(tmdbShowData.seasons) ? tmdbShowData.seasons : [];
  let latestSeasonNumber: number | null = null;
  let latestSeasonEpisodes: number | null = null;
  if (seasonsArr.length > 0) {
    const sortedSeasons = seasonsArr
      .filter((s: any) => typeof s.season_number === 'number')
      .sort((a: any, b: any) => (b.season_number ?? 0) - (a.season_number ?? 0));
    const latest = sortedSeasons.find((s: any) => s.season_number !== 0) || sortedSeasons[0];
    latestSeasonNumber = typeof latest?.season_number === 'number' ? latest.season_number : null;
    latestSeasonEpisodes = typeof latest?.episode_count === 'number' ? latest.episode_count : null;
  }
  const lastEpisodeSeason = tmdbShowData.last_episode_to_air?.season_number ?? null;
  const lastEpisodeNumber = tmdbShowData.last_episode_to_air?.episode_number ?? null;
  const lastEpisodeAirDate = tmdbShowData.last_episode_to_air?.air_date ?? null;
  const nextEpisodeSeason = tmdbShowData.next_episode_to_air?.season_number ?? null;
  const nextEpisodeNumber = tmdbShowData.next_episode_to_air?.episode_number ?? null;
  const nextEpisodeAirDate = tmdbShowData.next_episode_to_air?.air_date ?? null;
  return {
    latestSeasonNumber,
    latestSeasonEpisodes,
    lastEpisodeSeason,
    lastEpisodeNumber,
    lastEpisodeAirDate,
    nextEpisodeSeason,
    nextEpisodeNumber,
    nextEpisodeAirDate,
  };
}

/**
 * Об'єднує провайдерів перегляду з двох регіонів, унікально по `region:id`.
 *
 * @param providersA Список провайдерів (наприклад, UA)
 * @param providersB Список провайдерів (наприклад, US)
 * @returns Об'єднаний список без дублювань
 *
 * @example
 * const merged = mergeProviders(uaProviders, usProviders);
 */
export function mergeProviders(
  providersA: WatchProvider[] = [],
  providersB: WatchProvider[] = []
): WatchProvider[] {
  const byRegionAndId = new Map<string, WatchProvider>();
  for (const provider of [...providersA, ...providersB]) {
    const key = `${provider.region}:${provider.id}`;
    if (!byRegionAndId.has(key)) byRegionAndId.set(key, provider);
  }
  return Array.from(byRegionAndId.values());
}

/**
 * Визначає, чи є шоу аніме на основі жанрів та назви.
 *
 * @param tmdbShowData Деталі шоу з TMDB
 * @param ukTranslation Переклад українською
 * @param animeKeywords Ключові слова, які позначають аніме
 * @param animeGenreId TMDB ID жанру «Animation/Anime»
 * @returns true, якщо шоу є аніме
 *
 * @example
 * const isAnime = isAnimeItem(showData, translation, ['аніме', 'anime'], 16);
 */
export function isAnimeItem(
  tmdbShowData: TMDBShowDetails,
  ukTranslation: TMDBShowTranslation | null,
  animeKeywords: string[],
  animeGenreId: number
): boolean {
  const hasAnimeGenre = tmdbShowData.genres?.some((g: any) => g.id === animeGenreId) || false;
  const hasAnimeKeyword = animeKeywords.some((k) =>
    (ukTranslation?.titleUk || '').toLowerCase().includes(k)
  );
  return hasAnimeGenre || hasAnimeKeyword;
}

/**
 * Підготовлює базові дані для нового шоу з TMDB деталей.
 *
 * @param tmdbShowData Деталі шоу з TMDB
 * @param ukTranslation Переклад українською
 * @param providers Провайдери перегляду
 * @param contentRatingUa Рейтинг вмісту для України
 * @param contentRatingUs Рейтинг вмісту для США
 * @param imdbRating Рейтинг IMDB
 * @param imdbVotes Кількість голосів IMDB
 * @param metacritic Рейтинг Metacritic
 * @param isAnime Чи є шоу аніме
 * @param seasonInfo Інформація про сезони/епізоди
 * @returns Підготовлені дані для створення шоу
 *
 * @example
 * const showData = prepareShowData(
 *   tmdbShowData,
 *   ukTranslation,
 *   mergedProviders,
 *   contentRatingUa,
 *   contentRatingUs,
 *   imdbRating,
 *   imdbVotes,
 *   metacritic,
 *   isAnime,
 *   seasonInfo
 * );
 */
export function prepareShowData(
  tmdbShowData: TMDBShowDetails,
  ukTranslation: TMDBShowTranslation | null,
  _providers: WatchProvider[],
  contentRatingUa: string | null,
  _contentRatingUs: string | null,
  imdbRating: number | null,
  imdbVotes: number | null,
  metacritic: number | null,
  _isAnime: boolean,
  seasonInfo: ReturnType<typeof extractSeasonEpisode>,
  trendingScore: number | null,
  delta3mVal: number | null,
  watchersDelta: number | null,
  ratingTrakt: number | null
): NewShow {
  return {
    tmdbId: tmdbShowData.id,
    title: tmdbShowData.name || 'Unknown',
    titleUk: ukTranslation?.titleUk || null,
    overview: tmdbShowData.overview || null,
    overviewUk: ukTranslation?.overviewUk || null,
    poster: tmdbShowData.poster_path || null,
    posterUk: ukTranslation?.posterUk || null,
    backdrop: tmdbShowData.backdrop_path || null,
    ratingTmdb: typeof tmdbShowData.vote_average === 'number' ? tmdbShowData.vote_average : null,
    ratingTmdbCount: typeof tmdbShowData.vote_count === 'number' ? tmdbShowData.vote_count : null,
    popularityTmdb: typeof tmdbShowData.popularity === 'number' ? tmdbShowData.popularity : null,
    ratingImdb: imdbRating,
    imdbVotes: imdbVotes,
    ratingMetacritic: metacritic,
    firstAirDate: tmdbShowData.first_air_date || null,
    status: tmdbShowData.status || null,
    tagline: tmdbShowData.tagline || null,
    numberOfSeasons: tmdbShowData.number_of_seasons || null,
    numberOfEpisodes: tmdbShowData.number_of_episodes || null,
    latestSeasonNumber: seasonInfo.latestSeasonNumber,
    latestSeasonEpisodes: seasonInfo.latestSeasonEpisodes,
    lastEpisodeSeason: seasonInfo.lastEpisodeSeason,
    lastEpisodeNumber: seasonInfo.lastEpisodeNumber,
    lastEpisodeAirDate: seasonInfo.lastEpisodeAirDate,
    nextEpisodeSeason: seasonInfo.nextEpisodeSeason,
    nextEpisodeNumber: seasonInfo.nextEpisodeNumber,
    nextEpisodeAirDate: seasonInfo.nextEpisodeAirDate,
    contentRating: contentRatingUa,
    trendingScore,
    delta3m: delta3mVal,
    watchersDelta,
    ratingTrakt,
    trendingUpdatedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Підготовлює мінімальні дані для пов'язаного шоу.
 *
 * @param relDetails Деталі пов'язаного шоу
 * @param relUk Переклад пов'язаного шоу
 * @param relProviders Провайдери пов'язаного шоу
 * @param relImdbRating Рейтинг IMDB пов'язаного шоу
 * @param relImdbVotes Кількість голосів IMDB
 * @param relMetacritic Рейтинг Metacritic
 * @returns Підготовлені дані для створення пов'язаного шоу
 *
 * @example
 * const relatedData = prepareRelatedShowData(
 *   relDetails,
 *   relUk,
 *   relProviders,
 *   relImdbRating,
 *   relImdbVotes,
 *   relMetacritic
 * );
 */
export function prepareRelatedShowData(
  relDetails: TMDBShowDetails,
  relUk: TMDBShowTranslation,
  _relProviders: WatchProvider[], // Не використовується - пов'язані шоу не потребують провайдерів
  relImdbRating: number | null,
  relImdbVotes: number | null,
  relMetacritic: number | null
): NewShow {
  // Обчислюємо первинний рейтинг але не використовуємо - зберігаємо для майбутнього використання
  const _relPrimaryRating =
    (typeof relDetails?.vote_average === 'number' ? Number(relDetails.vote_average) : null) ??
    relImdbRating ??
    null;

  return {
    tmdbId: relDetails.id,
    title: relDetails?.name || 'Unknown',
    titleUk: relUk?.titleUk || null,
    overview: relDetails?.overview || null,
    overviewUk: relUk?.overviewUk || null,
    poster: relDetails?.poster_path || null,
    posterUk: relUk?.posterUk || null,
    backdrop: relDetails?.backdrop_path || null,
    ratingTmdb: typeof relDetails?.vote_average === 'number' ? relDetails.vote_average : null,
    ratingTmdbCount: typeof relDetails?.vote_count === 'number' ? relDetails.vote_count : null,
    popularityTmdb: typeof relDetails?.popularity === 'number' ? relDetails.popularity : null,
    ratingImdb: relImdbRating,
    imdbVotes: relImdbVotes,
    ratingMetacritic: relMetacritic,
    firstAirDate: relDetails?.first_air_date || null,
    status: relDetails?.status || null,
    tagline: relDetails?.tagline || null,
    numberOfSeasons: relDetails?.number_of_seasons || null,
    numberOfEpisodes: relDetails?.number_of_episodes || null,
    latestSeasonNumber: null,
    latestSeasonEpisodes: null,
    lastEpisodeSeason: null,
    lastEpisodeNumber: null,
    lastEpisodeAirDate: null,
    nextEpisodeSeason: null,
    nextEpisodeNumber: null,
    nextEpisodeAirDate: null,
    contentRating: null,
  };
}
