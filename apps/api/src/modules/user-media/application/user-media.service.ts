import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUserMediaStateRepository,
  ListWithMediaOptions,
  USER_MEDIA_STATE_REPOSITORY,
  UserMediaStats,
  UpsertUserMediaStateData,
} from '../domain/repositories/user-media-state.repository.interface';
import { USER_MEDIA_STATE, UserMediaState } from '../domain/entities/user-media-state.entity';
import { MediaType } from '../../../common/enums/media-type.enum';
import { ImageDto } from '../../catalog/presentation/dtos/common.dto';
import { CardEnrichmentService } from '../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../shared/cards/domain/card.constants';

/**
 * Application service for user media state use cases.
 */
@Injectable()
export class UserMediaService {
  private readonly logger = new Logger(UserMediaService.name);

  constructor(
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
    private readonly cards: CardEnrichmentService,
  ) {}

  /**
   * Upserts state for a media item.
   *
   * Enforces a data invariant for progress:
   * - If `progress` is provided, the persisted state is always `watching`.
   * - If `progress` is provided with `completed` or `dropped`, the request is rejected.
   *
   * @param {UpsertUserMediaStateData} data - Upsert payload
   * @returns {Promise<UserMediaState>} Persisted state
   * @throws {BadRequestException} When `progress` is provided for `completed`/`dropped` states
   */
  async setState(data: UpsertUserMediaStateData): Promise<UserMediaState> {
    if (data.progress != null) {
      if (data.state === USER_MEDIA_STATE.COMPLETED || data.state === USER_MEDIA_STATE.DROPPED) {
        throw new BadRequestException('progress is not allowed for completed/dropped states');
      }

      return this.repo.upsert({ ...data, state: USER_MEDIA_STATE.WATCHING });
    }

    return this.repo.upsert(data);
  }

  /**
   * Gets state for a single media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaState | null>} State or null
   */
  async getState(userId: string, mediaItemId: string): Promise<UserMediaState | null> {
    return this.repo.findOne(userId, mediaItemId);
  }

  /**
   * Gets state with media summary.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<
   *   | (UserMediaState & {
   *       mediaSummary: {
   *         id: string;
   *         type: MediaType;
   *         title: string;
   *         slug: string;
   *         poster: ImageDto | null;
   *         releaseDate?: Date | null;
   *       };
   *     })
   *   | null
   * >} State with media summary or null
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
          releaseDate?: Date | null;
        };
      })
    | null
  > {
    const item = await this.repo.findOneWithMedia(userId, mediaItemId);
    if (!item) return null;
    return this.cards.enrichUserMedia([item])[0];
  }

  /**
   * Lists states for user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<UserMediaState[]>} States
   */
  async list(userId: string, limit = 20, offset = 0): Promise<UserMediaState[]> {
    return this.repo.listByUser(userId, limit, offset);
  }

  /**
   * Lists states with media summary.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {ListWithMediaOptions} options - List options
   * @returns {Promise<
   *   Array<
   *     UserMediaState & {
   *       mediaSummary: {
   *         id: string;
   *         type: MediaType;
   *         title: string;
   *         slug: string;
   *         poster: ImageDto | null;
   *         releaseDate?: Date | null;
   *       };
   *     }
   *   >
   * >} List of states with media summary
   */
  async listWithMedia(
    userId: string,
    limit = 20,
    offset = 0,
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
  > {
    const items = await this.repo.listWithMedia(userId, limit, offset, options);
    return this.cards.enrichUserMedia(items, { context: CARD_LIST_CONTEXT.USER_LIBRARY });
  }

  /**
   * Lists "Continue" items for the current user.
   *
   * Semantics: `progress IS NOT NULL`.
   * The returned items are enriched with card metadata using `CONTINUE_LIST` context.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<any[]>} Continue items with media summary
   */
  async listContinueWithMedia(userId: string, limit = 20, offset = 0) {
    const items = await this.repo.listContinueWithMedia(userId, limit, offset);
    return this.cards.enrichUserMedia(items, { context: CARD_LIST_CONTEXT.CONTINUE_LIST });
  }

  /**
   * Counts "Continue" items for the current user.
   *
   * Semantics: `progress IS NOT NULL`.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total continue items
   */
  async countContinueWithMedia(userId: string): Promise<number> {
    return this.repo.countContinueWithMedia(userId);
  }

  /**
   * Counts list items using the same filters as listWithMedia.
   *
   * @param {string} userId - User identifier
   * @param {ListWithMediaOptions} options - List options
   * @returns {Promise<number>} Total items
   */
  async countWithMedia(userId: string, options?: ListWithMediaOptions): Promise<number> {
    return this.repo.countWithMedia(userId, options);
  }

  /**
   * Lists activity items with media summary.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<any[]>} Activity list items
   */
  async listActivityWithMedia(userId: string, limit = 20, offset = 0) {
    const items = await this.repo.listActivityWithMedia(userId, limit, offset);
    return this.cards.enrichUserMedia(items);
  }

  /**
   * Counts activity items.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total activity items
   */
  async countActivityWithMedia(userId: string): Promise<number> {
    return this.repo.countActivityWithMedia(userId);
  }

  /**
   * Finds states for multiple media IDs.
   *
   * @param {string} userId - User identifier
   * @param {string[]} mediaItemIds - Media item identifiers
   * @returns {Promise<UserMediaState[]>} States
   */
  async findMany(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]> {
    return this.repo.findManyByMediaIds(userId, mediaItemIds);
  }

  /**
   * Aggregated stats for user profile.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<UserMediaStats>} Aggregated stats
   */
  async getStats(userId: string): Promise<UserMediaStats> {
    return this.repo.getStats(userId);
  }
}
