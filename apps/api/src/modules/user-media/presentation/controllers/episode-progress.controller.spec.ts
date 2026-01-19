import { Test, TestingModule } from '@nestjs/testing';

import { EpisodeProgressService } from '../../application/episode-progress.service';
import { EpisodeProgressController } from './episode-progress.controller';

describe('EpisodeProgressController', () => {
  let controller: EpisodeProgressController;
  const service = {
    markWatched: jest.fn(),
    markUnwatched: jest.fn(),
    getShowProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EpisodeProgressController],
      providers: [{ provide: EpisodeProgressService, useValue: service }],
    }).compile();

    controller = module.get(EpisodeProgressController);
    jest.clearAllMocks();
  });

  describe('markWatched', () => {
    it('should call service.markWatched with user id and episode id', async () => {
      service.markWatched.mockResolvedValue(undefined);

      await controller.markWatched({ id: 'user-123' }, 'episode-456');

      expect(service.markWatched).toHaveBeenCalledWith('user-123', 'episode-456');
    });
  });

  describe('markUnwatched', () => {
    it('should call service.markUnwatched with user id and episode id', async () => {
      service.markUnwatched.mockResolvedValue(undefined);

      await controller.markUnwatched({ id: 'user-123' }, 'episode-456');

      expect(service.markUnwatched).toHaveBeenCalledWith('user-123', 'episode-456');
    });
  });

  describe('getShowProgress', () => {
    it('should return show progress with seasons from service', async () => {
      const mockSeasons = [
        { seasonNumber: 1, watchedCount: 5, totalCount: 10, watchedEpisodeIds: ['ep1', 'ep2'] },
        { seasonNumber: 2, watchedCount: 0, totalCount: 8, watchedEpisodeIds: [] },
      ];
      service.getShowProgress.mockResolvedValue(mockSeasons);

      const result = await controller.getShowProgress({ id: 'user-123' }, 'show-789');

      expect(service.getShowProgress).toHaveBeenCalledWith('user-123', 'show-789');
      expect(result).toEqual({
        showId: 'show-789',
        seasons: mockSeasons,
      });
    });

    it('should return empty seasons array when no progress exists', async () => {
      service.getShowProgress.mockResolvedValue([]);

      const result = await controller.getShowProgress({ id: 'user-123' }, 'show-789');

      expect(result).toEqual({
        showId: 'show-789',
        seasons: [],
      });
    });
  });
});
