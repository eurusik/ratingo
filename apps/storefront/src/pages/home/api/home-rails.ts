import { fromTrendingMovie, fromTrendingShow, type TrendingMedia } from '@/entities/media';
import { catalogApi, type CatalogCache, type MediaType } from '@/shared/api';
import { TOP_TEN_COUNT, toReleaseRail } from '../model/home-feed';
import type { ReleaseList } from '../model/rail-start';

const MOVIE_RAIL_COUNT = 12;

export async function loadTrendingList(
  type: MediaType,
  cache?: CatalogCache,
): Promise<TrendingMedia[]> {
  if (type === 'show') {
    const shows = await catalogApi.getTrendingShows(TOP_TEN_COUNT, cache);
    return shows.map(fromTrendingShow);
  }
  const movies = await catalogApi.getTrendingMovies(TOP_TEN_COUNT, cache);
  return movies.map(fromTrendingMovie);
}

export async function loadReleaseList(
  list: ReleaseList,
  cache?: CatalogCache,
): Promise<TrendingMedia[]> {
  const movies =
    list === 'nowPlaying'
      ? await catalogApi.getNowPlayingMovies(MOVIE_RAIL_COUNT, cache)
      : await catalogApi.getNewOnDigitalMovies(MOVIE_RAIL_COUNT, cache);
  return toReleaseRail(movies.map(fromTrendingMovie));
}
