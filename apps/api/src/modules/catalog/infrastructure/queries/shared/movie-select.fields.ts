import * as schema from '../../../../../database/schema';

/**
 * Shared select fields for movie queries.
 * Eliminates duplication between TrendingMoviesQuery and MovieListingsQuery.
 */
export const movieSelectFields = {
  id: schema.movies.id,
  mediaItemId: schema.movies.mediaItemId,
  tmdbId: schema.mediaItems.tmdbId,
  title: schema.mediaItems.title,
  slug: schema.mediaItems.slug,
  overview: schema.mediaItems.overview,
  ingestionStatus: schema.mediaItems.ingestionStatus,
  posterPath: schema.mediaItems.posterPath,
  backdropPath: schema.mediaItems.backdropPath,
  popularity: schema.mediaItems.popularity,
  rating: schema.mediaItems.rating,
  voteCount: schema.mediaItems.voteCount,
  releaseDate: schema.mediaItems.releaseDate,

  ratingImdb: schema.mediaItems.ratingImdb,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
  ratingRottenTomatoesAudience: schema.mediaItems.ratingRottenTomatoesAudience,

  theatricalReleaseDate: schema.movies.theatricalReleaseDate,
  digitalReleaseDate: schema.movies.digitalReleaseDate,
  runtime: schema.movies.runtime,
  ratingoScore: schema.mediaStats.ratingoScore,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  watchersCount: schema.mediaStats.watchersCount,
  totalWatchers: schema.mediaStats.totalWatchers,
} as const;

/**
 * Type for movie select result row.
 */
export type MovieSelectRow = {
  id: string;
  mediaItemId: string;
  tmdbId: number;
  title: string;
  slug: string;
  overview: string | null;
  ingestionStatus: string;
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
  rating: number;
  voteCount: number;
  releaseDate: Date | null;
  ratingImdb: number | null;
  voteCountImdb: number | null;
  ratingTrakt: number | null;
  voteCountTrakt: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  ratingRottenTomatoesAudience: number | null;
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  runtime: number | null;
  ratingoScore: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
  watchersCount: number | null;
  totalWatchers: number | null;
};
