import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { SavedItemsService } from '../../user-actions/application/saved-items.service';
import { SubscriptionsService } from '../../user-actions/application/subscriptions.service';
import { SAVED_ITEM_LIST } from '../../user-actions/domain/entities';
import {
  EPISODE_PROGRESS_ERRORS,
  UNSAVE_CONTEXT,
} from '../domain/constants/episode-progress.constants';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import {
  EPISODE_PROGRESS_REPOSITORY,
  type IEpisodeProgressRepository,
  type SeasonProgressInfo,
} from '../domain/repositories/episode-progress.repository.interface';

import { UserMediaService } from './user-media.service';

@Injectable()
export class EpisodeProgressService {
  private readonly logger = new Logger(EpisodeProgressService.name);

  constructor(
    @Inject(EPISODE_PROGRESS_REPOSITORY)
    private readonly episodeProgressRepo: IEpisodeProgressRepository,
    private readonly userMediaService: UserMediaService,
    private readonly savedItemsService: SavedItemsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async markWatched(userId: string, episodeId: string): Promise<void> {
    const episodeInfo = await this.episodeProgressRepo.getEpisodeMediaInfo(episodeId);

    if (!episodeInfo) {
      throw new NotFoundException(EPISODE_PROGRESS_ERRORS.NOT_FOUND(episodeId));
    }

    await this.episodeProgressRepo.markWatched(userId, episodeId);
    await this.trySyncState(
      () => this.syncStateAfterWatch(userId, episodeInfo.showId, episodeInfo.mediaItemId),
      `sync state after watch: user=${userId}, media=${episodeInfo.mediaItemId}`,
    );
  }

  async markBatchWatched(userId: string, episodeIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(episodeIds)];
    const { showId, mediaItemId } = await this.validateBatchAndGetInfo(uniqueIds);
    await this.episodeProgressRepo.markManyWatched(userId, uniqueIds);
    await this.trySyncState(
      () => this.syncStateAfterWatch(userId, showId, mediaItemId),
      `sync state after batch watch: user=${userId}, media=${mediaItemId}`,
    );
  }

  async markUnwatched(userId: string, episodeId: string): Promise<void> {
    const episodeInfo = await this.episodeProgressRepo.getEpisodeMediaInfo(episodeId);
    await this.episodeProgressRepo.markUnwatched(userId, episodeId);
    if (!episodeInfo) return;

    await this.trySyncState(
      () => this.syncStateAfterUnwatch(userId, episodeInfo.showId, episodeInfo.mediaItemId),
      `sync state after unwatch: user=${userId}, media=${episodeInfo.mediaItemId}`,
    );
  }

