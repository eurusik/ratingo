import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SavedItemsService } from '../../user-actions/application/saved-items.service';
import { SubscriptionsService } from '../../user-actions/application/subscriptions.service';
import { SAVED_ITEM_LIST } from '../../user-actions/domain/entities';
import { UNSAVE_CONTEXT } from '../domain/constants/episode-progress.constants';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import { SHOW_STATUS_PORT, type IShowStatusPort } from '../domain/ports/show-status.port';
import {
  EPISODE_PROGRESS_REPOSITORY,
  type IEpisodeProgressRepository,
  type EpisodeMediaInfo,
  type SeasonProgressInfo,
} from '../domain/repositories/episode-progress.repository.interface';
import { EpisodeProgressService } from './episode-progress.service';
import { UserMediaService } from './user-media.service';

describe('EpisodeProgressService', () => {
  let service: EpisodeProgressService;

  const mockEpisodeProgressRepo: jest.Mocked<IEpisodeProgressRepository> = {
    markWatched: jest.fn(),
    markUnwatched: jest.fn(),
    markManyWatched: jest.fn(),
    markManyUnwatched: jest.fn(),
    getWatchedEpisodeIds: jest.fn(),
    getShowProgress: jest.fn(),
    validateEpisodeBatch: jest.fn(),
    getEpisodeMediaInfo: jest.fn(),
  };

  const mockUserMediaService = {
    getState: jest.fn(),
    setState: jest.fn(),
    deleteState: jest.fn(),
  };

  const mockSavedItemsService = {
    unsaveItem: jest.fn(),
  };

  const mockSubscriptionsService = {
    autoSubscribeForShow: jest.fn().mockResolvedValue(undefined),
  };

  const mockShowStatusPort: jest.Mocked<IShowStatusPort> = {
    isOngoing: jest.fn().mockResolvedValue(false),
  };

  const episodeInfo: EpisodeMediaInfo = {
    episodeId: 'ep-1',
    showId: 'show-1',
    mediaItemId: 'media-1',
    seasonNumber: 1,
    episodeNumber: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpisodeProgressService,
        { provide: EPISODE_PROGRESS_REPOSITORY, useValue: mockEpisodeProgressRepo },
        { provide: SHOW_STATUS_PORT, useValue: mockShowStatusPort },
        { provide: UserMediaService, useValue: mockUserMediaService },
        { provide: SavedItemsService, useValue: mockSavedItemsService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get(EpisodeProgressService);
    jest.clearAllMocks();
    mockShowStatusPort.isOngoing.mockResolvedValue(false);
    // Default: all episodes belong to one show and all exist
    mockEpisodeProgressRepo.validateEpisodeBatch.mockImplementation(async (ids: string[]) =>
      Promise.resolve({ existingCount: ids.length, distinctShowCount: 1 }),
    );
  });

  describe('markWatched', () => {
    it('should throw NotFoundException when episode not found', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(null);

      await expect(service.markWatched('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark episode as watched', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: ['ep-1'] },
      ]);
      mockUserMediaService.getState.mockResolvedValue(null);

      await service.markWatched('user-1', 'ep-1');

      expect(mockEpisodeProgressRepo.markWatched).toHaveBeenCalledWith('user-1', 'ep-1');
    });

    describe('auto-state transitions', () => {
      it('should set state to "watching" when first episode is marked (no previous state)', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: ['ep-1'] },
        ]);
        mockUserMediaService.getState.mockResolvedValue(null);

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.WATCHING,
        });
        expect(mockSavedItemsService.unsaveItem).toHaveBeenCalledWith(
          'user-1',
          'media-1',
          SAVED_ITEM_LIST.FOR_LATER,
          UNSAVE_CONTEXT.AUTO_STARTED_WATCHING,
        );
      });

      it('should set state to "watching" when marking episode and current state is "planned"', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: ['ep-1'] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.PLANNED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.WATCHING,
        });
        expect(mockSavedItemsService.unsaveItem).toHaveBeenCalledWith(
          'user-1',
          'media-1',
          SAVED_ITEM_LIST.FOR_LATER,
          UNSAVE_CONTEXT.AUTO_STARTED_WATCHING,
        );
      });

      it('should call auto-subscribe when state transitions to watching (no previous state)', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: ['ep-1'] },
        ]);
        mockUserMediaService.getState.mockResolvedValue(null);

        await service.markWatched('user-1', 'ep-1');

        expect(mockSubscriptionsService.autoSubscribeForShow).toHaveBeenCalledWith(
          'user-1',
          'media-1',
        );
      });

      it('should call auto-subscribe when state transitions from planned to watching', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: ['ep-1'] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.PLANNED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockSubscriptionsService.autoSubscribeForShow).toHaveBeenCalledWith(
          'user-1',
          'media-1',
        );
      });

      it('should not throw when auto-subscribe fails', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: ['ep-1'] },
        ]);
        mockUserMediaService.getState.mockResolvedValue(null);
        mockSubscriptionsService.autoSubscribeForShow.mockRejectedValue(new Error('Sub error'));

        await expect(service.markWatched('user-1', 'ep-1')).resolves.toBeUndefined();
        expect(mockEpisodeProgressRepo.markWatched).toHaveBeenCalledWith('user-1', 'ep-1');
      });

      it('should call auto-subscribe when user completes show (last episode)', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markWatched('user-1', 'ep-1');

        expect(mockSubscriptionsService.autoSubscribeForShow).toHaveBeenCalledWith(
          'user-1',
          'media-1',
        );
      });

      it('should NOT call auto-subscribe when user is paused', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.PAUSED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockSubscriptionsService.autoSubscribeForShow).not.toHaveBeenCalled();
      });

      it('should call auto-subscribe when already watching', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markWatched('user-1', 'ep-1');

        expect(mockSubscriptionsService.autoSubscribeForShow).toHaveBeenCalledWith(
          'user-1',
          'media-1',
        );
      });

      it('should NOT change state when marking episode and current state is "watching"', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
        expect(mockSavedItemsService.unsaveItem).not.toHaveBeenCalled();
      });

      it('should NOT change state when marking episode and current state is "dropped"', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.DROPPED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
        expect(mockSavedItemsService.unsaveItem).not.toHaveBeenCalled();
      });

      it('should NOT change state when marking episode and current state is "paused" (user must explicitly resume)', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.PAUSED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
        expect(mockSavedItemsService.unsaveItem).not.toHaveBeenCalled();
      });

      it('should auto-complete when all episodes are watched', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.COMPLETED,
        });
      });

      it('should auto-complete across multiple seasons', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
          { seasonNumber: 2, watchedCount: 8, totalCount: 8, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.COMPLETED,
        });
      });

      it('should NOT auto-complete when already completed', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.COMPLETED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
      });

      it('should not throw when state sync fails after single watch', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockRejectedValue(new Error('DB error'));

        await expect(service.markWatched('user-1', 'ep-1')).resolves.toBeUndefined();

        expect(mockEpisodeProgressRepo.markWatched).toHaveBeenCalledWith('user-1', 'ep-1');
      });

      it('should auto-complete when all episodes are watched while paused', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.PAUSED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.COMPLETED,
        });
      });

      it('should set caught_up when all episodes watched and show is ongoing', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });
        mockShowStatusPort.isOngoing.mockResolvedValue(true);

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.CAUGHT_UP,
        });
      });

      it('should NOT set caught_up when already caught_up', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.CAUGHT_UP });
        mockShowStatusPort.isOngoing.mockResolvedValue(true);

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
      });

      it('should transition caught_up to watching when new episodes exist and user watches one', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 8, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.CAUGHT_UP });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.WATCHING,
        });
      });

      it('should set caught_up when all AIRED episodes watched (future episodes excluded by repo)', async () => {
        // Simulates: show has 30 total eps, but only 27 aired. Repo returns only aired.
        // User watched all 27 aired → caught_up (not "watching 27/30")
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 15, totalCount: 15, watchedEpisodeIds: [] },
          { seasonNumber: 2, watchedCount: 12, totalCount: 12, watchedEpisodeIds: [] },
          // S2 has 3 more eps in DB but air_date > NOW() — repo excludes them
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });
        mockShowStatusPort.isOngoing.mockResolvedValue(true);

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.CAUGHT_UP,
        });
        expect(mockShowStatusPort.isOngoing).toHaveBeenCalledWith('show-1');
      });
    });
  });

  describe('markBatchWatched', () => {
    it('should throw NotFoundException when first episode not found', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(null);

      await expect(service.markBatchWatched('user-1', ['non-existent'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call markManyWatched with all episode IDs', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 3, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue(null);

      await service.markBatchWatched('user-1', ['ep-1', 'ep-2', 'ep-3']);

      expect(mockEpisodeProgressRepo.markManyWatched).toHaveBeenCalledWith('user-1', [
        'ep-1',
        'ep-2',
        'ep-3',
      ]);
    });

    it('should run state transition logic only once for the batch', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 3, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue(null);

      await service.markBatchWatched('user-1', ['ep-1', 'ep-2', 'ep-3']);

      expect(mockEpisodeProgressRepo.getShowProgress).toHaveBeenCalledTimes(1);
      expect(mockUserMediaService.getState).toHaveBeenCalledTimes(1);
    });

    it('should auto-set to watching when no previous state', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue(null);

      await service.markBatchWatched('user-1', ['ep-1', 'ep-2']);

      expect(mockUserMediaService.setState).toHaveBeenCalledWith({
        userId: 'user-1',
        mediaItemId: 'media-1',
        state: USER_MEDIA_STATE.WATCHING,
      });
    });

    it('should auto-complete when all episodes watched', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 10, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

      await service.markBatchWatched('user-1', ['ep-1', 'ep-2']);

      expect(mockUserMediaService.setState).toHaveBeenCalledWith({
        userId: 'user-1',
        mediaItemId: 'media-1',
        state: USER_MEDIA_STATE.COMPLETED,
      });
    });

    it('should NOT change state when paused (unless all watched)', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.PAUSED });

      await service.markBatchWatched('user-1', ['ep-1', 'ep-2']);

      expect(mockUserMediaService.setState).not.toHaveBeenCalled();
    });

    it('should not throw when state sync fails after batch watch', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockRejectedValue(new Error('DB error'));

      await expect(service.markBatchWatched('user-1', ['ep-1', 'ep-2'])).resolves.toBeUndefined();

      expect(mockEpisodeProgressRepo.markManyWatched).toHaveBeenCalledWith('user-1', [
        'ep-1',
        'ep-2',
      ]);
    });

    it('should throw BadRequestException when some episodes do not exist', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.validateEpisodeBatch.mockResolvedValue({
        existingCount: 1,
        distinctShowCount: 1,
      });

      await expect(service.markBatchWatched('user-1', ['ep-1', 'nonexistent-ep'])).rejects.toThrow(
        BadRequestException,
      );

      expect(mockEpisodeProgressRepo.markManyWatched).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when episodes belong to different shows', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.validateEpisodeBatch.mockResolvedValue({
        existingCount: 2,
        distinctShowCount: 2,
      });

      await expect(service.markBatchWatched('user-1', ['ep-1', 'ep-2'])).rejects.toThrow(
        BadRequestException,
      );

      expect(mockEpisodeProgressRepo.markManyWatched).not.toHaveBeenCalled();
    });

    it('should skip batch validation for single episode', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 1, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue(null);

      await service.markBatchWatched('user-1', ['ep-1']);

      expect(mockEpisodeProgressRepo.validateEpisodeBatch).not.toHaveBeenCalled();
      expect(mockEpisodeProgressRepo.markManyWatched).toHaveBeenCalled();
    });
  });

  describe('markUnwatched', () => {
    it('should mark episode as unwatched', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

      await service.markUnwatched('user-1', 'ep-1');

      expect(mockEpisodeProgressRepo.markUnwatched).toHaveBeenCalledWith('user-1', 'ep-1');
    });

    it('should do nothing when episode info not found', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(null);

      await service.markUnwatched('user-1', 'non-existent');

      expect(mockEpisodeProgressRepo.markUnwatched).toHaveBeenCalled();
      expect(mockUserMediaService.deleteState).not.toHaveBeenCalled();
    });

    it('should not throw when state sync fails after single unwatch', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockRejectedValue(new Error('DB error'));

      await expect(service.markUnwatched('user-1', 'ep-1')).resolves.toBeUndefined();

      expect(mockEpisodeProgressRepo.markUnwatched).toHaveBeenCalledWith('user-1', 'ep-1');
    });

    describe('auto-state transitions', () => {
      it('should delete state when all episodes are unmarked (watched = 0)', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 0, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markUnwatched('user-1', 'ep-1');

        expect(mockUserMediaService.deleteState).toHaveBeenCalledWith('user-1', 'media-1');
      });

      it('should delete state when all episodes unmarked across multiple seasons', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 0, totalCount: 10, watchedEpisodeIds: [] },
          { seasonNumber: 2, watchedCount: 0, totalCount: 8, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markUnwatched('user-1', 'ep-1');

        expect(mockUserMediaService.deleteState).toHaveBeenCalledWith('user-1', 'media-1');
      });

      it('should revert from "completed" to "watching" when episode is unmarked', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 9, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.COMPLETED });

        await service.markUnwatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.WATCHING,
        });
      });

      it('should revert from "caught_up" to "watching" when episode is unmarked', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 9, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.CAUGHT_UP });

        await service.markUnwatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).toHaveBeenCalledWith({
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.WATCHING,
        });
      });

      it('should NOT change state when unmarking and state is "watching"', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markUnwatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
        expect(mockUserMediaService.deleteState).not.toHaveBeenCalled();
      });

      it('should do nothing when no user media state exists', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue(null);

        await service.markUnwatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
        expect(mockUserMediaService.deleteState).not.toHaveBeenCalled();
      });
    });
  });

  describe('markBatchUnwatched', () => {
    it('should call markManyUnwatched with all episode IDs', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

      await service.markBatchUnwatched('user-1', ['ep-1', 'ep-2', 'ep-3']);

      expect(mockEpisodeProgressRepo.markManyUnwatched).toHaveBeenCalledWith('user-1', [
        'ep-1',
        'ep-2',
        'ep-3',
      ]);
    });

    it('should throw NotFoundException when first episode not found', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(null);

      await expect(service.markBatchUnwatched('user-1', ['non-existent'])).rejects.toThrow(
        NotFoundException,
      );

      expect(mockEpisodeProgressRepo.markManyUnwatched).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when some episodes do not exist', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.validateEpisodeBatch.mockResolvedValue({
        existingCount: 1,
        distinctShowCount: 1,
      });

      await expect(
        service.markBatchUnwatched('user-1', ['ep-1', 'nonexistent-ep']),
      ).rejects.toThrow(BadRequestException);

      expect(mockEpisodeProgressRepo.markManyUnwatched).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when episodes belong to different shows', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.validateEpisodeBatch.mockResolvedValue({
        existingCount: 2,
        distinctShowCount: 2,
      });

      await expect(service.markBatchUnwatched('user-1', ['ep-1', 'ep-2'])).rejects.toThrow(
        BadRequestException,
      );

      expect(mockEpisodeProgressRepo.markManyUnwatched).not.toHaveBeenCalled();
    });

    it('should delete state when all episodes unmarked', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 0, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

      await service.markBatchUnwatched('user-1', ['ep-1', 'ep-2']);

      expect(mockUserMediaService.deleteState).toHaveBeenCalledWith('user-1', 'media-1');
    });

    it('should revert completed to watching when some episodes remain', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
      ]);
      mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.COMPLETED });

      await service.markBatchUnwatched('user-1', ['ep-1', 'ep-2']);

      expect(mockUserMediaService.setState).toHaveBeenCalledWith({
        userId: 'user-1',
        mediaItemId: 'media-1',
        state: USER_MEDIA_STATE.WATCHING,
      });
    });

    it('should not throw when state sync fails after batch unwatch', async () => {
      mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
      mockEpisodeProgressRepo.getShowProgress.mockRejectedValue(new Error('DB error'));

      await expect(service.markBatchUnwatched('user-1', ['ep-1', 'ep-2'])).resolves.toBeUndefined();

      expect(mockEpisodeProgressRepo.markManyUnwatched).toHaveBeenCalledWith('user-1', [
        'ep-1',
        'ep-2',
      ]);
    });
  });

  describe('getShowProgress', () => {
    it('should return progress from repository', async () => {
      const progress: SeasonProgressInfo[] = [
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: ['ep-1', 'ep-2'] },
      ];
      mockEpisodeProgressRepo.getShowProgress.mockResolvedValue(progress);

      const result = await service.getShowProgress('user-1', 'show-1');

      expect(result).toEqual(progress);
      expect(mockEpisodeProgressRepo.getShowProgress).toHaveBeenCalledWith('user-1', 'show-1');
    });
  });
});
