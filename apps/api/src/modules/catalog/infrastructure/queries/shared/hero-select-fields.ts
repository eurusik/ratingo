import * as schema from '../../../../../database/schema';

import { type HeroQueryRow } from './hero-item.mapper';

/**
 * Shared select fields for Hero and WatchingNow queries.
 * Single source of truth to avoid duplication across query classes.
 *
 * These fields are used by:
 * - HeroMediaQuery
 * - WatchingNowMediaQuery
 *
 * The resulting rows are mapped via mapHeroResults() in hero-item.mapper.ts
 */
export const HERO_SELECT_FIELDS = {
  // Core media item fields
  id: schema.mediaItems.id,
  type: schema.mediaItems.type,
  slug: schema.mediaItems.slug,
  title: schema.mediaItems.title,
  originalTitle: schema.mediaItems.originalTitle,
  overview: schema.mediaItems.overview,
  posterPath: schema.mediaItems.posterPath,
  backdropPath: schema.mediaItems.backdropPath,
  releaseDate: schema.mediaItems.releaseDate,
  videos: schema.mediaItems.videos,

  // Computed stats from media_stats table
  ratingoScore: schema.mediaStats.ratingoScore,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  watchersCount: schema.mediaStats.watchersCount,
  totalWatchers: schema.mediaStats.totalWatchers,

  // External ratings from media_items table
  rating: schema.mediaItems.rating,
  voteCount: schema.mediaItems.voteCount,
  ratingImdb: schema.mediaItems.ratingImdb,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
} as const;

/**
 * Compile-time check: HERO_SELECT_FIELDS keys must match HeroQueryRow keys.
 * If you see a type error here, the fields are out of sync.
 */
type _AssertKeysMatch = [keyof typeof HERO_SELECT_FIELDS] extends [keyof HeroQueryRow]
  ? [keyof HeroQueryRow] extends [keyof typeof HERO_SELECT_FIELDS]
    ? true
    : never
  : never;
const _assertFieldsMatch: _AssertKeysMatch = true;
