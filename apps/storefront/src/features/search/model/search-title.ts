import type { MediaType, SearchItem, TrendingMovie, TrendingShow } from '@/shared/api';
import { positiveNumber, scoreFromPercent, yearFromDate } from '@/shared/lib';

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
  score?: number;
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
    year: positiveNumber(item.year),
    posterUrl: item.poster?.thumb,
    score: item.source === 'local' ? positiveNumber(item.rating) : undefined,
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
    year: yearFromDate(item.releaseDate),
    posterUrl: item.poster?.thumb,
    score: scoreFromPercent(item.stats.ratingoScore),
  };
}
