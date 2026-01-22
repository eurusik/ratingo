import { Test, TestingModule } from '@nestjs/testing';
import { StatsQueryService } from './stats-query.service';
import { STATS_REPOSITORY } from '../../domain/repositories/stats.repository.interface';
import { StatsNotFoundException } from '@/common/exceptions';

describe('StatsQueryService', () => {
  let service: StatsQueryService;
  let statsRepository: any;

  beforeEach(async () => {
    statsRepository = {
      findByTmdbId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StatsQueryService, { provide: STATS_REPOSITORY, useValue: statsRepository }],
    }).compile();

    service = module.get<StatsQueryService>(StatsQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatsByTmdbId', () => {
    it('should return stats when found', async () => {
      const mockStats = {
        mediaItemId: 'media-1',
        watchersCount: 500,
        trendingRank: 10,
        ratingoScore: 85,
      };
      statsRepository.findByTmdbId.mockResolvedValue(mockStats);

      const result = await service.getStatsByTmdbId(550);

      expect(result).toEqual(mockStats);
      expect(statsRepository.findByTmdbId).toHaveBeenCalledWith(550);
    });

    it('should throw StatsNotFoundException when stats not found', async () => {
      statsRepository.findByTmdbId.mockResolvedValue(null);

      await expect(service.getStatsByTmdbId(999)).rejects.toThrow(StatsNotFoundException);
      expect(statsRepository.findByTmdbId).toHaveBeenCalledWith(999);
    });

    it('should throw StatsNotFoundException with correct identifier', async () => {
      statsRepository.findByTmdbId.mockResolvedValue(null);

      try {
        await service.getStatsByTmdbId(12345);
        fail('Expected StatsNotFoundException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StatsNotFoundException);
        expect(error.message).toContain('12345');
      }
    });
  });
});
