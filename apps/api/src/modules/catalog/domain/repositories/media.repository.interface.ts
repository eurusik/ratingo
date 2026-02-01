import type { NormalizedMedia } from '@/modules/ingestion/public';

import { type IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { type LocalSearchResult } from '../models/search-result.model';

/**
 * Data needed for score calculation.
 */
export interface MediaScoreData {
  id: string;
  popularity: number;
  releaseDate: Date | null;
  lastAirDate: Date | null;
  ratingImdb: number | null;
  ratingTrakt: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  voteCountImdb: number | null;
  voteCountTrakt: number | null;
  /** Live Trakt watchers count from media_stats (for optional bonus) */
  watchersCount: number | null;
  /** Total Trakt watchers from media_stats (primary popularity signal) */
  totalWatchers: number | null;
}

/**
 * Media item with TMDB ID mapping.
 */
export interface MediaWithTmdbId {
  id: string;
  tmdbId: number;
}

/**
 * Score data with TMDB ID for batch operations.
 */
export interface MediaScoreDataWithTmdbId extends MediaScoreData {
  tmdbId: number;
}

/**
 * Abstract interface for Media storage.
 * Decouples the business logic from Drizzle/Postgres.
 */
export interface IMediaRepository {
  /**
   * Creates a minimal stub media item (media_items only) used to start ingestion.
   * Should not fail if the item already exists – returns existing id/slug in that case.
   *
   * @param {{ tmdbId: number; type: MediaType; title: string; slug: string; ingestionStatus: IngestionStatus }} payload - Stub payload
   * @returns {Promise<{ id: string; slug: string }>} Created or existing stub
   */
  upsertStub(payload: {
    tmdbId: number;
    type: MediaType;
    title: string;
    slug: string;
    ingestionStatus: IngestionStatus;
  }): Promise<{ id: string; slug: string }>;

  /**
   * Creates or updates a media item (Movie/Show) and its related entities
   * (genres, specific details) in a transactional way.
   *
   * Strategy: Match by TMDB ID.
   *
   * @param {NormalizedMedia} media - Normalized media payload
   * @returns {Promise<void>} Nothing
   */
  upsert(media: NormalizedMedia): Promise<void>;

  /**
   * Retrieves a media item by its external TMDB ID.
   * Note: TMDB IDs are unique per type (movie vs show), so type parameter
   * is recommended for correctness when both types might exist.
   *
   * @param {number} tmdbId - TMDB ID
   * @param {MediaType} type - Optional media type for precise lookup
   * @returns {Promise<{ id: string; slug: string; type: MediaType; ingestionStatus: IngestionStatus } | null>} Mapping or null
   */
  findByTmdbId(
    tmdbId: number,
    type?: MediaType,
  ): Promise<{
    id: string;
    slug: string;
    type: MediaType;
    ingestionStatus: IngestionStatus;
  } | null>;

  /**
   * Updates ingestion status by TMDB ID (no-op if not found).
   *
   * @param {number} tmdbId - TMDB ID
   * @param {IngestionStatus} status - New status
   * @returns {Promise<void>} Nothing
   */
  updateIngestionStatus(tmdbId: number, status: IngestionStatus): Promise<void>;

  /**
   * Retrieves media data needed for score calculation.
   *
   * @param {string} id - Media item id
   * @returns {Promise<MediaScoreData | null>} Score data or null
   */
  findByIdForScoring(id: string): Promise<MediaScoreData | null>;

  /**
   * Batch: Retrieves multiple media items by TMDB IDs.
   * Returns a map of tmdbId -> { id, tmdbId }
   *
   * @param {number[]} tmdbIds - TMDB IDs
   * @returns {Promise<MediaWithTmdbId[]>} Mappings list
   */
  findManyByTmdbIds(tmdbIds: number[]): Promise<MediaWithTmdbId[]>;

  /**
   * Batch: Retrieves score data for multiple media items by their IDs.
   * Batch: Retrieves score data for multiple media items in a single query.
   *
   * @param {string[]} ids - Media item ids
   * @returns {Promise<MediaScoreDataWithTmdbId[]>} Score data list
   */
  findManyForScoring(ids: string[]): Promise<MediaScoreDataWithTmdbId[]>;

  /**
   * Retrieves top media items for the Hero block.
   * Criteria: Released, has poster/backdrop, sorted by popularity.
   *
   * @param {number} limit - Max items
   * @param {MediaType} type - Optional media type filter
   * @returns {Promise<HeroMediaItem[]>} Hero items
   */
  findHero(limit: number, type?: MediaType): Promise<HeroMediaItem[]>;

  /**
   * Searches for media items using full-text search.
   *
   * @param {string} query - Search string
   * @param {number} limit - Max items
   * @returns {Promise<LocalSearchResult[]>} Search results
   */
  search(query: string, limit: number): Promise<LocalSearchResult[]>;

  /**
   * Retrieves media items updated by trending sync since a given date.
   * Used by stats sync to get items that were recently synced.
   *
   * @param {object} options - Query options
   * @param {Date} options.since - Only items updated after this date
   * @param {number} options.limit - Max items to return
   * @returns {Promise<TrendingUpdatedItem[]>} Items with tmdbId and type
   */
  findTrendingUpdatedItems(options: {
    since?: Date;
    limit: number;
  }): Promise<TrendingUpdatedItem[]>;

  /**
   * Retrieves IDs of active media items for snapshots sync with cursor pagination.
   *
   * @param {object} options - Pagination options
   * @param {string} options.cursor - Last processed ID (exclusive)
   * @param {number} options.limit - Number of IDs to fetch
   * @returns {Promise<string[]>} List of media item IDs
   */
  findIdsForSnapshots(options: { cursor?: string; limit: number }): Promise<string[]>;

  /**
   * Retrieves IDs of media items for score recalculation with pagination.
   *
   * @param {object} options - Query options
   * @param {MediaType} options.type - Filter by media type
   * @param {number} options.limit - Number of IDs per batch
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<string[]>} List of media item IDs
   */
  findIdsForRecalculation(options: {
    type?: MediaType;
    limit: number;
    offset: number;
  }): Promise<string[]>;

  /**
   * Finds media items with corrupted total_watchers data.
   * Items where total_watchers = 0 but have Trakt votes (indicating API failure during sync).
   *
   * @param {object} options - Query options
   * @param {MediaType} options.type - Filter by media type
   * @param {number} options.limit - Max items to return
   * @param {number} options.minVotes - Minimum Trakt votes (default: 100)
   * @returns {Promise<CorruptedWatchersItem[]>} Items with corrupted data
   */
  findItemsWithMissingWatchers(options: {
    type?: MediaType;
    limit: number;
    minVotes: number;
  }): Promise<CorruptedWatchersItem[]>;

  /**
   * Finds items with corrupted watchers_count (live watchers).
   * Items where watchers_count = 0 but total_watchers > minTotalWatchers.
   * These items had their live watchers data corrupted by API failures.
   *
   * @param {object} options - Query options
   * @param {MediaType} options.type - Filter by media type
   * @param {number} options.limit - Max items to return
   * @param {number} options.minTotalWatchers - Minimum total_watchers to consider (default: 100)
   * @returns {Promise<CorruptedWatchersItem[]>} Items with corrupted live watchers
   */
  findItemsWithCorruptedWatchersCount(options: {
    type?: MediaType;
    limit: number;
    minTotalWatchers: number;
  }): Promise<CorruptedWatchersItem[]>;

  /**
   * Finds ELIGIBLE items for trending context.
   * Used to sync watchers data for items that are already in the trending list.
   *
   * @param {object} options - Query options
   * @param {number} options.limit - Max items to return
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<EligibleTrendingItem[]>} ELIGIBLE trending items with tmdbId and type
   */
  findEligibleForTrending(options: {
    limit: number;
    offset: number;
  }): Promise<EligibleTrendingItem[]>;

  /**
   * Retrieves ELIGIBLE media items for snapshots sync.
   * Filters to items that:
   * 1. Pass Policy Engine (ELIGIBLE in TRENDING context)
   * 2. Have tmdbId (required for Trakt API)
   * 3. Not soft-deleted
   *
   * Uses cursor pagination for memory efficiency.
   *
   * @param options - Query options (cursor, limit)
   * @returns Array of snapshot candidates
   */
  findSnapshotCandidates(options: { cursor?: string; limit: number }): Promise<SnapshotCandidate[]>;

  /**
   * Finds homepage candidates with stale stats that need refresh.
   * Covers both Hero and Watching-Now sections.
   *
   * Returns items that:
   * 1. Are ELIGIBLE for trending display
   * 2. Have images (poster/backdrop)
   * 3. Have watchers_count > 0 (already synced at least once)
   * 4. Have media_stats.updated_at older than staleThresholdHours
   * 5. Meet quality threshold (configurable, default 60 for hero-only, 50 for hero+watching-now)
   *
   * @param options - Query options
   * @param options.staleThresholdHours - Hours since last update to consider stale
   * @param options.limit - Max items to return
   * @param options.minQualityScore - Minimum quality score (50 covers both hero and watching-now)
   * @returns Homepage candidates with stale stats
   */
  findHeroCandidatesForStatsRefresh(options: {
    staleThresholdHours: number;
    limit: number;
    minQualityScore?: number;
  }): Promise<HeroCandidateItem[]>;
}

/**
 * Item returned by findHeroCandidatesForStatsRefresh.
 * Represents hero candidates that need stats refresh.
 */
export interface HeroCandidateItem {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Item returned by findTrendingUpdatedItems.
 */
export interface TrendingUpdatedItem {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Snapshot candidate item - minimal data needed for batch snapshot sync.
 */
export interface SnapshotCandidate {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Item returned by findEligibleForTrending.
 * Represents ELIGIBLE items in trending context that need stats sync.
 */
export interface EligibleTrendingItem {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Item returned by findItemsWithMissingWatchers.
 * Represents items with corrupted total_watchers data.
 */
export interface CorruptedWatchersItem {
  id: string;
  tmdbId: number;
  type: MediaType;
  voteCountTrakt: number;
}

/**
 * Injection token for the Media repository.
 */
export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');
