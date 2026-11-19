import type { TrendingMedia } from '@/entities/media';
import { catalogApi, type CatalogCache, type HomeItem } from '@/shared/api';
import {
  toEpisodeRelease,
  toUpcomingRelease,
  UPCOMING_COUNT,
  type EpisodeRelease,
  type Loaded,
  type UpcomingRelease,
} from '../model/home-feed';
import { loadReleaseList, loadTrendingList } from './home-rails';

const HOME_CACHE: CatalogCache = { revalidateSeconds: 60 };
const NEW_EPISODE_DAYS = 7;
const NEW_EPISODE_COUNT = 15;

export interface TrendingLists {
  shows: TrendingMedia[];
  movies: TrendingMedia[];
}

export interface HomeFeed {
  hero: Promise<Loaded<HomeItem[]>>;
  trending: Promise<Loaded<TrendingLists>>;
  newEpisodes: Promise<Loaded<EpisodeRelease[]>>;
  nowPlaying: Promise<Loaded<TrendingMedia[]>>;
  newOnDigital: Promise<Loaded<TrendingMedia[]>>;
  upcoming: Promise<Loaded<UpcomingRelease[]>>;
}

async function settle<T>(section: string, load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    console.error(`[home] ${section} failed to load`, error);
    return { ok: false };
  }
}

async function loadTrendingLists(): Promise<TrendingLists> {
  const [shows, movies] = await Promise.all([
    loadTrendingList('show', HOME_CACHE),
    loadTrendingList('movie', HOME_CACHE),
  ]);
  return { shows, movies };
}

async function loadEpisodeReleases(): Promise<EpisodeRelease[]> {
  const episodes = await catalogApi.getNewEpisodes(NEW_EPISODE_DAYS, NEW_EPISODE_COUNT, HOME_CACHE);
  return episodes.map(toEpisodeRelease);
}

async function loadUpcomingReleases(): Promise<UpcomingRelease[]> {
  const movies = await catalogApi.getUpcomingMovies(UPCOMING_COUNT, HOME_CACHE);
  return movies.map(toUpcomingRelease);
}

export function startHomeFeed(): HomeFeed {
  return {
    hero: settle('hero', () => catalogApi.getHomeHero(HOME_CACHE)),
    trending: settle('trending', loadTrendingLists),
    newEpisodes: settle('new episodes', loadEpisodeReleases),
    nowPlaying: settle('now playing', () => loadReleaseList('nowPlaying', HOME_CACHE)),
    newOnDigital: settle('new on digital', () => loadReleaseList('newOnDigital', HOME_CACHE)),
    upcoming: settle('upcoming', loadUpcomingReleases),
  };
}

export function feedSections(feed: HomeFeed): Array<Promise<Loaded<unknown>>> {
  return [feed.hero, feed.trending, feed.newEpisodes, feed.nowPlaying, feed.newOnDigital];
}
