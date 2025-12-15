import { UserMediaState } from '../entities/user-media-state.entity';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

/**
 * Injection token for user media state repository.
 */
export const USER_MEDIA_STATE_REPOSITORY = Symbol('USER_MEDIA_STATE_REPOSITORY');

/**
 * Sort options for user media lists.
 */
export const USER_MEDIA_LIST_SORT = {
  RECENT: 'recent',
  RATING: 'rating',
  RELEASE_DATE: 'releaseDate',
} as const;
export type UserMediaListSort = (typeof USER_MEDIA_LIST_SORT)[keyof typeof USER_MEDIA_LIST_SORT];

/**
 * Defines filtering and sorting options for listWithMedia.
 */
export interface ListWithMediaOptions {
  ratedOnly?: boolean;
  states?: Array<UserMediaState['state']>;
  sort?: UserMediaListSort;
}

/**
 * Defines payload for upserting a user media state.
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

/**
 * Aggregated stats for user profile sections.
 */
export interface UserMediaStats {
  moviesRated: number;
  showsRated: number;
  watchlistCount: number;
}

/**
 * Repository contract for user-media state operations.
 */
export interface IUserMediaStateRepository {
  /**
   * Upserts user media state.
   *
   * @param {UpsertUserMediaStateData} data - Upsert payload
   * @returns {Promise<UserMediaState>} Persisted state
   */
  upsert(data: UpsertUserMediaStateData): Promise<UserMediaState>;

  /**
   * Finds state for a user and media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaState | null>} State or null
   */
  findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null>;

  /**
   * Lists states by user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<UserMediaState[]>} States
   */
  listByUser(userId: string, limit?: number, offset?: number): Promise<UserMediaState[]>;

  /**
   * Finds states for multiple media IDs.
   *
   * @param {string} userId - User identifier
   * @param {string[]} mediaItemIds - Media item identifiers
   * @returns {Promise<UserMediaState[]>} States
   */
  findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]>;

  /**
   * Aggregated stats for user profile.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<UserMediaStats>} Aggregated stats
   */
  getStats(userId: string): Promise<UserMediaStats>;

  /**
   * Returns user media states with attached media summary (id, type, title, slug, poster).
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {ListWithMediaOptions} options - Filtering and sorting options
   * @returns {Promise<Array<UserMediaState & { mediaSummary: { id: string; type: MediaType; title: string; slug: string; poster: ImageDto | null; releaseDate?: Date | null } }>>} States with media summary
   */
  listWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
    options?: ListWithMediaOptions,
  ): Promise<
    Array<
      UserMediaState & {
        mediaSummary: {
          id: string;
          type: MediaType;
          title: string;
          slug: string;
          poster: ImageDto | null;
          releaseDate?: Date | null;
        };
      }
    >
  >;

  /**
   * Lists "Continue" items with media summary.
   *
   * Semantics: `progress IS NOT NULL`.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<Array<UserMediaState & { mediaSummary: { id: string; type: MediaType; title: string; slug: string; poster: ImageDto | null; releaseDate?: Date | null } }>>} Continue items
   */
  listContinueWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<
    Array<
      UserMediaState & {
        mediaSummary: {
          id: string;
          type: MediaType;
          title: string;
          slug: string;
          poster: ImageDto | null;
          releaseDate?: Date | null;
        };
      }
    >
  >;

  /**
   * Returns a single state with media summary.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<(UserMediaState & { mediaSummary: { id: string; type: MediaType; title: string; slug: string; poster: ImageDto | null; releaseDate?: Date | null } }) | null>} State with media summary or null
   */
  findOneWithMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<
    | (UserMediaState & {
        mediaSummary: {
          id: string;
          type: MediaType;
          title: string;
          slug: string;
          poster: ImageDto | null;
          releaseDate?: Date | null;
        };
      })
    | null
  >;

  /**
   * Total count for listWithMedia with the same filters (ratedOnly, states).
   *
   * @param {string} userId - User identifier
   * @param {ListWithMediaOptions} options - Filtering options
   * @returns {Promise<number>} Total items
   */
  countWithMedia(userId: string, options?: ListWithMediaOptions): Promise<number>;

  /**
   * Activity feed: states that are in-progress or have progress.
   * Semantics: state = 'watching' OR progress IS NOT NULL.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<Array<UserMediaState & { mediaSummary: { id: string; type: MediaType; title: string; slug: string; poster: ImageDto | null; releaseDate?: Date | null } }>>} Activity items
   */
  listActivityWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<
    Array<
      UserMediaState & {
        mediaSummary: {
          id: string;
          type: MediaType;
          title: string;
          slug: string;
          poster: ImageDto | null;
          releaseDate?: Date | null;
        };
      }
    >
  >;

  /**
   * Counts activity items.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total activity items
   */
  countActivityWithMedia(userId: string): Promise<number>;

  /**
   * Counts "Continue" items.
   *
   * Semantics: `progress IS NOT NULL`.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total continue items
   */
  countContinueWithMedia(userId: string): Promise<number>;
}
