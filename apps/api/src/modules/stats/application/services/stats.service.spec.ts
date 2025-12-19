import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { TraktListsAdapter } from '@/modules/ingestion/infrastructure/adapters/trakt/trakt-lists.adapter';
import { TraktRatingsAdapter } from '@/modules/ingestion/infrastructure/adapters/trakt/trakt-ratings.adapter';
import { ScoreCalculatorService } from '@/modules/shared/score-calculator';
import { STATS_REPOSITORY } from '../../domain/repositories/stats.repository.interface';
import { MEDIA_REPOSITORY } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { StatsNotFoundException } from '@/common/exceptions';

describe('StatsService', () => {
  let service: StatsService;
  let traktAdapter: jest.Mocked<TraktListsAdapter>;
  let traktRatingsAdapter: jest.Mocked<TraktRatingsAdapter>;
  let scoreCalculator: jest.Mocked<ScoreCalculatorService>;
  let statsRepository: any;
  let mediaRepository: any;

  beforeEach(async () => {
    // Create mocks
    const mockTraktAdapter = {
      getTrendingMoviesWithWatchers: jest.fn(),
      getTrendingShowsWithWatchers: jest.fn(),
    };

    const mockTraktRatingsAdapter = {
      getMovieWatchersByTmdbIds: jest.fn(),
      getShowWatchersByTmdbIds: jest.fn(),
    };

    const mockScoreCalculator = {
      calculate: jest.fn(),
    };

    const mockStatsRepository = {
      bulkUpsert: jest.fn(),
      findByTmdbId: jest.fn(),
    };

    const mockMediaRepository = {
      findManyByTmdbIds: jest.fn(),
      findManyForScoring: jest.fn(),
      findTrendingUpdatedItems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: TraktListsAdapter, useValue: mockTraktAdapter },
        { provide: TraktRatingsAdapter, useValue: mockTraktRatingsAdapter },
        { provide: ScoreCalculatorService, useValue: mockScoreCalculator },
        { provide: STATS_REPOSITORY, useValue: mockStatsRepository },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    traktAdapter = module.get(TraktListsAdapter);
    traktRatingsAdapter = module.get(TraktRatingsAdapter);
    scoreCalculator = module.get(ScoreCalculatorService);
    statsRepository = module.get(STATS_REPOSITORY);
    mediaRepository = module.get(MEDIA_REPOSITORY);
  });

  describe('syncTrendingStats', () => {
    it('should return zeros when no trending items', async () => {
      traktAdapter.getTrendingMoviesWithWatchers.mockResolvedValue([]);
      traktAdapter.getTrendingShowsWithWatchers.mockResolvedValue([]);

      const result = await service.syncTrendingStats();

      expect(result).toEqual({ movies: 0, shows: 0 });
      expect(mediaRepository.findManyByTmdbIds).not.toHaveBeenCalled();
    });

    it('should return zeros when no matching media in database', async () => {
      traktAdapter.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 123, watchers: 100, rank: 1 },
      ]);
      traktAdapter.getTrendingShowsWithWatchers.mockResolvedValue([]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([]); // No matches

      const result = await service.syncTrendingStats();

      expect(result).toEqual({ movies: 0, shows: 0 });
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should sync trending movies and shows', async () => {
      // Setup trending data
      traktAdapter.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 550, watchers: 1000, rank: 1 },
        { tmdbId: 551, watchers: 800, rank: 2 },
      ]);
      traktAdapter.getTrendingShowsWithWatchers.mockResolvedValue([
        { tmdbId: 1000, watchers: 500, rank: 1 },
      ]);

      // Setup media items in DB
      mediaRepository.findManyByTmdbIds.mockResolvedValue([
        { id: 'uuid-550', tmdbId: 550 },
        { id: 'uuid-551', tmdbId: 551 },
        { id: 'uuid-1000', tmdbId: 1000 },
      ]);

      // Setup score data
      mediaRepository.findManyForScoring.mockResolvedValue([
        {
          id: 'uuid-550',
          tmdbId: 550,
          popularity: 100,
          ratingImdb: 8.5,
          ratingTrakt: 8.0,
          voteCountImdb: 10000,
          voteCountTrakt: 5000,
          releaseDate: new Date('2020-01-01'),
        },
        {
          id: 'uuid-551',
          tmdbId: 551,
          popularity: 80,
          ratingImdb: 7.5,
          ratingTrakt: 7.0,
          voteCountImdb: 5000,
          voteCountTrakt: 2000,
          releaseDate: new Date('2021-01-01'),
        },
        {
          id: 'uuid-1000',
          tmdbId: 1000,
          popularity: 60,
          ratingImdb: 8.0,
          ratingTrakt: 7.5,
          voteCountImdb: 8000,
          voteCountTrakt: 4000,
          releaseDate: new Date('2022-01-01'),
        },
      ]);

      // Setup score calculator
      scoreCalculator.calculate.mockReturnValue({
        ratingoScore: 0.75,
        qualityScore: 0.8,
        popularityScore: 0.7,
        freshnessScore: 0.6,
        avgRating: 7.5,
        totalVotes: 10000,
      });

      const result = await service.syncTrendingStats();

      expect(result).toEqual({ movies: 2, shows: 1 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledTimes(1);
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            mediaItemId: 'uuid-550',
            watchersCount: 1000,
            trendingRank: 1,
            ratingoScore: 0.75,
          }),
          expect.objectContaining({
            mediaItemId: 'uuid-551',
            watchersCount: 800,
            trendingRank: 2,
          }),
          expect.objectContaining({
            mediaItemId: 'uuid-1000',
            watchersCount: 500,
            trendingRank: 1,
          }),
        ]),
      );
    });

    it('should handle items without score data', async () => {
      traktAdapter.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 550, watchers: 1000, rank: 1 },
      ]);
      traktAdapter.getTrendingShowsWithWatchers.mockResolvedValue([]);

      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ id: 'uuid-550', tmdbId: 550 }]);

      // No score data available
      mediaRepository.findManyForScoring.mockResolvedValue([]);

      const result = await service.syncTrendingStats();

      expect(result).toEqual({ movies: 1, shows: 0 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          mediaItemId: 'uuid-550',
          watchersCount: 1000,
          trendingRank: 1,
          ratingoScore: undefined, // No score data
        }),
      ]);
      expect(scoreCalculator.calculate).not.toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      traktAdapter.getTrendingMoviesWithWatchers.mockResolvedValue([]);
      traktAdapter.getTrendingShowsWithWatchers.mockResolvedValue([]);

      await service.syncTrendingStats(50);

      expect(traktAdapter.getTrendingMoviesWithWatchers).toHaveBeenCalledWith(50);
      expect(traktAdapter.getTrendingShowsWithWatchers).toHaveBeenCalledWith(50);
    });

    it('should fetch movies and shows in parallel', async () => {
      const moviePromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 50));
      const showPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 50));

      traktAdapter.getTrendingMoviesWithWatchers.mockReturnValue(moviePromise);
      traktAdapter.getTrendingShowsWithWatchers.mockReturnValue(showPromise);

      const start = Date.now();
      await service.syncTrendingStats();
      const duration = Date.now() - start;

      // Should complete in ~50ms (parallel), not ~100ms (sequential)
      expect(duration).toBeLessThan(150);
    });
  });

  describe('getStatsByTmdbId', () => {
    it('should return stats when found', async () => {
      const mockStats = {
        mediaItemId: 'uuid-123',
        watchersCount: 500,
        trendingRank: 5,
        ratingoScore: 0.75,
      };
      statsRepository.findByTmdbId.mockResolvedValue(mockStats);

      const result = await service.getStatsByTmdbId(550);

      expect(result).toEqual(mockStats);
      expect(statsRepository.findByTmdbId).toHaveBeenCalledWith(550);
    });

    it('should throw StatsNotFoundException when not found', async () => {
      statsRepository.findByTmdbId.mockResolvedValue(null);

      await expect(service.getStatsByTmdbId(999)).rejects.toThrow(StatsNotFoundException);
    });
  });

  describe('syncTrendingStatsForUpdatedItems', () => {
    it('should return zeros when no items found in DB', async () => {
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([]);

      const result = await service.syncTrendingStatsForUpdatedItems({
        since: new Date(),
        limit: 100,
      });

      expect(result).toEqual({ movies: 0, shows: 0 });
      expect(traktRatingsAdapter.getMovieWatchersByTmdbIds).not.toHaveBeenCalled();
    });

    it('should apply safety window to since parameter', async () => {
      const since = new Date('2025-01-01T12:00:00Z');
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([]);

      await service.syncTrendingStatsForUpdatedItems({ since, limit: 100 });

      // Should subtract 5 minutes from since
      const expectedSince = new Date(since.getTime() - 5 * 60 * 1000);
      expect(mediaRepository.findTrendingUpdatedItems).toHaveBeenCalledWith({
        since: expectedSince,
        limit: 100,
      });
    });

    it('should fetch watchers by TMDB IDs and sync stats', async () => {
      // Setup DB items
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([
        { id: 'uuid-1', tmdbId: 550, type: 'movie' },
        { id: 'uuid-2', tmdbId: 1000, type: 'show' },
      ]);

      // Setup watchers from Trakt
      traktRatingsAdapter.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[550, 1000]]));
      traktRatingsAdapter.getShowWatchersByTmdbIds.mockResolvedValue(new Map([[1000, 500]]));

      // Setup score data
      mediaRepository.findManyForScoring.mockResolvedValue([
        { id: 'uuid-1', tmdbId: 550, popularity: 100 },
        { id: 'uuid-2', tmdbId: 1000, popularity: 80 },
      ]);

      scoreCalculator.calculate.mockReturnValue({
        ratingoScore: 0.75,
        qualityScore: 0.8,
        popularityScore: 0.7,
        freshnessScore: 0.6,
        avgRating: 7.5,
        totalVotes: 10000,
      });

      const result = await service.syncTrendingStatsForUpdatedItems({
        limit: 100,
      });

      expect(result).toEqual({ movies: 1, shows: 1 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            mediaItemId: 'uuid-1',
            watchersCount: 1000,
          }),
          expect.objectContaining({
            mediaItemId: 'uuid-2',
            watchersCount: 500,
          }),
        ]),
      );
    });

    it('should skip items with null watchers (transient errors)', async () => {
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([
        { id: 'uuid-1', tmdbId: 550, type: 'movie' },
        { id: 'uuid-2', tmdbId: 551, type: 'movie' },
      ]);

      // One success, one error (null)
      traktRatingsAdapter.getMovieWatchersByTmdbIds.mockResolvedValue(
        new Map<number, number | null>([
          [550, 1000],
          [551, null], // Transient error
        ]),
      );
      traktRatingsAdapter.getShowWatchersByTmdbIds.mockResolvedValue(new Map());

      mediaRepository.findManyForScoring.mockResolvedValue([
        { id: 'uuid-1', tmdbId: 550, popularity: 100 },
      ]);

      scoreCalculator.calculate.mockReturnValue({
        ratingoScore: 0.75,
        qualityScore: 0.8,
        popularityScore: 0.7,
        freshnessScore: 0.6,
        avgRating: 7.5,
        totalVotes: 10000,
      });

      const result = await service.syncTrendingStatsForUpdatedItems({ limit: 100 });

      // Only 1 movie updated (uuid-2 skipped due to null watchers)
      expect(result).toEqual({ movies: 1, shows: 0 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          mediaItemId: 'uuid-1',
          watchersCount: 1000,
        }),
      ]);
    });

    it('should handle items with 0 watchers (not found in Trakt)', async () => {
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([
        { id: 'uuid-1', tmdbId: 550, type: 'movie' },
      ]);

      traktRatingsAdapter.getMovieWatchersByTmdbIds.mockResolvedValue(
        new Map([[550, 0]]), // Not found in Trakt
      );
      traktRatingsAdapter.getShowWatchersByTmdbIds.mockResolvedValue(new Map());

      mediaRepository.findManyForScoring.mockResolvedValue([
        { id: 'uuid-1', tmdbId: 550, popularity: 100 },
      ]);

      scoreCalculator.calculate.mockReturnValue({
        ratingoScore: 0.5,
        qualityScore: 0.6,
        popularityScore: 0.5,
        freshnessScore: 0.4,
        avgRating: 6.0,
        totalVotes: 5000,
      });

      const result = await service.syncTrendingStatsForUpdatedItems({ limit: 100 });

      // Should still update with 0 watchers
      expect(result).toEqual({ movies: 1, shows: 0 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          mediaItemId: 'uuid-1',
          watchersCount: 0,
        }),
      ]);
    });
  });
});
