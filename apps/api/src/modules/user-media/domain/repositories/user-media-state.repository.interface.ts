import { type ImageDto } from '../../../../common/dtos/image.dto';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type UserMediaState } from '../entities/user-media-state.entity';

export interface UserMediaSummary {
  id: string;
  type: MediaType;
  title: string;
  slug: string;
  poster: ImageDto | null;
  releaseDate?: Date | null;
}

export interface ProgressSummary {
  watched: number;
  total: number;
}

export interface ContinuePoint {
  season: number;
  episode: number;
}

export const USER_MEDIA_STATE_REPOSITORY = Symbol('USER_MEDIA_STATE_REPOSITORY');

export const USER_MEDIA_LIST_SORT = {
  RECENT: 'recent',
  RATING: 'rating',
  RELEASE_DATE: 'releaseDate',
} as const;
export type UserMediaListSort = (typeof USER_MEDIA_LIST_SORT)[keyof typeof USER_MEDIA_LIST_SORT];

export interface ListWithMediaOptions {
  ratedOnly?: boolean;
  states?: Array<UserMediaState['state']>;
  sort?: UserMediaListSort;
  type?: MediaType;
}

/**
 * Service-level input — state is optional (resolved by the service).
 */
export interface SetUserMediaStateInput {
  userId: string;
  mediaItemId: string;
  state?: UserMediaState['state'];
  rating?: number | null;
  progress?: {
    seasons?: Record<number, number>;
  } | null;
  notes?: string | null;
}

/**
 * Repository-level payload — state is required (DB column is NOT NULL).
 */
export interface UpsertUserMediaStateData {
  userId: string;
  mediaItemId: string;
  state: UserMediaState['state'];
  rating?: number | null;
  progress?: {
    seasons?: Record<number, number>;
  } | null;
  notes?: string | null;
}

export interface UserMediaStats {
  moviesRated: number;
  showsRated: number;
  watchlistCount: number;
}

export interface FavoriteUpdatesOptions {
  ratingThreshold: number;
  daysBack: number;
  daysAhead: number;
  limit: number;
}

export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDate: Date | null;
  /** True when multiple episodes share the same air date (e.g. Netflix full-season drop). */
  isBatchRelease: boolean;
}

/**
 * A single item in the "Updates for Your Favorites" section.
 */
export interface FavoriteUpdateItem {
  mediaItemId: string;
  rating: number;
  mediaSummary: UserMediaSummary;
  latestEpisode: EpisodeInfo | null;
  nextEpisode: EpisodeInfo | null;
}

export interface IUserMediaStateRepository {
  upsert(data: UpsertUserMediaStateData): Promise<UserMediaState>;

  /**
   * Conditional update used to prevent TOCTOU races (issue #94, S-1).
   * Performs `UPDATE … WHERE state IN (fromStates) RETURNING *` atomically.
   *
   * @returns `{ previous, current }` on success, or `null` if the row does
   *   not exist or its state is not in `fromStates`.
   */
  updateStateIfIn(
    userId: string,
    mediaItemId: string,
    fromStates: ReadonlyArray<UserMediaState['state']>,
    toState: UserMediaState['state'],
  ): Promise<{ previous: UserMediaState['state']; current: UserMediaState } | null>;

  findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null>;

  delete(userId: string, mediaItemId: string): Promise<void>;

  listByUser(userId: string, limit?: number, offset?: number): Promise<UserMediaState[]>;

  findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]>;

  getStats(userId: string): Promise<UserMediaStats>;

  listWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
    options?: ListWithMediaOptions,
  ): Promise<
    Array<
      UserMediaState & {
        mediaSummary: UserMediaSummary;
        progressSummary?: ProgressSummary | null;
      }
    >
  >;

  /**
   * Lists "Continue" items with media summary.
   * Semantics: `progress IS NOT NULL`.
   */
  listContinueWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Array<UserMediaState & { mediaSummary: UserMediaSummary }>>;

  findOneWithMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<
    | (UserMediaState & {
        mediaSummary: UserMediaSummary;
        progressSummary?: ProgressSummary | null;
        continuePoint?: ContinuePoint | null;
      })
    | null
  >;

  /** Counts with identical filters to {@link listWithMedia} — keep WHERE clauses in sync. */
  countWithMedia(userId: string, options?: ListWithMediaOptions): Promise<number>;

  /**
   * Activity feed: states that are in-progress or have progress.
   * Semantics: state = 'watching' OR progress IS NOT NULL.
   */
  listActivityWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
    type?: MediaType,
  ): Promise<Array<UserMediaState & { mediaSummary: UserMediaSummary }>>;

  /** Counts with identical filters to {@link listActivityWithMedia} — keep WHERE clauses in sync. */
  countActivityWithMedia(userId: string, type?: MediaType): Promise<number>;

  /** Counts with identical filters to {@link listContinueWithMedia} — keep WHERE clauses in sync. */
  countContinueWithMedia(userId: string): Promise<number>;

  /** Finds all user states for a given media item with a specific state. */
  findByMediaAndState(
    mediaItemId: string,
    state: UserMediaState['state'],
  ): Promise<Array<{ userId: string }>>;

  /** Lists highly-rated shows with recent or upcoming episodes. */
  listFavoriteUpdates(
    userId: string,
    options: FavoriteUpdatesOptions,
  ): Promise<FavoriteUpdateItem[]>;

  /**
   * Bulk upsert user media states. Used for CSV imports.
   *
   * When `overwrite` is false, existing entries are left untouched (INSERT … ON CONFLICT DO NOTHING).
   * When `overwrite` is true, the state is updated only when the incoming state has a higher
   * priority than the existing one (no-downgrade rule) and the rating is always overwritten.
   *
   * Processes items in batches of 500 to stay within Postgres parameter limits.
   */
  bulkImport(
    userId: string,
    items: Array<{ mediaItemId: string; state: string; rating: number | null }>,
    overwrite: boolean,
  ): Promise<{ imported: number; skipped: number }>;
}
