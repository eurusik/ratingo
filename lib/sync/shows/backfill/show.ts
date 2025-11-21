/**
 * Модуль бекфілу метаданих для серіалів.
 *
 * Відповідає за:
 * - Вибір серіалів із неповними даними
 * - Збір TMDB‑даних (деталі, відео, каст, провайдери, рейтинги контенту)
 * - Оновлення рядків у транзакції та нормалізацію повʼязаних записів
 * - Очищення нерелевантних `show_related` і формування нових рекомендацій
 */
import { db } from '@/db';

import { shows, showAirings, showRelated } from '@/db/schema';
import { eq, or, isNull, inArray, and, sql } from 'drizzle-orm';
import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';
import { getRelatedTmdbIds } from '@/lib/sync/related';
import { ensureRelatedShows, linkRelated } from '@/lib/sync/shows/processing';
import { upsertShowCast } from '@/lib/sync/shows/upserts';
import { createProcessShowCaches } from '@/lib/sync/shows/processing';
import type {
  BackfillShowsMetaStats,
  TMDBVideo,
  TMDBCastMember,
  WatchProvider,
  TMDBShowDetails,
  TraktTrendingShow,
} from '@/lib/types';

/**
 * Тип транзакції БД, витягнутий із сигнатури `db.transaction`.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Мінімальний набір полів серіалу, необхідний для бекфілу метаданих.
 */
export type ShowMetaRow = {
  id: number;
  tmdbId: number;
  backdrop: string | null;
  genres: Array<{ id: number; name: string }> | null;
  videos: TMDBVideo[] | null;
  cast: TMDBCastMember[] | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  latestSeasonNumber: number | null;
  latestSeasonEpisodes: number | null;
  lastEpisodeSeason: number | null;
  lastEpisodeNumber: number | null;
  lastEpisodeAirDate: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeAirDate: string | null;
  status: string | null;
  tagline: string | null;
  firstAirDate: string | null;
  watchProviders: WatchProvider[] | null;
  contentRating: string | null;
};

/**
 * Агреговані TMDB‑дані для оновлення одного шоу.
 */
export type ShowMetaBundle = {
  tmdbShowDetails: TMDBShowDetails;
  videosPreferred: TMDBVideo[];
  castPreferred: TMDBCastMember[];
  providersCombined: WatchProvider[];
  contentRatingUa: string | null;
  latestSeasonNumber: number | null;
  latestSeasonEpisodes: number | null;
  lastEpisodeSeason: number | null;
  lastEpisodeNumber: number | null;
  lastEpisodeAirDate: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeAirDate: string | null;
};

/**
 * Вибирає серіали, у яких відсутні ключові метадані.
 *
 * @param limit Максимальна кількість рядків для обробки
 * @returns Масив рядків `ShowMetaRow`
 */
export async function fetchShowsNeedingMeta(limit: number): Promise<ShowMetaRow[]> {
  const rows = (await db
    .select({
      id: shows.id,
      tmdbId: shows.tmdbId,
      backdrop: shows.backdrop,
      genres: shows.genres,
      videos: shows.videos,
      cast: shows.cast,
      numberOfSeasons: shows.numberOfSeasons,
      numberOfEpisodes: shows.numberOfEpisodes,
      latestSeasonNumber: shows.latestSeasonNumber,
      latestSeasonEpisodes: shows.latestSeasonEpisodes,
      lastEpisodeSeason: shows.lastEpisodeSeason,
      lastEpisodeNumber: shows.lastEpisodeNumber,
      lastEpisodeAirDate: shows.lastEpisodeAirDate,
      nextEpisodeSeason: shows.nextEpisodeSeason,
      nextEpisodeNumber: shows.nextEpisodeNumber,
      nextEpisodeAirDate: shows.nextEpisodeAirDate,
      status: shows.status,
      tagline: shows.tagline,
      firstAirDate: shows.firstAirDate,
      watchProviders: shows.watchProviders,
      contentRating: shows.contentRating,
    })
    .from(shows)
    .where(
      or(
        isNull(shows.backdrop),
        isNull(shows.genres),
        isNull(shows.videos),
        isNull(shows.numberOfSeasons),
        isNull(shows.latestSeasonNumber),
        isNull(shows.lastEpisodeNumber),
        isNull(shows.nextEpisodeNumber),
        isNull(shows.status),
        isNull(shows.firstAirDate)
      )
    )
    .limit(limit)) as ShowMetaRow[];
  return rows;
}

