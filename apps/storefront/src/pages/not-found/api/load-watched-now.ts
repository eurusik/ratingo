import { fromTrendingMovie, fromTrendingShow, toGridMedia, type GridMedia } from '@/entities/media';
import { catalogApi, type CatalogCache } from '@/shared/api';
import { interleave } from '@/shared/lib';

const TRENDING_LIST_SIZE = 10;
const TRENDING_CACHE: CatalogCache = { revalidateSeconds: 60 };
const WATCHED_NOW_COUNT = 6;

export async function loadWatchedNow(): Promise<GridMedia[]> {
  try {
    const [shows, movies] = await Promise.all([
      catalogApi.getTrendingShows(TRENDING_LIST_SIZE, TRENDING_CACHE),
      catalogApi.getTrendingMovies(TRENDING_LIST_SIZE, TRENDING_CACHE),
    ]);
    return interleave(shows.map(fromTrendingShow), movies.map(fromTrendingMovie))
      .slice(0, WATCHED_NOW_COUNT)
      .map(toGridMedia);
  } catch (error) {
    console.error('[not-found] trending titles failed to load', error);
    return [];
  }
}
