import { Test, TestingModule } from '@nestjs/testing';
import { EpisodeProgressController } from './episode-progress.controller';
import { EPISODE_PROGRESS_REPOSITORY } from '../../domain/repositories/episode-progress.repository.interface';

describe('EpisodeProgressController', () => {
  let controller: EpisodeProgressController;
  const repository = {
    markWatched: jest.fn(),
    markUnwatched: jest.fn(),
    getShowProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EpisodeProgressController],
      providers: [{ provide: EPISODE_PROGRESS_REPOSITORY, useValue: repository }],
    }).compile();

    controller = module.get(EpisodeProgressController);
    jest.clearAllMocks();
  });

  describe('markWatched', () => {
    it('should call repository.markWatched with user id and episode id', async () => {
      repository.markWatched.mockResolvedValue(undefined);

      await controller.markWatched({ id: 'user-123' }, 'episode-456');

      expect(repository.markWatched).toHaveBeenCalledWith('user-123', 'episode-456');
    });
  });

  describe('markUnwatched', () => {
    it('should call repository.markUnwatched with user id and episode id', async () => {
      repository.markUnwatched.mockResolvedValue(undefined);

      await controller.markUnwatched({ id: 'user-123' }, 'episode-456');

      expect(repository.markUnwatched).toHaveBeenCalledWith('user-123', 'episode-456');
    });
  });

  describe('getShowProgress', () => {
    it('should return show progress with seasons from repository', async () => {
      const mockSeasons = [
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: ['ep1', 'ep2'] },
        { seasonNumber: 2, watchedCount: 0, totalCount: 8, watchedEpisodeIds: [] },
      ];
      repository.getShowProgress.mockResolvedValue(mockSeasons);

      const result = await controller.getShowProgress({ id: 'user-123' }, 'show-789');

      expect(repository.getShowProgress).toHaveBeenCalledWith('user-123', 'show-789');
      expect(result).toEqual({
        showId: 'show-789',
        seasons: mockSeasons,
      });
    });

    it('should return empty seasons array when no progress exists', async () => {
      repository.getShowProgress.mockResolvedValue([]);

      const result = await controller.getShowProgress({ id: 'user-123' }, 'show-789');

      expect(result).toEqual({
        showId: 'show-789',
        seasons: [],
      });
    });
  });
});
