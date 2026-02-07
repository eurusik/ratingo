import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';

import type { IRatingSyncPort } from '../../reviews/domain/ports/rating-sync.port';
import { CardEnrichmentService } from '../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../shared/cards/domain/card.constants';
import { USER_MEDIA_STATE_ERRORS } from '../domain/constants/user-media-state-errors.constants';
import { USER_MEDIA_STATE, type UserMediaState } from '../domain/entities/user-media-state.entity';
import { UserMediaRatingChangedEvent } from '../domain/events/user-media-rating-changed.event';
import {
  type IUserMediaStateRepository,
  type ListWithMediaOptions,
  USER_MEDIA_STATE_REPOSITORY,
  type UserMediaStats,
  type UpsertUserMediaStateData,
} from '../domain/repositories/user-media-state.repository.interface';

/**
 * Application service for user media state use cases.
 */
@Injectable()
export class UserMediaService implements IRatingSyncPort {
  private readonly logger = new Logger(UserMediaService.name);

  constructor(
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
    private readonly cards: CardEnrichmentService,
    private readonly eventEmitter: EventEmitter2,
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
  async setState(data: UpsertUserMediaStateData, mediaType?: MediaType): Promise<UserMediaState> {
    let resolvedState = data.state;

    if (resolvedState === undefined) {
      const existing = await this.repo.findOne(data.userId, data.mediaItemId);
      resolvedState =
        existing?.state ??
        (mediaType === MediaType.SHOW ? USER_MEDIA_STATE.WATCHING : USER_MEDIA_STATE.COMPLETED);
    }

    if (data.progress != null) {
      if (
        resolvedState === USER_MEDIA_STATE.COMPLETED ||
        resolvedState === USER_MEDIA_STATE.DROPPED
      ) {
        throw new BadRequestException(USER_MEDIA_STATE_ERRORS.PROGRESS_NOT_ALLOWED);
      }

      const result = await this.repo.upsert({ ...data, state: USER_MEDIA_STATE.WATCHING });
      if (data.rating != null) {
        this.emitRatingChanged(data.userId, data.mediaItemId, data.rating);
      }
      return result;
    }

    const result = await this.repo.upsert({ ...data, state: resolvedState });

    if (data.rating != null) {
      this.emitRatingChanged(data.userId, data.mediaItemId, data.rating);
    }

    return result;
  }

  /**
   * Syncs a rating from an external aggregate (e.g. reviews).
   * Implements IRatingSyncPort.
   *
   * Bypasses setState() to avoid emitting events — the source aggregate
   * (reviews) already has the correct rating.
   *
   * @param mediaType - When provided, allows the correct default state
   *   to be chosen for first-time entries (`watching` for shows,
   *   `completed` for movies).
   */
  async syncRating(
    userId: string,
    mediaItemId: string,
    rating: number,
    mediaType?: MediaType,
  ): Promise<void> {
    const existing = await this.repo.findOne(userId, mediaItemId);
    const resolvedState =
      existing?.state ??
      (mediaType === MediaType.SHOW ? USER_MEDIA_STATE.WATCHING : USER_MEDIA_STATE.COMPLETED);

    await this.repo.upsert({ userId, mediaItemId, rating, state: resolvedState });
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
   * Deletes user media state.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<void>}
   */
  async deleteState(userId: string, mediaItemId: string): Promise<void> {
    await this.repo.delete(userId, mediaItemId);
    this.logger.log(`Deleted user_media_state for user=${userId}, media=${mediaItemId}`);
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
  async getStateWithMedia(userId: string, mediaItemId: string) {
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
  async list(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0): Promise<UserMediaState[]> {
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
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
    options?: ListWithMediaOptions,
  ) {
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
  async listContinueWithMedia(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0) {
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
  async listActivityWithMedia(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0) {
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

  /**
   * Pauses a media item.
   *
   * Can only pause items that are currently being watched (have progress).
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaState>} Updated state
   * @throws {BadRequestException} When item has no progress or is not in watching state
   */
  async pauseMedia(userId: string, mediaItemId: string): Promise<UserMediaState> {
    const currentState = await this.repo.findOne(userId, mediaItemId);

    if (!currentState) {
      throw new BadRequestException(USER_MEDIA_STATE_ERRORS.CANNOT_PAUSE_NO_STATE);
    }

    if (currentState.state !== USER_MEDIA_STATE.WATCHING) {
      throw new BadRequestException(USER_MEDIA_STATE_ERRORS.CANNOT_PAUSE_NOT_WATCHING);
    }

    return this.repo.upsert({
      userId,
      mediaItemId,
      state: USER_MEDIA_STATE.PAUSED,
    });
  }

  /**
   * Resumes a paused media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaState>} Updated state
   * @throws {BadRequestException} When item is not paused
   */
  async resumeMedia(userId: string, mediaItemId: string): Promise<UserMediaState> {
    const currentState = await this.repo.findOne(userId, mediaItemId);

    if (!currentState) {
      throw new BadRequestException(USER_MEDIA_STATE_ERRORS.CANNOT_RESUME_NO_STATE);
    }

    if (currentState.state !== USER_MEDIA_STATE.PAUSED) {
      throw new BadRequestException(USER_MEDIA_STATE_ERRORS.CANNOT_RESUME_NOT_PAUSED);
    }

    return this.repo.upsert({
      userId,
      mediaItemId,
      state: USER_MEDIA_STATE.WATCHING,
    });
  }

  /**
   * Lists paused items with media summary.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<Array>} Paused items with media summary
   */
  async listPausedWithMedia(userId: string, limit = DEFAULT_PAGE_SIZE, offset = 0) {
    const items = await this.repo.listWithMedia(userId, limit, offset, {
      states: [USER_MEDIA_STATE.PAUSED],
    });
    return this.cards.enrichUserMedia(items, { context: CARD_LIST_CONTEXT.USER_LIBRARY });
  }

  /**
   * Counts paused items.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Total paused items
   */
  async countPausedWithMedia(userId: string): Promise<number> {
    return this.repo.countWithMedia(userId, { states: [USER_MEDIA_STATE.PAUSED] });
  }

  private emitRatingChanged(userId: string, mediaItemId: string, rating: number): void {
    this.eventEmitter.emit(
      UserMediaRatingChangedEvent.eventName,
      new UserMediaRatingChangedEvent(userId, mediaItemId, rating),
    );
  }
}