/**
 * Обирає пріоритетні YouTube‑відео для серіалу.
 * Враховуються типи: Trailer, Teaser, Clip, Featurette, Promo
 *
 * @param tmdbId TMDB ID серіалу
 * @returns Масив відео з пріоритетом
 */
export async function selectPreferredShowVideos(tmdbId: number): Promise<TMDBVideo[]> {
  const videosResponse = await withRetry(() => tmdbClient.getShowVideos(tmdbId));
  const allVideos: TMDBVideo[] = Array.isArray(videosResponse?.results)
    ? videosResponse.results
    : [];
  const youtubeVideos = allVideos.filter((video) => video.site === 'YouTube');
  const preferredTypes = ['Trailer', 'Teaser', 'Clip', 'Featurette', 'Promo'];
  const youtubePreferred = youtubeVideos.filter((video) =>
    preferredTypes.includes(String(video.type || ''))
  );
  const allPreferred = allVideos.filter((video) =>
    preferredTypes.includes(String(video.type || ''))
  );
  return youtubePreferred.length
    ? youtubePreferred
    : allPreferred.length
      ? allPreferred
      : youtubeVideos.length
        ? youtubeVideos
        : allVideos;
}

/**
 * Отримує та нормалізує каст серіалу з TMDB aggregate credits.
 * Береться до 12 ключових учасників.
 *
 * @param tmdbId TMDB ID серіалу
 * @returns Масив `TMDBCastMember`
 */
export async function getPreferredShowCast(tmdbId: number): Promise<TMDBCastMember[]> {
  try {
    const credits = await withRetry(() => tmdbClient.getAggregateCredits(tmdbId));
    const entries: any[] = Array.isArray(credits?.cast) ? credits.cast : [];
    const top = entries.slice(0, 12);
    return top.map((entry: any) => {
      const roleList: any[] = Array.isArray(entry.roles) ? entry.roles : [];
      const primaryCharacter: string | null =
        roleList.map((r: any) => r.character || r.job).filter(Boolean)[0] ||
        entry.character ||
        null;
      const profilePath: string | null = entry.profile_path || null;
      const orderIndex: number | null = typeof entry.order === 'number' ? entry.order : null;
      return {
        id: entry.id,
        name: entry.name,
        character: primaryCharacter,
        profile_path: profilePath,
        order: orderIndex,
      } as TMDBCastMember;
    });
  } catch {
    return [];
  }
}

/**
 * Обʼєднує провайдерів перегляду для регіонів UA та US без дублювань.
 *
 * @param tmdbId TMDB ID серіалу
 * @returns Масив провайдерів перегляду
 */
export async function getCombinedShowProviders(tmdbId: number): Promise<WatchProvider[]> {
  const providersUa = await withRetry(() => tmdbClient.getWatchProvidersByRegion(tmdbId, 'UA'));
  const providersUs = await withRetry(() => tmdbClient.getWatchProvidersByRegion(tmdbId, 'US'));
  const providersMap = new Map<string, WatchProvider>();
  for (const provider of [...(providersUa || []), ...(providersUs || [])]) {
    const key = `${provider.region}:${provider.id}`;
    if (!providersMap.has(key)) providersMap.set(key, provider);
  }
  return Array.from(providersMap.values());
}

/**
 * Обчислює номер та кількість епізодів останнього сезону.
 * Ігнорує спеціальні сезони з номером 0.
 *
 * @param details Деталі серіалу з TMDB
 * @returns Номер і кількість епізодів останнього сезону
 */
