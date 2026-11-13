import type { Metadata } from 'next';
import type { MovieDetails, ShowDetails } from '@/shared/api';
import { createMediaMetadata, createNotFoundMetadata } from '@/shared/lib';

type JsonLdData = Record<string, unknown>;

const ACTOR_LIMIT = 5;
const RATINGO_SCORE_SCALE = 100;

function aggregateRating(media: MovieDetails | ShowDetails): JsonLdData | undefined {
  const score = media.stats?.ratingoScore;
  const count = media.stats?.communityRatingCount;
  if (score == null || count == null || count <= 0) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingValue: score,
    bestRating: RATINGO_SCORE_SCALE,
    ratingCount: count,
  };
}

function people(names: string[]): JsonLdData[] | undefined {
  return names.length > 0 ? names.map((name) => ({ '@type': 'Person', name })) : undefined;
}

export function movieMetadata(movie: MovieDetails | null, slug: string): Metadata {
  return movie
    ? createMediaMetadata(movie, { type: 'movie', slug })
    : createNotFoundMetadata('movie');
}

export function showMetadata(show: ShowDetails | null, slug: string): Metadata {
  return show ? createMediaMetadata(show, { type: 'show', slug }) : createNotFoundMetadata('show');
}

export function movieJsonLd(movie: MovieDetails): JsonLdData {
  const directors = (movie.credits?.crew ?? [])
    .filter((member) => member.job === 'Director')
    .map((member) => member.name);
  const actors = (movie.credits?.cast ?? []).slice(0, ACTOR_LIMIT).map((member) => member.name);

  return {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.overview ?? undefined,
    image: movie.poster?.medium ?? movie.backdrop?.large ?? undefined,
    datePublished: movie.releaseDate || undefined,
    genre: (movie.genres ?? []).map((genre) => genre.name),
    aggregateRating: aggregateRating(movie),
    director: people(directors),
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
