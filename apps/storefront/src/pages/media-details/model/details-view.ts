import { ratingVerdict, type RatingSource, type RatingVerdict } from '@/entities/media';
import type { MediaType, MovieDetails, ShowDetails } from '@/shared/api';
import { percentFromScore, positiveNumber, scoreFromPercent, yearFromDate } from '@/shared/lib';
import { toCredits, type Credits } from './credits';
import { toTrailers, type Trailer } from './trailers';

type MovieStatus = NonNullable<MovieDetails['status']>;
export type ShowStatus = NonNullable<ShowDetails['status']>;
type RecentRater = NonNullable<NonNullable<MovieDetails['stats']>['recentRaters']>[number];

export interface ExternalRating {
  source: RatingSource;
  value: number;
}

export interface Community {
  raters: RecentRater[];
  ratingCount: number;
  averageScore?: number;
}

interface DetailsBase {
  mediaItemId: string;
  slug: string;
  title: string;
  overview?: string;
  posterUrl?: string;
  posterPlaceholderUrl?: string;
  backdropUrl?: string;
  backdropLargeUrl?: string;
  year?: number;
  releaseDate?: string;
  genres: string[];
  score?: number;
  verdict?: RatingVerdict;
  verdictMessageKey?: string;
  externalRatings: ExternalRating[];
  watchingNow?: number;
  totalWatchers?: number;
  community: Community;
  credits: Credits;
  trailers: Trailer[];
}

export interface MovieDetailsView extends DetailsBase {
  type: Extract<MediaType, 'movie'>;
  runtimeMinutes?: number;
  status?: MovieStatus;
  budget?: number;
  revenue?: number;
}

export interface ShowDetailsView extends DetailsBase {
  type: Extract<MediaType, 'show'>;
  seasonCount?: number;
  episodeCount?: number;
  status?: ShowStatus;
  lastAirDate?: string;
}

export type MediaDetailsView = MovieDetailsView | ShowDetailsView;

const SHOWN_RATERS = 3;

function toExternalRatings(ratings: MovieDetails['externalRatings']): ExternalRating[] {
  const traktScore = positiveNumber(ratings?.trakt?.rating);
  const candidates: Array<[RatingSource, number | undefined]> = [
    ['imdb', positiveNumber(ratings?.imdb?.rating)],
    ['rtCritics', positiveNumber(ratings?.rottenTomatoes?.rating)],
    ['rtAudience', positiveNumber(ratings?.rottenTomatoesAudience?.rating)],
    ['metacritic', positiveNumber(ratings?.metacritic?.rating)],
    ['trakt', traktScore === undefined ? undefined : percentFromScore(traktScore)],
  ];
  return candidates.flatMap(([source, value]) => (value === undefined ? [] : [{ source, value }]));
}

function toBase(media: MovieDetails | ShowDetails): DetailsBase {
  const score = scoreFromPercent(media.stats?.qualityScore);
  const raters = media.stats?.recentRaters ?? [];
  return {
    mediaItemId: media.id,
    slug: media.slug,
    title: media.title,
    overview: media.overview?.trim() || undefined,
    posterUrl: media.poster?.medium,
    posterPlaceholderUrl: media.poster?.small,
    backdropUrl: media.backdrop?.medium,
    backdropLargeUrl: media.backdrop?.large,
    year: yearFromDate(media.releaseDate),
    releaseDate: media.releaseDate ?? undefined,
    genres: (media.genres ?? []).map((genre) => genre.name),
    score,
    verdict: score === undefined ? undefined : ratingVerdict(score),
    verdictMessageKey: media.verdict?.messageKey ?? undefined,
    externalRatings: toExternalRatings(media.externalRatings),
    watchingNow: positiveNumber(media.stats?.liveWatchers),
    totalWatchers: positiveNumber(media.stats?.totalWatchers),
    community: {
      raters: raters.slice(0, SHOWN_RATERS),
      ratingCount: Math.max(media.stats?.communityRatingCount ?? 0, raters.length),
      averageScore: scoreFromPercent(media.stats?.communityAverageRating),
    },
    credits: toCredits(media.credits),
    trailers: toTrailers(media.videos ?? [], media.primaryTrailer),
  };
}

export function fromMovieDetails(movie: MovieDetails): MovieDetailsView {
  return {
    ...toBase(movie),
    type: 'movie',
    runtimeMinutes: positiveNumber(movie.runtime),
    status: movie.status ?? undefined,
    budget: positiveNumber(movie.budget),
    revenue: positiveNumber(movie.revenue),
  };
}

export function fromShowDetails(show: ShowDetails): ShowDetailsView {
  return {
    ...toBase(show),
    type: 'show',
    seasonCount: positiveNumber(show.totalSeasons),
    episodeCount: positiveNumber(show.totalEpisodes),
    status: show.status ?? undefined,
    lastAirDate: show.lastAirDate ?? undefined,
  };
}
