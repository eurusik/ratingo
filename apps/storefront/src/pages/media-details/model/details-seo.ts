import type { MovieDetails, ShowDetails } from '@/shared/api';
import { toCredits } from './credits';

export type JsonLdData = Record<string, unknown>;

const ACTOR_LIMIT = 5;
const RATING_SCALE = 100;
const LOWEST_RATING = 0;

function aggregateRating(media: MovieDetails | ShowDetails): JsonLdData | undefined {
  const average = media.stats?.communityAverageRating;
  const count = media.stats?.communityRatingCount;
  if (average == null || count == null || count <= 0) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingValue: average,
    bestRating: RATING_SCALE,
    worstRating: LOWEST_RATING,
    ratingCount: count,
  };
}

function people(names: string[]): JsonLdData[] | undefined {
  return names.length > 0 ? names.map((name) => ({ '@type': 'Person', name })) : undefined;
}

export function movieJsonLd(movie: MovieDetails): JsonLdData {
  const credits = toCredits(movie.credits);
  const actors = credits.cast.slice(0, ACTOR_LIMIT).map((member) => member.name);

  return {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.overview ?? undefined,
    image: movie.poster?.medium ?? movie.backdrop?.large ?? undefined,
    datePublished: movie.releaseDate || undefined,
    genre: (movie.genres ?? []).map((genre) => genre.name),
    aggregateRating: aggregateRating(movie),
    director: people(credits.directors),
    actor: people(actors),
  };
}

export function showJsonLd(show: ShowDetails): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: show.title,
    description: show.overview ?? undefined,
    image: show.poster?.medium ?? undefined,
    startDate: show.releaseDate || undefined,
    endDate: show.lastAirDate ?? undefined,
    numberOfSeasons: show.totalSeasons ?? undefined,
    numberOfEpisodes: show.totalEpisodes ?? undefined,
    genre: (show.genres ?? []).map((genre) => genre.name),
    aggregateRating: aggregateRating(show),
  };
}
