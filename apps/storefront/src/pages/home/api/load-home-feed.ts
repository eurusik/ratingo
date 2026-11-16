import { fromTrendingMovie, fromTrendingShow, type TrendingMedia } from '@/entities/media';
import { catalogApi, type CatalogCache, type HomeItem } from '@/shared/api';
import {
  TOP_TEN_COUNT,
  toEpisodeRelease,
  type EpisodeRelease,
  type Loaded,
} from '../model/home-feed';

const HOME_CACHE: CatalogCache = { revalidateSeconds: 60 };
const NEW_EPISODE_DAYS = 7;
const NEW_EPISODE_COUNT = 15;
const MOVIE_RAIL_COUNT = 12;

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
    catalogApi.getTrendingShows(TOP_TEN_COUNT, HOME_CACHE),
    catalogApi.getTrendingMovies(TOP_TEN_COUNT, HOME_CACHE),
  ]);
  return { shows: shows.map(fromTrendingShow), movies: movies.map(fromTrendingMovie) };
}

async function loadEpisodeReleases(): Promise<EpisodeRelease[]> {
  const episodes = await catalogApi.getNewEpisodes(NEW_EPISODE_DAYS, NEW_EPISODE_COUNT, HOME_CACHE);
  return episodes.map(toEpisodeRelease);
}

async function loadNowPlaying(): Promise<TrendingMedia[]> {
  const movies = await catalogApi.getNowPlayingMovies(MOVIE_RAIL_COUNT, HOME_CACHE);
  return movies.map(fromTrendingMovie);
}

async function loadNewOnDigital(): Promise<TrendingMedia[]> {
  const movies = await catalogApi.getNewOnDigitalMovies(MOVIE_RAIL_COUNT, HOME_CACHE);
  return movies.map(fromTrendingMovie);
}

export function startHomeFeed(): HomeFeed {
  return {
    hero: settle('hero', () => catalogApi.getHomeHero(HOME_CACHE)),
    trending: settle('trending', loadTrendingLists),
    newEpisodes: settle('new episodes', loadEpisodeReleases),
    nowPlaying: settle('now playing', loadNowPlaying),
    newOnDigital: settle('new on digital', loadNewOnDigital),
  };
}

export function feedSections(feed: HomeFeed): Array<Promise<Loaded<unknown>>> {
  return [feed.hero, feed.trending, feed.newEpisodes, feed.nowPlaying, feed.newOnDigital];
}
