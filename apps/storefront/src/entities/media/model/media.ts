import type { MediaBadge, MediaType, TrendingMovie, TrendingShow } from '@/shared/api';
import { scoreFromPercent } from './score';

export interface WatchProvider {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface MediaSummary {
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  year?: number;
  posterUrl?: string;
}

export interface TrendingMedia extends MediaSummary {
  score?: number;
  backdropUrl?: string;
  badge?: MediaBadge;
  providers: WatchProvider[];
}

function yearOf(date: string | null | undefined): number | undefined {
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

function toTrendingMedia(item: TrendingMovie | TrendingShow, type: MediaType): TrendingMedia {
  return {
    mediaItemId: item.mediaItemId,
    type,
    slug: item.slug,
    title: item.title,
    year: yearOf(item.releaseDate),
    posterUrl: item.poster?.small,
    backdropUrl: item.backdrop?.small,
    score: scoreFromPercent(item.stats.ratingoScore),
    badge: item.card?.badgeKey ?? undefined,
    providers: [],
  };
}

export function fromTrendingMovie(movie: TrendingMovie): TrendingMedia {
  return toTrendingMedia(movie, 'movie');
}

export function fromTrendingShow(show: TrendingShow): TrendingMedia {
  return toTrendingMedia(show, 'show');
}
