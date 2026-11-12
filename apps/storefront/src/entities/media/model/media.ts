import type { MediaBadge, MediaType, TrendingMovie, TrendingShow } from '@/shared/api';
import { ratingVerdict, scoreFromPercent, type RatingVerdict } from './score';

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

export const EVENT_BADGES = [
  'NEW_EPISODE',
  'NEW_RELEASE',
  'IN_THEATERS',
  'NEW_ON_STREAMING',
] as const;

export type EventBadge = (typeof EVENT_BADGES)[number];

export interface TrendingMedia extends MediaSummary {
  imdbRating?: number;
  verdict?: RatingVerdict;
  backdropUrl?: string;
  eventBadge?: EventBadge;
  providers: WatchProvider[];
}

export function toEventBadge(badge: MediaBadge | null | undefined): EventBadge | undefined {
  return EVENT_BADGES.find((event) => event === badge);
}

function positiveRating(rating: number | null | undefined): number | undefined {
  return rating != null && Number.isFinite(rating) && rating > 0 ? rating : undefined;
}

function verdictOf(qualityPercent: number | null | undefined): RatingVerdict | undefined {
  const quality = scoreFromPercent(qualityPercent);
  return quality === undefined ? undefined : ratingVerdict(quality);
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
    imdbRating: positiveRating(item.externalRatings.imdb?.rating),
    verdict: verdictOf(item.stats.qualityScore),
    eventBadge: toEventBadge(item.card?.badgeKey),
    providers: [],
  };
}

export function fromTrendingMovie(movie: TrendingMovie): TrendingMedia {
  return toTrendingMedia(movie, 'movie');
}

export function fromTrendingShow(show: TrendingShow): TrendingMedia {
  return toTrendingMedia(show, 'show');
}
