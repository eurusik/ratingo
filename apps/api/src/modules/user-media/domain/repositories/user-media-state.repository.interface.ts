/**
 * Injection token for user media state repository.
 */
export const USER_MEDIA_STATE_REPOSITORY = Symbol('USER_MEDIA_STATE_REPOSITORY');

import { UserMediaState } from '../entities/user-media-state.entity';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

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
 * Repository contract for user-media state operations.
 */
export interface IUserMediaStateRepository {
  upsert(data: UpsertUserMediaStateData): Promise<UserMediaState>;
  findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null>;
  listByUser(userId: string, limit?: number, offset?: number): Promise<UserMediaState[]>;
  findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]>;

  /**
   * Returns user media states with attached media summary (id, type, title, slug, poster).
   */
  listWithMedia(
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
        };
      })
    | null
  >;
}
