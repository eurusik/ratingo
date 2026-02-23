import { type InferInsertModel } from 'drizzle-orm';

import type * as schema from '../../../../database/schema';
import type { NormalizedMedia } from '../../../ingestion/public';
import { toDateOrNull } from '../utils/persistence.utils';

type MediaItemInsert = InferInsertModel<typeof schema.mediaItems>;
type MediaStatsInsert = InferInsertModel<typeof schema.mediaStats>;

/**
 * Maps NormalizedMedia to Drizzle insert/update payloads for media_items and media_stats.
 */
export class MediaItemPersistenceMapper {
  static toMediaItemInsert(media: NormalizedMedia): MediaItemInsert {
    // Ensure slug is never empty (required by UNIQUE NOT NULL constraint)
    const slug = media.slug?.trim() || `${media.type}-${media.externalIds.tmdbId}`;

    return {
      type: media.type,
      tmdbId: media.externalIds.tmdbId,
      imdbId: media.externalIds.imdbId || null,
      title: media.title || media.originalTitle || `Untitled ${media.externalIds.tmdbId}`,
      originalTitle: media.originalTitle,
      alternativeTitles: media.alternativeTitles?.length ? media.alternativeTitles : null,
      slug,
      overview: media.overview || null,
      ingestionStatus: media.ingestionStatus,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      videos: media.videos || null,
      credits: media.credits || null,
      watchProvidersRaw: media.watchProvidersRaw || null,

      // Metrics
      rating: media.rating,
      voteCount: media.voteCount,
      popularity: media.popularity,
      trendingScore: media.trendingScore ?? 0,
      trendingRank: media.trendingRank ?? null,
      trendingUpdatedAt: toDateOrNull(media.trendingUpdatedAt),

      // External Ratings
      ratingImdb: media.ratingImdb,
      voteCountImdb: media.voteCountImdb,
      ratingTrakt: media.ratingTrakt,
      voteCountTrakt: media.voteCountTrakt,
      ratingMetacritic: media.ratingMetacritic,
      ratingRottenTomatoes: media.ratingRottenTomatoes,

      releaseDate: toDateOrNull(media.releaseDate),

      // Origin metadata for catalog policy
      originCountries: media.originCountries || null,
      originalLanguage: media.originalLanguage || null,

      updatedAt: new Date(),
    };
  }

  /**
   * Creates update payload for media item.
   *
   * IMPORTANT: Fields like originCountries, originalLanguage, overview are only
   * included when explicitly provided (not undefined). This prevents overwriting
   * existing data with NULL when sync payload is incomplete (e.g., fallback path).
   */
  static toMediaItemUpdate(media: NormalizedMedia): Partial<MediaItemInsert> {
    const releaseDate = toDateOrNull(media.releaseDate);
    const trendingUpdatedAt = toDateOrNull(media.trendingUpdatedAt) ?? new Date();

    const update: Partial<MediaItemInsert> = {
      imdbId: media.externalIds.imdbId || null,
      title: media.title,
      originalTitle: media.originalTitle,
      ingestionStatus: media.ingestionStatus,
      rating: media.rating,
      voteCount: media.voteCount,
      popularity: media.popularity,
      ratingImdb: media.ratingImdb,
      voteCountImdb: media.voteCountImdb,
      ratingTrakt: media.ratingTrakt,
      voteCountTrakt: media.voteCountTrakt,
      ratingMetacritic: media.ratingMetacritic,
      ratingRottenTomatoes: media.ratingRottenTomatoes,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      videos: media.videos || null,
      credits: media.credits || null,
      watchProvidersRaw: media.watchProvidersRaw || null,
      releaseDate,
      updatedAt: new Date(),
      ...(media.trendingScore !== undefined && {
        trendingScore: media.trendingScore,
        trendingRank: media.trendingRank ?? null,
        trendingUpdatedAt,
      }),
      // Only update these fields if explicitly provided (not undefined)
      // This prevents overwriting existing data when sync uses fallback path
      ...(media.overview !== undefined && { overview: media.overview }),
      ...(media.originCountries !== undefined && { originCountries: media.originCountries }),
      ...(media.originalLanguage !== undefined && { originalLanguage: media.originalLanguage }),
      ...(media.alternativeTitles !== undefined && {
        alternativeTitles: media.alternativeTitles?.length ? media.alternativeTitles : null,
      }),
    };

    // Filter out undefined values
    const filtered = Object.fromEntries(
      Object.entries(update).filter(([, v]) => v !== undefined),
    ) as Partial<MediaItemInsert>;

    // Always ensure updatedAt is present to prevent "No values to set" error
    filtered.updatedAt = new Date();

    return filtered;
  }

  static toMediaStatsInsert(mediaId: string, media: NormalizedMedia): MediaStatsInsert | null {
    if (media.ratingoScore === undefined) return null;

    // CRITICAL: Don't set watchersCount/totalWatchers to 0 when it's null/undefined.
    // This prevents silent data corruption when Trakt API fails.
    // The repository upsert will preserve existing value via COALESCE.
    const stats: MediaStatsInsert = {
      mediaItemId: mediaId,
      ratingoScore: media.ratingoScore,
      qualityScore: media.qualityScore,
      popularityScore: media.popularityScore,
      freshnessScore: media.freshnessScore,
      updatedAt: new Date(),
    };

    // Only include watchersCount if we have actual data (not null/undefined)
    if (media.watchersCount != null) {
      stats.watchersCount = media.watchersCount;
    }

    // Only include totalWatchers if we have actual data (not null/undefined)
    if (media.totalWatchers != null) {
      stats.totalWatchers = media.totalWatchers;
    }

    return stats;
  }
}