export function computeLatestSeason(details: TMDBShowDetails): {
  latestSeasonNumber: number | null;
  latestSeasonEpisodes: number | null;
} {
  const seasons = Array.isArray(details.seasons) ? details.seasons : [];
  if (seasons.length === 0) return { latestSeasonNumber: null, latestSeasonEpisodes: null };
  const seasonsSorted = seasons
    .filter((season) => typeof season.season_number === 'number')
    .sort((a, b) => (b.season_number ?? 0) - (a.season_number ?? 0));
  const latestSeason =
    seasonsSorted.find((season) => season.season_number !== 0) || seasonsSorted[0];
  const latestSeasonNumber =
    typeof latestSeason?.season_number === 'number' ? latestSeason.season_number : null;
  const latestSeasonEpisodes =
    typeof latestSeason?.episode_count === 'number' ? latestSeason.episode_count : null;
  return { latestSeasonNumber, latestSeasonEpisodes };
}

/**
 * Дістає інформацію про останній та наступний епізоди.
 *
 * @param details Деталі серіалу з TMDB
 * @returns Дані про останній і наступний епізоди (сезон/номер/дата)
 */
export function extractEpisodeAirInfo(details: TMDBShowDetails): {
  lastEpisodeSeason: number | null;
  lastEpisodeNumber: number | null;
  lastEpisodeAirDate: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeAirDate: string | null;
} {
  return {
    lastEpisodeSeason: details.last_episode_to_air?.season_number ?? null,
    lastEpisodeNumber: details.last_episode_to_air?.episode_number ?? null,
    lastEpisodeAirDate: details.last_episode_to_air?.air_date ?? null,
    nextEpisodeSeason: details.next_episode_to_air?.season_number ?? null,
    nextEpisodeNumber: details.next_episode_to_air?.episode_number ?? null,
    nextEpisodeAirDate: details.next_episode_to_air?.air_date ?? null,
  };
}

/**
 * Очищає нерелевантні записи `show_related` для шоу.
 * Вилучає звʼязки із забороненими жанрами та без перетину жанрів із базовим шоу.
 *
 * @param tx Транзакція бази даних
 * @param showId Внутрішній ID шоу
 * @param tmdbId TMDB ID шоу
 */
export async function cleanupExistingRelatedLinks(
  tx: Tx,
  showId: number,
  tmdbId: number
): Promise<void> {
  const baseGenres = await withRetry(() => tmdbClient.getShowGenres(tmdbId));
  try {
    const existingRelatedRows: Array<{ relatedShowId: number }> = await tx
      .select({ relatedShowId: showRelated.relatedShowId })
      .from(showRelated)
      .where(eq(showRelated.showId, showId));
    const relatedIds = existingRelatedRows
      .map((row) => Number(row.relatedShowId))
      .filter((value) => Number.isFinite(value));
    if (relatedIds.length) {
      const relatedShowRows: Array<{ id: number; tmdbId: number }> = await tx
        .select({ id: shows.id, tmdbId: shows.tmdbId })
        .from(shows)
        .where(inArray(shows.id, relatedIds));
      const bannedGenreIds = new Set<number>([16, 99, 10764, 10767, 10763, 10766]);
      for (const relatedRow of relatedShowRows) {
        const relatedId = Number(relatedRow.id);
        const relatedTmdbId = Number(relatedRow.tmdbId);
        if (!Number.isFinite(relatedId) || !Number.isFinite(relatedTmdbId)) continue;
        const relatedGenres = await withRetry(() => tmdbClient.getShowGenres(relatedTmdbId));
        const hasBanned = relatedGenres.some((genreId: number) => bannedGenreIds.has(genreId));
        const overlaps =
          Array.isArray(baseGenres) && baseGenres.length > 0
            ? relatedGenres.some((genreId: number) => baseGenres.includes(genreId))
            : true;
        if (hasBanned || !overlaps) {
          await tx
            .delete(showRelated)
            .where(and(eq(showRelated.showId, showId), eq(showRelated.relatedShowId, relatedId)));
        }
      }
    }
  } catch {}
}

/**
 * Визначає Trakt slug/id для шоу з `show_airings` або через пошук по TMDB.
 *
 * @param tx Транзакція бази даних
 * @param tmdbId TMDB ID шоу
 * @returns Trakt slug або числовий trakt id; фолбек — `tmdbId`
 */
