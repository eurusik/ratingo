import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
  UpsertUserMediaStateData,
} from '../domain/repositories/user-media-state.repository.interface';
import { UserMediaState } from '../domain/entities/user-media-state.entity';
import { MediaType } from '../../../common/enums/media-type.enum';
import { ImageDto } from '../../catalog/presentation/dtos/common.dto';

/**
 * Application service for user media state use cases.
 */
@Injectable()
export class UserMediaService {
  private readonly logger = new Logger(UserMediaService.name);

  constructor(
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
  ) {}

  /**
   * Upserts state for a media item.
   *
   * @param {UpsertUserMediaStateData} data - Payload
   * @returns {Promise<UserMediaState>} Persisted state
   */
  async setState(data: UpsertUserMediaStateData): Promise<UserMediaState> {
    return this.repo.upsert(data);
  }

  /**
   * Gets state for a single media item.
   *
   * @param {string} userId - User id
   * @param {string} mediaItemId - Media id
   * @returns {Promise<UserMediaState | null>} State or null
   */
  async getState(userId: string, mediaItemId: string): Promise<UserMediaState | null> {
    return this.repo.findOne(userId, mediaItemId);
  }

  /**
   * Gets state with media summary.
   */
  async getStateWithMedia(
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
  > {
    return this.repo.findOneWithMedia(userId, mediaItemId);
  }

  /**
   * Lists states for user.
   *
   * @param {string} userId - User id
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<UserMediaState[]>} States
   */
  async list(userId: string, limit = 20, offset = 0): Promise<UserMediaState[]> {
    return this.repo.listByUser(userId, limit, offset);
  }

  /**
   * Lists states with media summary.
   */
  async listWithMedia(
    userId: string,
    limit = 20,
    offset = 0,
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
  > {
    return this.repo.listWithMedia(userId, limit, offset);
  }

  /**
   * Finds states for multiple media IDs.
   *
   * @param {string} userId - User id
   * @param {string[]} mediaItemIds - Media ids
   * @returns {Promise<UserMediaState[]>} States
   */
  async findMany(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]> {
    return this.repo.findManyByMediaIds(userId, mediaItemIds);
  }
}
