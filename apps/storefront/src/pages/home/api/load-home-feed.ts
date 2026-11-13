import { cache } from 'react';
import { fromTrendingMovie, fromTrendingShow, type TrendingMedia } from '@/entities/media';
import { catalogApi, type CatalogCache, type HomeItem } from '@/shared/api';
import { TOP_TEN_COUNT, toEpisodeRelease, type EpisodeRelease } from '../model/home-feed';

const HOME_CACHE: CatalogCache = { revalidateSeconds: 60 };
const NEW_EPISODE_DAYS = 7;
const NEW_EPISODE_COUNT = 15;
const MOVIE_RAIL_COUNT = 12;

type Loaded<T> = { ok: true; data: T } | { ok: false };

interface TrendingLists {
  shows: TrendingMedia[];
  movies: TrendingMedia[];
}

async function settle<T>(section: string, load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    console.error(`[home] ${section} failed to load`, error);
    return { ok: false };
  }
}

export const loadHero = cache((): Promise<Loaded<HomeItem[]>> =>
  settle('hero', () => catalogApi.getHomeHero(HOME_CACHE)),
);

export const loadWatchingNow = cache((): Promise<Loaded<HomeItem[]>> =>
  settle('watching now', () => catalogApi.getWatchingNow(HOME_CACHE)),
);

export const loadTrending = cache((): Promise<Loaded<TrendingLists>> =>
  settle('trending', async () => {
    const [shows, movies] = await Promise.all([
      catalogApi.getTrendingShows(TOP_TEN_COUNT, HOME_CACHE),
      catalogApi.getTrendingMovies(TOP_TEN_COUNT, HOME_CACHE),
    ]);
    return { shows: shows.map(fromTrendingShow), movies: movies.map(fromTrendingMovie) };
  }),
);

export const loadNewEpisodes = cache((): Promise<Loaded<EpisodeRelease[]>> =>
  settle('new episodes', async () => {
    const episodes = await catalogApi.getNewEpisodes(
      NEW_EPISODE_DAYS,
      NEW_EPISODE_COUNT,
      HOME_CACHE,
    );
    return episodes.map(toEpisodeRelease);
  }),
);

export const loadNowPlaying = cache((): Promise<Loaded<TrendingMedia[]>> =>
  settle('now playing', async () =>
    (await catalogApi.getNowPlayingMovies(MOVIE_RAIL_COUNT, HOME_CACHE)).map(fromTrendingMovie),
  ),
);

export const loadNewOnDigital = cache((): Promise<Loaded<TrendingMedia[]>> =>
  settle('new on digital', async () =>
    (await catalogApi.getNewOnDigitalMovies(MOVIE_RAIL_COUNT, HOME_CACHE)).map(fromTrendingMovie),
  ),
);

export function preloadHomeFeed(): void {
  void loadHero();
  void loadWatchingNow();
  void loadTrending();
  void loadNewEpisodes();
  void loadNowPlaying();
  void loadNewOnDigital();
}