export async function resolveTraktIdentifier(tx: Tx, tmdbId: number): Promise<string | number> {
  const airingRows = await tx
    .select({ traktId: showAirings.traktId })
    .from(showAirings)
    .where(eq(showAirings.tmdbId, tmdbId))
    .limit(1);
  let traktSlugOrId: string | number | null = airingRows[0]?.traktId ?? null;
  if (!traktSlugOrId) {
    try {
      const traktLookup: TraktTrendingShow | null = await withRetry(() =>
        traktClient.findShowByTmdbId(tmdbId)
      );
      traktSlugOrId = traktLookup?.show?.ids?.slug || traktLookup?.show?.ids?.trakt || null;
    } catch {}
  }
  return traktSlugOrId ?? tmdbId;
}

/**
 * Будує агрегований набір TMDB‑даних для одного шоу.
 *
 * @param tmdbId TMDB ID серіалу
 * @returns `ShowMetaBundle` з деталями, відео, кастом, провайдерами, рейтингом контенту і даними епізодів
 */
export async function buildShowMetaBundle(tmdbId: number): Promise<ShowMetaBundle> {
  const tmdbShowDetails: TMDBShowDetails = await withRetry(() => tmdbClient.getShowDetails(tmdbId));
  const videosPreferred: TMDBVideo[] = await selectPreferredShowVideos(tmdbId);
  const castPreferred: TMDBCastMember[] = await getPreferredShowCast(tmdbId);
  const providersCombined: WatchProvider[] = await getCombinedShowProviders(tmdbId);
  const contentRatingUa: string | null = await withRetry(() =>
    tmdbClient.getContentRatingByRegion(tmdbId, 'UA')
  );
  const { latestSeasonNumber, latestSeasonEpisodes } = computeLatestSeason(tmdbShowDetails);
  const {
    lastEpisodeSeason,
    lastEpisodeNumber,
    lastEpisodeAirDate,
    nextEpisodeSeason,
    nextEpisodeNumber,
    nextEpisodeAirDate,
  } = extractEpisodeAirInfo(tmdbShowDetails);
  return {
    tmdbShowDetails,
    videosPreferred,
    castPreferred,
    providersCombined,
    contentRatingUa,
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
 * Атомарно застосовує оновлення метаданих шоу у транзакції.
 * Також оновлює каст, очищає нерелевантні `show_related` та лінкує нові рекомендації.
 *
 * @param tx Транзакція бази даних
 * @param showRow Рядок шоу для оновлення
 * @param b Агреговані TMDB‑дані для оновлення
 */
export async function applyShowMetaUpdate(
  tx: Tx,
  showRow: ShowMetaRow,
  b: ShowMetaBundle
): Promise<void> {
  await tx
    .update(shows)
    .set({
      backdrop: b.tmdbShowDetails.backdrop_path ?? showRow.backdrop ?? null,
      genres: Array.isArray(b.tmdbShowDetails.genres)
        ? b.tmdbShowDetails.genres
        : (showRow.genres ?? []),
      videos: b.videosPreferred.length ? b.videosPreferred : (showRow.videos ?? []),
      cast: b.castPreferred.length ? b.castPreferred : (showRow.cast ?? []),
      firstAirDate: b.tmdbShowDetails.first_air_date ?? showRow.firstAirDate ?? null,
      numberOfSeasons:
        (typeof b.tmdbShowDetails.number_of_seasons === 'number'
          ? b.tmdbShowDetails.number_of_seasons
          : null) ??
        showRow.numberOfSeasons ??
        null,
      numberOfEpisodes:
        (typeof b.tmdbShowDetails.number_of_episodes === 'number'
          ? b.tmdbShowDetails.number_of_episodes
          : null) ??
        showRow.numberOfEpisodes ??
        null,
      latestSeasonNumber: b.latestSeasonNumber ?? showRow.latestSeasonNumber ?? null,
      latestSeasonEpisodes: b.latestSeasonEpisodes ?? showRow.latestSeasonEpisodes ?? null,
      lastEpisodeSeason: b.lastEpisodeSeason ?? showRow.lastEpisodeSeason ?? null,
      lastEpisodeNumber: b.lastEpisodeNumber ?? showRow.lastEpisodeNumber ?? null,
      lastEpisodeAirDate: b.lastEpisodeAirDate ?? showRow.lastEpisodeAirDate ?? null,
      nextEpisodeSeason: b.nextEpisodeSeason ?? showRow.nextEpisodeSeason ?? null,
      nextEpisodeNumber: b.nextEpisodeNumber ?? showRow.nextEpisodeNumber ?? null,
      nextEpisodeAirDate: b.nextEpisodeAirDate ?? showRow.nextEpisodeAirDate ?? null,
      status: b.tmdbShowDetails.status ?? showRow.status ?? null,
      tagline: b.tmdbShowDetails.tagline ?? showRow.tagline ?? null,
      contentRating: b.contentRatingUa ?? showRow.contentRating ?? null,
      watchProviders: b.providersCombined ?? showRow.watchProviders ?? null,
      updatedAt: new Date(),
    })
    .where(eq(shows.id, showRow.id));
  if (b.castPreferred.length) await upsertShowCast(tx, showRow.id, b.castPreferred);
  await cleanupExistingRelatedLinks(tx, showRow.id, showRow.tmdbId);
  const traktSlugOrId = await resolveTraktIdentifier(tx, showRow.tmdbId);
  const { ids: relatedTmdbIds, source: relatedSource } = await getRelatedTmdbIds(
    showRow.tmdbId,
    traktSlugOrId
  );
  if (relatedTmdbIds.length > 0) {
    // Створюємо мінімальний контекст для ensureRelatedShows
    const caches = createProcessShowCaches();
    const ctx = {
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      maxWatchers: 10000,
      animeKeywords: ['anime', 'аніме'],
      tmdbDetailsCache: caches.tmdbDetailsCache,
      tmdbTranslationCache: caches.tmdbTranslationCache,
      tmdbProvidersCache: caches.tmdbProvidersCache,
      tmdbContentRatingCache: caches.tmdbContentRatingCache,
      tmdbExternalIdsCache: caches.tmdbExternalIdsCache,
      currentTrendingTmdbIds: new Set<number>(),
      onRetryLabel: (label: string) => (attempt: number, err: any) => {
        console.warn(`Retry ${attempt} for ${label}:`, err.message);
      },
    };
    await ensureRelatedShows(tx, relatedTmdbIds, ctx);
    await linkRelated(tx, showRow.id, relatedTmdbIds, relatedSource);
  }
}

/**
 * Оновлює статистику виконання бекфілу для одного шоу.
 *
 * @param stats Акумулятор статистики
 * @param showRow Рядок шоу до оновлення
 * @param b Агрегований набір TMDB‑даних
 */
export function updateShowCounters(
  stats: BackfillShowsMetaStats,
  showRow: ShowMetaRow,
  b: ShowMetaBundle
): void {
  if (showRow.backdrop == null && b.tmdbShowDetails.backdrop_path) stats.backdropFilled++;
  if (
    (showRow.genres ?? []).length === 0 &&
    Array.isArray(b.tmdbShowDetails.genres) &&
    b.tmdbShowDetails.genres.length
  )
    stats.genresFilled++;
  if (showRow.firstAirDate == null && b.tmdbShowDetails.first_air_date) stats.firstAirDateFilled++;
  if (showRow.numberOfSeasons == null && typeof b.tmdbShowDetails.number_of_seasons === 'number')
    stats.numberOfSeasonsFilled++;
  if (showRow.numberOfEpisodes == null && typeof b.tmdbShowDetails.number_of_episodes === 'number')
    stats.numberOfEpisodesFilled++;
  if (showRow.status == null && b.tmdbShowDetails.status) stats.statusFilled++;
  if (showRow.tagline == null && b.tmdbShowDetails.tagline) stats.taglineFilled++;
  if (showRow.contentRating == null && b.contentRatingUa) stats.contentRatingFilled++;
  const isEmptyVideos = !Array.isArray(showRow.videos) || showRow.videos.length === 0;
  if (isEmptyVideos) {
    if (b.videosPreferred.length) stats.videosFilled++;
    else stats.videosStillMissing++;
  }
  const isEmptyProviders =
    !Array.isArray(showRow.watchProviders) || showRow.watchProviders.length === 0;
  if (isEmptyProviders) {
    if ((b.providersCombined || []).length) stats.providersFilled++;
    else stats.providersStillMissing++;
  }
}

/**
 * Масовий бекфіл метаданих для серіалів.
 *
 * @returns Обʼєкт із кількістю оновлень і статистикою по категоріях
 */
export async function runMetaBackfill(): Promise<{
  updated: number;
  stats: BackfillShowsMetaStats;
}> {
  let updated = 0;
  const stats: BackfillShowsMetaStats = {
    processed: 0,
    updatedRows: 0,
    videosFilled: 0,
    videosStillMissing: 0,
    providersFilled: 0,
    providersStillMissing: 0,
    backdropFilled: 0,
    genresFilled: 0,
    firstAirDateFilled: 0,
    numberOfSeasonsFilled: 0,
    numberOfEpisodesFilled: 0,
    statusFilled: 0,
    taglineFilled: 0,
    contentRatingFilled: 0,
    errors: 0,
  };
  const rows = await fetchShowsNeedingMeta(50);
  for (const showRow of rows) {
    stats.processed++;
    try {
      const bundle = await buildShowMetaBundle(showRow.tmdbId);
      await db.transaction(async (tx: Tx) => {
        await applyShowMetaUpdate(tx, showRow, bundle);
      });
      updated++;
      stats.updatedRows++;
      updateShowCounters(stats, showRow, bundle);
    } catch {
      stats.errors++;
    }
  }
  return { updated, stats };
}

/**
 * Бекфіл метаданих серіалу за конкретним `showId`.
 *
 * @param showId Внутрішній ID шоу
 * @returns Обʼєкт із кількістю оновлень і статистикою по категоріях
 */
export async function backfillShowMetaById(
  showId: number
): Promise<{ updated: number; stats: BackfillShowsMetaStats }> {
  let updated = 0;
  const stats: BackfillShowsMetaStats = {
    processed: 0,
    updatedRows: 0,
    videosFilled: 0,
    videosStillMissing: 0,
    providersFilled: 0,
    providersStillMissing: 0,
    backdropFilled: 0,
    genresFilled: 0,
    firstAirDateFilled: 0,
    numberOfSeasonsFilled: 0,
    numberOfEpisodesFilled: 0,
    statusFilled: 0,
    taglineFilled: 0,
    contentRatingFilled: 0,
    errors: 0,
  };
  try {
    await db.execute(sql`SELECT 1`);
    console.log('Database connection successful');
    const showRows = (await db
      .select({
        id: shows.id,
        tmdbId: shows.tmdbId,
        backdrop: shows.backdrop,
        genres: shows.genres,
        videos: shows.videos,
        cast: shows.cast,
        numberOfSeasons: shows.numberOfSeasons,
        numberOfEpisodes: shows.numberOfEpisodes,
        latestSeasonNumber: shows.latestSeasonNumber,
        latestSeasonEpisodes: shows.latestSeasonEpisodes,
        lastEpisodeSeason: shows.lastEpisodeSeason,
        lastEpisodeNumber: shows.lastEpisodeNumber,
        lastEpisodeAirDate: shows.lastEpisodeAirDate,
        nextEpisodeSeason: shows.nextEpisodeSeason,
        nextEpisodeNumber: shows.nextEpisodeNumber,
        nextEpisodeAirDate: shows.nextEpisodeAirDate,
        status: shows.status,
        tagline: shows.tagline,
        firstAirDate: shows.firstAirDate,
        watchProviders: shows.watchProviders,
        contentRating: shows.contentRating,
      })
      .from(shows)
      .where(eq(shows.id, showId))
      .limit(1)) as ShowMetaRow[];
    const showRow = showRows[0];
    if (!showRow) return { updated, stats };
    stats.processed = 1;
    const bundle = await buildShowMetaBundle(showRow.tmdbId);
    await db.transaction(async (tx: Tx) => {
      await applyShowMetaUpdate(tx, showRow, bundle);
    });
    updated = 1;
    stats.updatedRows = 1;
    updateShowCounters(stats, showRow, bundle);
  } catch (e) {
    console.error('Backfill failed for show', showId, e);
    stats.errors++;
  }
  return { updated, stats };
}
