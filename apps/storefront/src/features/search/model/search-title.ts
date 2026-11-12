import type { MediaType, SearchItem, TrendingMovie, TrendingShow } from '@/shared/api';

export interface SearchTitle {
  key: string;
  isInCatalog: boolean;
  type: MediaType;
  tmdbId?: number;
  mediaItemId?: string;
  slug?: string;
  title: string;
  alsoKnownAs?: string;
  year?: number;
  posterUrl?: string;
  rating?: number;
}

function yearOf(date: string | null | undefined): number | undefined {
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
}

const PERCENT_TO_TEN_POINTS = 10;

function toTenPointScale(score: number | null | undefined): number | undefined {
  return score == null ? undefined : score / PERCENT_TO_TEN_POINTS;
}

function positive(value: number | null | undefined): number | undefined {
  return value && value > 0 ? value : undefined;
}

export function fromSearchItem(item: SearchItem): SearchTitle {
  return {
    key: `${item.source}-${item.type}-${item.tmdbId}`,
    isInCatalog: item.source === 'local',
    type: item.type,
    tmdbId: item.tmdbId,
    mediaItemId: item.mediaItemId,
    slug: item.slug,
    title: item.title,
    alsoKnownAs: item.matchedAlternativeTitle ?? undefined,
    year: positive(item.year),
    posterUrl: item.poster?.thumb,
    rating: item.source === 'local' ? positive(item.rating) : undefined,
  };
}

export function fromTrending(item: TrendingMovie | TrendingShow, type: MediaType): SearchTitle {
  return {
    key: `trending-${type}-${item.mediaItemId}`,
    isInCatalog: true,
    type,
    mediaItemId: item.mediaItemId,
    slug: item.slug,
    title: item.title,
    year: yearOf(item.releaseDate),
    posterUrl: item.poster?.thumb,
    rating: positive(toTenPointScale(item.stats.ratingoScore)),
  };
}
