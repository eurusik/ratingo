import { fromHomeItem, type TrendingMedia } from '@/entities/media';
import type { HomeItem, NewEpisode } from '@/shared/api';
import { tmdbPosterUrl } from '@/shared/config';

export const TOP_TEN_COUNT = 10;
const TOP_THREE_COUNT = 3;

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

const API_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/;

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

export interface ListChoice<K extends string> {
  available: K[];
  active?: K;
}

export function chooseList<K extends string>(
  lists: Record<K, readonly unknown[]>,
  order: readonly K[],
  chosen: K,
): ListChoice<K> {
  const available = order.filter((key) => lists[key].length > 0);
  return { available, active: available.includes(chosen) ? chosen : available[0] };
}

function toIsoOffset(zone: string | undefined): string {
  if (!zone || zone === 'Z') return 'Z';
  const digits = zone.slice(1).replace(':', '');
  return `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2) || '00'}`;
}

export function toAiredAt(airDate: string): string {
  const match = API_DATE_TIME.exec(airDate);
  if (!match) return airDate;
  const [, date, time, zone] = match;
  return `${date}T${time}${toIsoOffset(zone)}`;
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
