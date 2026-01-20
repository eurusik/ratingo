import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { SavedItemsService } from '../../user-actions/application/saved-items.service';
import { SAVED_ITEM_LIST } from '../../user-actions/domain/entities';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import {
  EPISODE_PROGRESS_REPOSITORY,
  type IEpisodeProgressRepository,
  type SeasonProgressInfo,
} from '../domain/repositories/episode-progress.repository.interface';

import { UserMediaService } from './user-media.service';

/**
 * Application service for episode progress operations.
 *
 * Coordinates between episode progress tracking and user media state.
 * When an episode is marked as watched, automatically creates/updates
 * the user_media_state record with 'watching' state.
 */
@Injectable()
export class EpisodeProgressService {
  private readonly logger = new Logger(EpisodeProgressService.name);

  constructor(
    @Inject(EPISODE_PROGRESS_REPOSITORY)
    private readonly episodeProgressRepo: IEpisodeProgressRepository,
    private readonly userMediaService: UserMediaService,
    private readonly savedItemsService: SavedItemsService,
  ) {}

  /**
   * Marks an episode as watched and syncs user media state.
   *
   * @param {string} userId - User identifier
   * @param {string} episodeId - Episode identifier
   * @returns {Promise<void>}
   * @throws {NotFoundException} When episode is not found
   */
  async markWatched(userId: string, episodeId: string): Promise<void> {
    // Get episode info to find the mediaItemId and showId
    const episodeInfo = await this.episodeProgressRepo.getEpisodeMediaInfo(episodeId);

    if (!episodeInfo) {
      throw new NotFoundException(`Episode ${episodeId} not found`);
    }

    // Mark episode as watched
    await this.episodeProgressRepo.markWatched(userId, episodeId);

    // Get show progress to check if all episodes are watched
    const seasonProgress = await this.episodeProgressRepo.getShowProgress(
      userId,
      episodeInfo.showId,
    );
    const totalEpisodes = seasonProgress.reduce((sum, s) => sum + s.totalCount, 0);
    const watchedEpisodes = seasonProgress.reduce((sum, s) => sum + s.watchedCount, 0);

    const currentState = await this.userMediaService.getState(userId, episodeInfo.mediaItemId);

    // All episodes watched → auto-complete
    if (totalEpisodes > 0 && watchedEpisodes === totalEpisodes) {
      if (currentState?.state !== USER_MEDIA_STATE.COMPLETED) {
        await this.userMediaService.setState({
          userId,
          mediaItemId: episodeInfo.mediaItemId,
          state: USER_MEDIA_STATE.COMPLETED,
        });

        this.logger.log(
          `Auto-set user_media_state to 'completed' for user=${userId}, media=${episodeInfo.mediaItemId} (${watchedEpisodes}/${totalEpisodes} episodes)`,
        );
      }
      return;
    }

    // Not all watched → set to 'watching' if needed
    // Only auto-set to watching if:
    // - No state exists yet, OR
    // - Current state is 'planned' (user planned to watch, now they're actually watching)
    if (!currentState || currentState.state === USER_MEDIA_STATE.PLANNED) {
      await this.userMediaService.setState({
        userId,
        mediaItemId: episodeInfo.mediaItemId,
        state: USER_MEDIA_STATE.WATCHING,
      });

      // Remove from "for_later" saved list since user started watching
      await this.savedItemsService.unsaveItem(
        userId,
        episodeInfo.mediaItemId,
        SAVED_ITEM_LIST.FOR_LATER,
        'auto_started_watching',
      );

      this.logger.log(
        `Auto-set user_media_state to 'watching' for user=${userId}, media=${episodeInfo.mediaItemId}`,
      );
    }
  }

  /**
   * Marks an episode as unwatched.
   *
   * @param {string} userId - User identifier
   * @param {string} episodeId - Episode identifier
   * @returns {Promise<void>}
   */
  async markUnwatched(userId: string, episodeId: string): Promise<void> {
    // Get episode info before unmarking
    const episodeInfo = await this.episodeProgressRepo.getEpisodeMediaInfo(episodeId);

    await this.episodeProgressRepo.markUnwatched(userId, episodeId);

    if (!episodeInfo) return;

    // Check remaining progress
    const seasonProgress = await this.episodeProgressRepo.getShowProgress(
      userId,
      episodeInfo.showId,
    );
    const watchedEpisodes = seasonProgress.reduce((sum, s) => sum + s.watchedCount, 0);

    const currentState = await this.userMediaService.getState(userId, episodeInfo.mediaItemId);
    if (!currentState) return;

    // No episodes watched → remove from activity
    if (watchedEpisodes === 0) {
      await this.userMediaService.deleteState(userId, episodeInfo.mediaItemId);
      this.logger.log(
        `Removed user_media_state for user=${userId}, media=${episodeInfo.mediaItemId} (0 episodes watched)`,
      );
      return;
    }

    // Still some watched but was completed → revert to watching
    if (currentState.state === USER_MEDIA_STATE.COMPLETED) {
      await this.userMediaService.setState({
        userId,
        mediaItemId: episodeInfo.mediaItemId,
        state: USER_MEDIA_STATE.WATCHING,
      });

      this.logger.log(
        `Reverted user_media_state from 'completed' to 'watching' for user=${userId}, media=${episodeInfo.mediaItemId}`,
      );
    }
  }

  /**
   * Gets progress for all seasons of a show.
   *
   * @param {string} userId - User identifier
   * @param {string} showId - Show identifier (from shows table)
   * @returns {Promise<SeasonProgressInfo[]>} Progress per season
   */
  async getShowProgress(userId: string, showId: string): Promise<SeasonProgressInfo[]> {
    return this.episodeProgressRepo.getShowProgress(userId, showId);
  }
}