  async markBatchUnwatched(userId: string, episodeIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(episodeIds)];
    const { showId, mediaItemId } = await this.validateBatchAndGetInfo(uniqueIds);
    await this.episodeProgressRepo.markManyUnwatched(userId, uniqueIds);
    await this.trySyncState(
      () => this.syncStateAfterUnwatch(userId, showId, mediaItemId),
      `sync state after batch unwatch: user=${userId}, media=${mediaItemId}`,
    );
  }

  async getShowProgress(userId: string, showId: string): Promise<SeasonProgressInfo[]> {
    return this.episodeProgressRepo.getShowProgress(userId, showId);
  }

  private async trySyncState(fn: () => Promise<void>, context: string): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn(`Failed to ${context}`, error instanceof Error ? error.message : error);
    }
  }

  private async validateBatchAndGetInfo(
    episodeIds: string[],
  ): Promise<{ showId: string; mediaItemId: string }> {
    if (episodeIds.length === 0) {
      throw new BadRequestException(EPISODE_PROGRESS_ERRORS.EMPTY_BATCH);
    }

    const episodeInfo = await this.episodeProgressRepo.getEpisodeMediaInfo(episodeIds[0]);

    if (!episodeInfo) {
      throw new NotFoundException(EPISODE_PROGRESS_ERRORS.NOT_FOUND(episodeIds[0]));
    }

    if (episodeIds.length > 1) {
      const { existingCount, distinctShowCount } =
        await this.episodeProgressRepo.validateEpisodeBatch(episodeIds);

      if (existingCount !== episodeIds.length) {
        throw new BadRequestException(
          EPISODE_PROGRESS_ERRORS.PARTIAL_NOT_FOUND(episodeIds.length, existingCount),
        );
      }

      if (distinctShowCount !== 1) {
        throw new BadRequestException(EPISODE_PROGRESS_ERRORS.DIFFERENT_SHOWS);
      }
    }

    return { showId: episodeInfo.showId, mediaItemId: episodeInfo.mediaItemId };
  }

  /**
   * Auto-completes if all episodes watched (even if paused),
   * auto-starts watching if no state or planned.
   */
  private async syncStateAfterWatch(
    userId: string,
    showId: string,
    mediaItemId: string,
  ): Promise<void> {
    const seasonProgress = await this.episodeProgressRepo.getShowProgress(userId, showId);
    const totalEpisodes = seasonProgress.reduce((sum, s) => sum + s.totalCount, 0);
    const watchedEpisodes = seasonProgress.reduce((sum, s) => sum + s.watchedCount, 0);

    const currentState = await this.userMediaService.getState(userId, mediaItemId);

    // Auto-complete even if paused — this is the only state override
    if (totalEpisodes > 0 && watchedEpisodes === totalEpisodes) {
      if (currentState?.state !== USER_MEDIA_STATE.COMPLETED) {
        await this.userMediaService.setState({
          userId,
          mediaItemId,
          state: USER_MEDIA_STATE.COMPLETED,
        });
        this.logger.log(
          `Auto-set user_media_state to 'completed' for user=${userId}, media=${mediaItemId} (${watchedEpisodes}/${totalEpisodes} episodes)`,
        );
      }
      await this.tryAutoSubscribe(userId, mediaItemId);
      return;
    }

    // Paused → user must explicitly resume
    if (currentState?.state === USER_MEDIA_STATE.PAUSED) return;

    // Auto-subscribe for every non-paused watch event (idempotent)
    await this.tryAutoSubscribe(userId, mediaItemId);

    if (!currentState || currentState.state === USER_MEDIA_STATE.PLANNED) {
      await this.userMediaService.setState({
        userId,
        mediaItemId,
        state: USER_MEDIA_STATE.WATCHING,
      });

      await this.savedItemsService.unsaveItem(
        userId,
        mediaItemId,
        SAVED_ITEM_LIST.FOR_LATER,
        UNSAVE_CONTEXT.AUTO_STARTED_WATCHING,
      );

      this.logger.log(
        `Auto-set user_media_state to 'watching' for user=${userId}, media=${mediaItemId}`,
      );
    }
  }

  /**
   * Attempts to auto-subscribe the user to new_season / new_episode
   * notifications for the show. Failures are logged and swallowed.
   */
  private async tryAutoSubscribe(userId: string, mediaItemId: string): Promise<void> {
    try {
      await this.subscriptionsService.autoSubscribeForShow(userId, mediaItemId);
    } catch (error) {
      this.logger.warn(
        `Auto-subscribe failed: user=${userId}, media=${mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** Removes state if 0 watched, reverts completed → watching if some remain. */
  private async syncStateAfterUnwatch(
    userId: string,
    showId: string,
    mediaItemId: string,
  ): Promise<void> {
    const seasonProgress = await this.episodeProgressRepo.getShowProgress(userId, showId);
    const watchedEpisodes = seasonProgress.reduce((sum, s) => sum + s.watchedCount, 0);

    const currentState = await this.userMediaService.getState(userId, mediaItemId);
    if (!currentState) return;

    if (watchedEpisodes === 0) {
      await this.userMediaService.deleteState(userId, mediaItemId);
      this.logger.log(
        `Removed user_media_state for user=${userId}, media=${mediaItemId} (0 episodes watched)`,
      );
      return;
    }

    // Was completed but now missing episodes → revert
    if (currentState.state === USER_MEDIA_STATE.COMPLETED) {
      await this.userMediaService.setState({
        userId,
        mediaItemId,
        state: USER_MEDIA_STATE.WATCHING,
      });
      this.logger.log(
        `Reverted user_media_state from 'completed' to 'watching' for user=${userId}, media=${mediaItemId}`,
      );
    }
  }
}
