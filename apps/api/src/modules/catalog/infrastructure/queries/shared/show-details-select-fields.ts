import * as schema from '../../../../../database/schema';

import { type ShowDetailsQueryRow } from './show-details.mapper';

/**
 * Shared select fields for ShowDetailsQuery.
 * Single source of truth to ensure consistency between query and mapper.
 *
 * These fields are used by:
 * - ShowDetailsQuery
 *
 * The resulting rows are mapped via mapShowDetails() in show-details.mapper.ts
 */
export const SHOW_DETAILS_SELECT_FIELDS = {
  // Core media item fields (15)
  id: schema.mediaItems.id,
  tmdbId: schema.mediaItems.tmdbId,
  title: schema.mediaItems.title,
  originalTitle: schema.mediaItems.originalTitle,
  slug: schema.mediaItems.slug,
  overview: schema.mediaItems.overview,
  posterPath: schema.mediaItems.posterPath,
  ingestionStatus: schema.mediaItems.ingestionStatus,
  backdropPath: schema.mediaItems.backdropPath,
  videos: schema.mediaItems.videos,
  credits: schema.mediaItems.credits,
  watchProvidersRaw: schema.mediaItems.watchProvidersRaw,
  rating: schema.mediaItems.rating,
  voteCount: schema.mediaItems.voteCount,
  releaseDate: schema.mediaItems.releaseDate,

  // External ratings (6)
  ratingImdb: schema.mediaItems.ratingImdb,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
  ratingRottenTomatoesAudience: schema.mediaItems.ratingRottenTomatoesAudience,

  // Show-specific fields (6)
  totalSeasons: schema.shows.totalSeasons,
  totalEpisodes: schema.shows.totalEpisodes,
  status: schema.shows.status,
  lastAirDate: schema.shows.lastAirDate,
  nextAirDate: schema.shows.nextAirDate,
  showId: schema.shows.id,

  // Stats (7)
  ratingoScore: schema.mediaStats.ratingoScore,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  watchersCount: schema.mediaStats.watchersCount,
  totalWatchers: schema.mediaStats.totalWatchers,
  communityAverageRating: schema.mediaStats.communityAverageRating,
  communityRatingCount: schema.mediaStats.communityRatingCount,
} as const;

/**
 * Compile-time check: SHOW_DETAILS_SELECT_FIELDS keys must match ShowDetailsQueryRow keys.
 * If you see a type error here, the fields are out of sync.
 */
type _AssertKeysMatch = [keyof typeof SHOW_DETAILS_SELECT_FIELDS] extends [
  keyof ShowDetailsQueryRow,
]
  ? [keyof ShowDetailsQueryRow] extends [keyof typeof SHOW_DETAILS_SELECT_FIELDS]
    ? true
    : never
  : never;
const _assertFieldsMatch: _AssertKeysMatch = true;
