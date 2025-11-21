import { db } from '@/db';
import { movies } from '@/db/schema';
import { eq, or, isNull } from 'drizzle-orm';
import { tmdbClient } from '@/lib/api/tmdb';
import { withRetry } from '@/lib/sync/utils';
import type {
  BackfillMoviesMetaStats,
  TMDBVideo,
  WatchProvider,
  TMDBMovieDetails,
} from '@/lib/types';

type MovieMetaRow = {
  id: number;
  tmdbId: number;
  backdrop: string | null;
  genres: Array<{ id: number; name: string }> | null;
  videos: TMDBVideo[] | null;
  releaseDate: string | null;
  runtime: number | null;
  status: string | null;
  tagline: string | null;
  watchProviders: WatchProvider[] | null;
};

const isEmpty = <T>(arr: T[] | null | undefined): boolean =>
  !Array.isArray(arr) || arr.length === 0;

async function selectPreferredVideos(tmdbId: number): Promise<TMDBVideo[]> {
  const videosResponse = await withRetry(() => tmdbClient.getMovieVideos(tmdbId));
  const allVideos: TMDBVideo[] = Array.isArray(videosResponse?.results)
    ? (videosResponse.results as TMDBVideo[])
    : [];
  const youtubeVideos = allVideos.filter((video) => video.site === 'YouTube');
  const filtered = youtubeVideos.filter((video) =>
    ['Trailer', 'Teaser', 'Clip', 'Featurette'].includes(String(video.type || ''))
  );
  return filtered.length ? filtered : youtubeVideos;
}

async function getProvidersWithFallback(tmdbId: number): Promise<WatchProvider[]> {
  const providersUa = await withRetry(() =>
    tmdbClient.getMovieWatchProvidersByRegion(tmdbId, 'UA')
  );
  const providersUs = await withRetry(() =>
    tmdbClient.getMovieWatchProvidersByRegion(tmdbId, 'US')
  );
  const providersMap = new Map<string, WatchProvider>();
  for (const provider of [...(providersUa || []), ...(providersUs || [])]) {
    const key = `${provider.region}:${provider.id}`;
    if (!providersMap.has(key)) providersMap.set(key, provider);
  }
  const providersCombined = Array.from(providersMap.values());
  if (providersCombined.length) return providersCombined;
  return withRetry(() => tmdbClient.getMovieWatchProvidersAny(tmdbId));
}

function updateCounters(
  stats: BackfillMoviesMetaStats,
  row: MovieMetaRow,
  details: TMDBMovieDetails,
  videosPreferred: TMDBVideo[],
  providersFinal: WatchProvider[]
) {
  if (isEmpty(row.videos)) {
    if (videosPreferred.length) stats.videosFilled++;
    else stats.videosStillMissing++;
  }
  if (isEmpty(row.watchProviders)) {
    if ((providersFinal || []).length) stats.providersFilled++;
    else stats.providersStillMissing++;
  }
  if (row.backdrop == null && details.backdrop_path) stats.backdropFilled++;
  if ((row.genres ?? []).length === 0 && Array.isArray(details.genres) && details.genres.length)
    stats.genresFilled++;
  if (row.releaseDate == null && details.release_date) stats.releaseDateFilled++;
  if (row.runtime == null && typeof details.runtime === 'number') stats.runtimeFilled++;
  if (row.status == null && details.status) stats.statusFilled++;
  if (row.tagline == null && details.tagline) stats.taglineFilled++;
}

export async function runMovieMetaBackfill(): Promise<{
  updated: number;
  stats: BackfillMoviesMetaStats;
}> {
  let updated = 0;
  const stats: BackfillMoviesMetaStats = {
    processed: 0,
    updatedRows: 0,
    videosFilled: 0,
    videosStillMissing: 0,
    providersFilled: 0,
    providersStillMissing: 0,
    backdropFilled: 0,
    genresFilled: 0,
    releaseDateFilled: 0,
    runtimeFilled: 0,
    statusFilled: 0,
    taglineFilled: 0,
    errors: 0,
  };
  const rows = (await db
    .select({
      id: movies.id,
      tmdbId: movies.tmdbId,
      backdrop: movies.backdrop,
      genres: movies.genres,
      videos: movies.videos,
      releaseDate: movies.releaseDate,
      runtime: movies.runtime,
      status: movies.status,
      tagline: movies.tagline,
      watchProviders: movies.watchProviders,
    })
    .from(movies)
    .where(
      or(
        isNull(movies.backdrop),
        isNull(movies.genres),
        isNull(movies.videos),
        isNull(movies.releaseDate),
        isNull(movies.runtime),
        isNull(movies.status)
      )
    )
    .limit(50)) as MovieMetaRow[];
  for (const movieRow of rows) {
    stats.processed++;
    try {
      const details: TMDBMovieDetails = await withRetry(() =>
        tmdbClient.getMovieDetails(movieRow.tmdbId)
      );
      const videosPreferred = await selectPreferredVideos(movieRow.tmdbId);
      const providersFinal = await getProvidersWithFallback(movieRow.tmdbId);
      await db
        .update(movies)
        .set({
          backdrop: details.backdrop_path ?? movieRow.backdrop ?? null,
          genres: Array.isArray(details.genres) ? details.genres : (movieRow.genres ?? []),
          videos: videosPreferred.length ? videosPreferred : (movieRow.videos ?? []),
          releaseDate: details.release_date ?? movieRow.releaseDate ?? null,
          runtime:
            (typeof details.runtime === 'number' ? details.runtime : null) ??
            movieRow.runtime ??
            null,
          status: details.status ?? movieRow.status ?? null,
          tagline: details.tagline ?? movieRow.tagline ?? null,
          watchProviders: providersFinal ?? movieRow.watchProviders ?? null,
          updatedAt: new Date(),
        })
        .where(eq(movies.id, movieRow.id));
      updated++;
      stats.updatedRows++;
      updateCounters(stats, movieRow, details, videosPreferred, providersFinal);
    } catch {
      stats.errors++;
    }
  }
  return { updated, stats };
}
