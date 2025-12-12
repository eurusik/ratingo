/**
 * Injection token for user media state repository.
 */
export const USER_MEDIA_STATE_REPOSITORY = Symbol('USER_MEDIA_STATE_REPOSITORY');

import { UserMediaState } from '../entities/user-media-state.entity';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

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
}

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

/**
 * Repository contract for user-media state operations.
 */
export interface IUserMediaStateRepository {
  upsert(data: UpsertUserMediaStateData): Promise<UserMediaState>;
  findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null>;
  listByUser(userId: string, limit?: number, offset?: number): Promise<UserMediaState[]>;
  findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]>;

  /**
   * Aggregated stats for user profile.
   */
  getStats(userId: string): Promise<UserMediaStats>;

  /**
   * Returns user media states with attached media summary (id, type, title, slug, poster).
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
   * Returns a single state with media summary.
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
}
