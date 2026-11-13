import { fromHomeItem, type TrendingMedia } from '@/entities/media';
import type { HomeItem, MediaType, NewEpisode } from '@/shared/api';
import { tmdbPosterUrl } from '@/shared/config';
import { interleave } from '@/shared/lib';

export const TOP_TEN_COUNT = 10;
const TOP_THREE_COUNT = 3;
export const HIGHLIGHTS_PER_TYPE = 3;

export type TypeFilter = 'all' | MediaType;

export const TYPE_FILTERS: readonly TypeFilter[] = ['all', 'show', 'movie'];

export type TrendingHighlights = Record<TypeFilter, TrendingMedia[]>;

export interface HeroMedia extends TrendingMedia {
  overview?: string;
  wideBackdropUrl?: string;
}

export interface HomeHero {
  lead?: HeroMedia;
  picks: TrendingMedia[];
}

export interface EpisodeRelease {
  mediaItemId: string;
  slug: string;
  showTitle: string;
  episodeTitle: string;
  posterUrl?: string;
  season: number;
  episode: number;
  airedAt: string;
}

const API_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/;

function toHeroMedia(item: HomeItem): HeroMedia {
  return {
    ...fromHomeItem(item),
    backdropUrl: item.backdrop.medium,
    wideBackdropUrl: item.backdrop.large,
    overview: item.overview ?? undefined,
  };
}

export function buildHomeHero(items: readonly HomeItem[]): HomeHero {
  const [lead, ...rest] = items;
  return {
    lead: lead ? toHeroMedia(lead) : undefined,
    picks: rest.slice(0, TOP_THREE_COUNT).map(fromHomeItem),
  };
}

export function titleIds(items: readonly { mediaItemId: string }[]): Set<string> {
  return new Set(items.map((item) => item.mediaItemId));
}

function withoutTitles<T extends { mediaItemId: string }>(
  items: readonly T[],
  excluded: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !excluded.has(item.mediaItemId));
}

export function buildWatchingNow(
  items: readonly HomeItem[],
  excluded: ReadonlySet<string>,
): TrendingMedia[] {
  return withoutTitles(items, excluded).slice(0, TOP_THREE_COUNT).map(fromHomeItem);
}

export function buildHighlights(
  shows: readonly TrendingMedia[],
  movies: readonly TrendingMedia[],
  excluded: ReadonlySet<string>,
): TrendingHighlights {
  const freshShows = withoutTitles(shows, excluded);
  const freshMovies = withoutTitles(movies, excluded);
  const perFilter = HIGHLIGHTS_PER_TYPE * 2;
  return {
    all: interleave(
      freshShows.slice(0, HIGHLIGHTS_PER_TYPE),
      freshMovies.slice(0, HIGHLIGHTS_PER_TYPE),
    ),
    show: freshShows.slice(0, perFilter),
    movie: freshMovies.slice(0, perFilter),
  };
}

export function toAiredAt(airDate: string): string {
  const match = API_DATE_TIME.exec(airDate);
  return match ? `${match[1]}T${match[2]}Z` : airDate;
}

export function toEpisodeRelease(item: NewEpisode): EpisodeRelease {
  return {
    mediaItemId: item.mediaItemId,
    slug: item.slug,
    showTitle: item.title,
    episodeTitle: item.episodeTitle,
    posterUrl: tmdbPosterUrl(item.posterPath, 'w342'),
    season: item.seasonNumber,
    episode: item.episodeNumber,
    airedAt: toAiredAt(item.airDate),
  };
}
