import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
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
    getWatchedEpisodeIds: jest.fn(),
    getShowProgress: jest.fn(),
    getEpisodeMediaInfo: jest.fn(),
  };

  const mockUserMediaService = {
    getState: jest.fn(),
    setState: jest.fn(),
    deleteState: jest.fn(),
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
        { provide: UserMediaService, useValue: mockUserMediaService },
      ],
    }).compile();

    service = module.get(EpisodeProgressService);
    jest.clearAllMocks();
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
      });

      it('should NOT change state when marking episode and current state is "watching"', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.WATCHING });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
      });

      it('should NOT change state when marking episode and current state is "dropped"', async () => {
        mockEpisodeProgressRepo.getEpisodeMediaInfo.mockResolvedValue(episodeInfo);
        mockEpisodeProgressRepo.getShowProgress.mockResolvedValue([
          { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: [] },
        ]);
        mockUserMediaService.getState.mockResolvedValue({ state: USER_MEDIA_STATE.DROPPED });

        await service.markWatched('user-1', 'ep-1');

        expect(mockUserMediaService.setState).not.toHaveBeenCalled();
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
