import type { MediaBadge, MediaType, TrendingMovie, TrendingShow } from '@/shared/api';
import { positiveNumber, scoreFromPercent, yearFromDate } from '@/shared/lib';
import { ratingVerdict, type RatingVerdict } from './score';

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

export const MIN_WATCHING_NOW = 25;

export const MEDIA_EVENTS = [
  'NEW_EPISODE',
  'NEW_RELEASE',
  'IN_THEATERS',
  'NEW_ON_STREAMING',
] as const;

export type MediaEvent = (typeof MEDIA_EVENTS)[number];

export interface TrendingMedia extends MediaSummary {
  imdbRating?: number;
  criticsPercent?: number;
  watchingNow?: number;
  verdict?: RatingVerdict;
  backdropUrl?: string;
  event?: MediaEvent;
  providers: WatchProvider[];
}

export function toMediaEvent(badge: MediaBadge | null | undefined): MediaEvent | undefined {
  return MEDIA_EVENTS.find((event) => event === badge);
}

function verdictOf(qualityPercent: number | null | undefined): RatingVerdict | undefined {
  const quality = scoreFromPercent(qualityPercent);
  return quality === undefined ? undefined : ratingVerdict(quality);
}

function watchingNowOf(liveWatchers: number | null | undefined): number | undefined {
  const watching = positiveNumber(liveWatchers);
  return watching !== undefined && watching >= MIN_WATCHING_NOW ? watching : undefined;
}

function toTrendingMedia(item: TrendingMovie | TrendingShow, type: MediaType): TrendingMedia {
  return {
    mediaItemId: item.mediaItemId,
    type,
    slug: item.slug,
    title: item.title,
    year: yearFromDate(item.releaseDate),
    posterUrl: item.poster?.small,
    backdropUrl: item.backdrop?.medium,
    imdbRating: positiveNumber(item.externalRatings.imdb?.rating),
    criticsPercent: positiveNumber(item.externalRatings.rottenTomatoes?.rating),
    watchingNow: watchingNowOf(item.stats.liveWatchers),
    verdict: verdictOf(item.stats.qualityScore),
    event: toMediaEvent(item.card?.badgeKey),
    providers: [],
  };
}

export function fromTrendingMovie(movie: TrendingMovie): TrendingMedia {
  return toTrendingMedia(movie, 'movie');
}

export function fromTrendingShow(show: TrendingShow): TrendingMedia {
  return toTrendingMedia(show, 'show');
}
