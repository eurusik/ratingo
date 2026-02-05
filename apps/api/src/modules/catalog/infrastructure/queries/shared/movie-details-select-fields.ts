import * as schema from '../../../../../database/schema';

import { type MovieDetailsQueryRow } from './movie-details.mapper';

/**
 * Shared select fields for MovieDetailsQuery.
 * Single source of truth to ensure consistency between query and mapper.
 *
 * These fields are used by:
 * - MovieDetailsQuery
 *
 * The resulting rows are mapped via mapMovieDetails() in movie-details.mapper.ts
 */
export const MOVIE_DETAILS_SELECT_FIELDS = {
  // Core media item fields
  id: schema.mediaItems.id,
  tmdbId: schema.mediaItems.tmdbId,
  title: schema.mediaItems.title,
  originalTitle: schema.mediaItems.originalTitle,
  slug: schema.mediaItems.slug,
  overview: schema.mediaItems.overview,
  posterPath: schema.mediaItems.posterPath,
  ingestionStatus: schema.mediaItems.ingestionStatus,
  backdropPath: schema.mediaItems.backdropPath,
  rating: schema.mediaItems.rating,
  voteCount: schema.mediaItems.voteCount,
  releaseDate: schema.mediaItems.releaseDate,
  videos: schema.mediaItems.videos,
  credits: schema.mediaItems.credits,
  watchProvidersRaw: schema.mediaItems.watchProvidersRaw,

  // External ratings from media_items table
  ratingImdb: schema.mediaItems.ratingImdb,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,

  // Movie-specific fields from movies table
  runtime: schema.movies.runtime,
  budget: schema.movies.budget,
  revenue: schema.movies.revenue,
  status: schema.movies.status,
  theatricalReleaseDate: schema.movies.theatricalReleaseDate,
  digitalReleaseDate: schema.movies.digitalReleaseDate,

  // Computed stats from media_stats table
  ratingoScore: schema.mediaStats.ratingoScore,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  watchersCount: schema.mediaStats.watchersCount,
  totalWatchers: schema.mediaStats.totalWatchers,
} as const;

/**
 * Compile-time check: MOVIE_DETAILS_SELECT_FIELDS keys must match MovieDetailsQueryRow keys.
 * If you see a type error here, the fields are out of sync.
 */
type _AssertKeysMatch = [keyof typeof MOVIE_DETAILS_SELECT_FIELDS] extends [
  keyof MovieDetailsQueryRow,
]
  ? [keyof MovieDetailsQueryRow] extends [keyof typeof MOVIE_DETAILS_SELECT_FIELDS]
    ? true
    : never
  : never;
const _assertFieldsMatch: _AssertKeysMatch = true;
