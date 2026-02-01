import { Test, TestingModule } from '@nestjs/testing';
import { TrendingSyncService } from './trending-sync.service';
import { STATS_REPOSITORY } from '../../domain/repositories/stats.repository.interface';
import { MEDIA_REPOSITORY } from '../../../catalog/public';
import { TRAKT_LISTS_PORT, TRAKT_RATINGS_PORT } from '../../../ingestion/public';
import { ScoreCalculatorService } from '../../../shared/score-calculator';
import { MediaType } from '@/common/enums/media-type.enum';

describe('TrendingSyncService', () => {
  let service: TrendingSyncService;
  let traktListsPort: any;
  let traktRatingsPort: any;
  let scoreCalculator: jest.Mocked<ScoreCalculatorService>;
  let statsRepository: any;
  let mediaRepository: any;

  const mockScores = {
    ratingoScore: 85,
    qualityScore: 80,
    popularityScore: 75,
    freshnessScore: 90,
  };

  const createScoreData = (id: string, tmdbId: number) => ({
    id,
    tmdbId,
    popularity: 85.5,
    totalWatchers: 10000,
    watchersCount: 500,
    ratingImdb: 8.5,
    ratingTrakt: 8.2,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 88,
    voteCountImdb: 25000,
    voteCountTrakt: 5000,
    releaseDate: new Date('2024-01-15'),
    lastAirDate: null,
  });

  beforeEach(async () => {
    traktListsPort = {
      getTrendingMoviesWithWatchers: jest.fn().mockResolvedValue([]),
      getTrendingShowsWithWatchers: jest.fn().mockResolvedValue([]),
    };

    traktRatingsPort = {
      getMovieWatchersByTmdbIds: jest.fn().mockResolvedValue(new Map()),
      getShowWatchersByTmdbIds: jest.fn().mockResolvedValue(new Map()),
    };

    scoreCalculator = {
      calculate: jest.fn().mockReturnValue(mockScores),
    } as any;

    statsRepository = {
      bulkUpsert: jest.fn().mockResolvedValue(undefined),
    };

    mediaRepository = {
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
      findManyForScoring: jest.fn().mockResolvedValue([]),
      findTrendingUpdatedItems: jest.fn().mockResolvedValue([]),
      findHeroCandidatesForStatsRefresh: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingSyncService,
        { provide: TRAKT_LISTS_PORT, useValue: traktListsPort },
        { provide: TRAKT_RATINGS_PORT, useValue: traktRatingsPort },
        { provide: ScoreCalculatorService, useValue: scoreCalculator },
        { provide: STATS_REPOSITORY, useValue: statsRepository },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
      ],
    }).compile();

    service = module.get<TrendingSyncService>(TrendingSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncTrendingStats', () => {
    it('should return zeros when no trending items', async () => {
      traktListsPort.getTrendingMoviesWithWatchers.mockResolvedValue([]);
      traktListsPort.getTrendingShowsWithWatchers.mockResolvedValue([]);

      const result = await service.syncTrendingStats(100);

      expect(result).toEqual({ movies: 0, shows: 0 });
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should return zeros when no matching DB items', async () => {
      traktListsPort.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 100, watchers: 500, rank: 1 },
      ]);
      traktListsPort.getTrendingShowsWithWatchers.mockResolvedValue([]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([]); // No matches

      const result = await service.syncTrendingStats(100);

      expect(result).toEqual({ movies: 0, shows: 0 });
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should sync trending movies and shows', async () => {
      traktListsPort.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 100, watchers: 500, rank: 1 },
        { tmdbId: 101, watchers: 400, rank: 2 },
      ]);
      traktListsPort.getTrendingShowsWithWatchers.mockResolvedValue([
        { tmdbId: 200, watchers: 1000, rank: 1 },
      ]);

      mediaRepository.findManyByTmdbIds.mockResolvedValue([
        { id: 'movie-1', tmdbId: 100 },
        { id: 'movie-2', tmdbId: 101 },
        { id: 'show-1', tmdbId: 200 },
      ]);

      mediaRepository.findManyForScoring.mockResolvedValue([
        createScoreData('movie-1', 100),
        createScoreData('movie-2', 101),
        createScoreData('show-1', 200),
      ]);

      const result = await service.syncTrendingStats(100);

      expect(result).toEqual({ movies: 2, shows: 1 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledTimes(1);
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ mediaItemId: 'movie-1', watchersCount: 500, trendingRank: 1 }),
          expect.objectContaining({ mediaItemId: 'movie-2', watchersCount: 400, trendingRank: 2 }),
          expect.objectContaining({ mediaItemId: 'show-1', watchersCount: 1000, trendingRank: 1 }),
        ]),
      );
    });

    it('should calculate scores for items with scoreData', async () => {
      traktListsPort.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 100, watchers: 500, rank: 1 },
      ]);
      traktListsPort.getTrendingShowsWithWatchers.mockResolvedValue([]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ id: 'movie-1', tmdbId: 100 }]);
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('movie-1', 100)]);

      await service.syncTrendingStats(100);

      expect(scoreCalculator.calculate).toHaveBeenCalledTimes(1);
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          ratingoScore: 85,
          qualityScore: 80,
          popularityScore: 75,
          freshnessScore: 90,
        }),
      ]);
    });

    it('should handle items without scoreData', async () => {
      traktListsPort.getTrendingMoviesWithWatchers.mockResolvedValue([
        { tmdbId: 100, watchers: 500, rank: 1 },
      ]);
      traktListsPort.getTrendingShowsWithWatchers.mockResolvedValue([]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ id: 'movie-1', tmdbId: 100 }]);
      mediaRepository.findManyForScoring.mockResolvedValue([]); // No score data

      await service.syncTrendingStats(100);

      expect(scoreCalculator.calculate).not.toHaveBeenCalled();
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          mediaItemId: 'movie-1',
          watchersCount: 500,
          trendingRank: 1,
          ratingoScore: undefined,
          qualityScore: undefined,
        }),
      ]);
    });

    it('should use default limit of MAX_PAGE_SIZE', async () => {
      traktListsPort.getTrendingMoviesWithWatchers.mockResolvedValue([]);
      traktListsPort.getTrendingShowsWithWatchers.mockResolvedValue([]);

      await service.syncTrendingStats();

      expect(traktListsPort.getTrendingMoviesWithWatchers).toHaveBeenCalledWith(100);
      expect(traktListsPort.getTrendingShowsWithWatchers).toHaveBeenCalledWith(100);
    });
  });

  describe('syncTrendingStatsForUpdatedItems', () => {
    it('should return zeros when no updated items in DB', async () => {
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([]);

      const result = await service.syncTrendingStatsForUpdatedItems({
        since: new Date(),
        limit: 100,
      });

      expect(result).toEqual({ movies: 0, shows: 0 });
    });

    it('should sync stats for updated items', async () => {
      const dbItems = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'show-1', tmdbId: 200, type: MediaType.SHOW },
      ];

      mediaRepository.findTrendingUpdatedItems.mockResolvedValue(dbItems);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, 500]]));
      traktRatingsPort.getShowWatchersByTmdbIds.mockResolvedValue(new Map([[200, 1000]]));
      mediaRepository.findManyForScoring.mockResolvedValue([
        createScoreData('movie-1', 100),
        createScoreData('show-1', 200),
      ]);

      const result = await service.syncTrendingStatsForUpdatedItems({
        since: new Date(),
        limit: 100,
      });

      expect(result).toEqual({ movies: 1, shows: 1 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalled();
    });

    it('should skip items with null watchers (transient error)', async () => {
      const dbItems = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
      ];

      mediaRepository.findTrendingUpdatedItems.mockResolvedValue(dbItems);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(
        new Map([
          [100, 500],
          [101, null], // Transient error
        ]),
      );
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('movie-1', 100)]);

      const result = await service.syncTrendingStatsForUpdatedItems({
        since: new Date(),
        limit: 100,
      });

      expect(result).toEqual({ movies: 1, shows: 0 });
    });

    it('should skip items with undefined watchers (not found)', async () => {
      const dbItems = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
      ];

      mediaRepository.findTrendingUpdatedItems.mockResolvedValue(dbItems);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(
        new Map([
          [100, 500],
          [101, undefined], // Not found
        ]),
      );
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('movie-1', 100)]);

      const result = await service.syncTrendingStatsForUpdatedItems({
        since: new Date(),
        limit: 100,
      });

      expect(result).toEqual({ movies: 1, shows: 0 });
    });

    it('should allow zero watchers', async () => {
      const dbItems = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];

      mediaRepository.findTrendingUpdatedItems.mockResolvedValue(dbItems);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, 0]]));
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('movie-1', 100)]);

      const result = await service.syncTrendingStatsForUpdatedItems({
        since: new Date(),
        limit: 100,
      });

      expect(result).toEqual({ movies: 1, shows: 0 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({ watchersCount: 0 }),
      ]);
    });

    it('should apply safety window to since date', async () => {
      const since = new Date('2024-01-15T12:00:00Z');
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([]);

      await service.syncTrendingStatsForUpdatedItems({ since, limit: 100 });

      // Safety window is 5 minutes
      const expectedSince = new Date('2024-01-15T11:55:00Z');
      expect(mediaRepository.findTrendingUpdatedItems).toHaveBeenCalledWith({
        since: expectedSince,
        limit: 100,
      });
    });

    it('should handle missing since date', async () => {
      mediaRepository.findTrendingUpdatedItems.mockResolvedValue([]);

      await service.syncTrendingStatsForUpdatedItems({ limit: 100 });

      expect(mediaRepository.findTrendingUpdatedItems).toHaveBeenCalledWith({
        since: undefined,
        limit: 100,
      });
    });
  });

  describe('syncHeroCandidatesStats', () => {
    it('should return zeros when no stale hero candidates', async () => {
      mediaRepository.findHeroCandidatesForStatsRefresh.mockResolvedValue([]);

      const result = await service.syncHeroCandidatesStats({
        staleThresholdHours: 24,
        limit: 30,
      });

      expect(result).toEqual({ movies: 0, shows: 0, total: 0 });
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should sync stats for stale hero candidates', async () => {
      const candidates = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'show-1', tmdbId: 200, type: MediaType.SHOW },
      ];

      mediaRepository.findHeroCandidatesForStatsRefresh.mockResolvedValue(candidates);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, 500]]));
      traktRatingsPort.getShowWatchersByTmdbIds.mockResolvedValue(new Map([[200, 1000]]));
      mediaRepository.findManyForScoring.mockResolvedValue([
        createScoreData('movie-1', 100),
        createScoreData('show-1', 200),
      ]);

      const result = await service.syncHeroCandidatesStats({
        staleThresholdHours: 24,
        limit: 30,
      });

      expect(result).toEqual({ movies: 1, shows: 1, total: 2 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalled();
    });

    it('should skip items with null watchers (transient error)', async () => {
      const candidates = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
      ];

      mediaRepository.findHeroCandidatesForStatsRefresh.mockResolvedValue(candidates);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(
        new Map([
          [100, 500],
          [101, null],
        ]),
      );
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('movie-1', 100)]);

      const result = await service.syncHeroCandidatesStats({
        staleThresholdHours: 24,
        limit: 30,
      });

      expect(result).toEqual({ movies: 1, shows: 0, total: 1 });
      // Only movie-1 should be upserted (null = transient error, skip entirely)
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({ mediaItemId: 'movie-1', watchersCount: 500 }),
      ]);
    });

    it('should touch updated_at for items not found in Trakt (undefined)', async () => {
      const candidates = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
      ];

      mediaRepository.findHeroCandidatesForStatsRefresh.mockResolvedValue(candidates);
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(
        new Map([
          [100, 500],
          [101, undefined], // not found in Trakt
        ]),
      );
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('movie-1', 100)]);

      const result = await service.syncHeroCandidatesStats({
        staleThresholdHours: 24,
        limit: 30,
      });

      expect(result).toEqual({ movies: 1, shows: 0, total: 1 });
      // Both items should be upserted - movie-1 with data, movie-2 just to touch updated_at
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        expect.objectContaining({ mediaItemId: 'movie-1', watchersCount: 500 }),
        { mediaItemId: 'movie-2' }, // only mediaItemId, COALESCE keeps existing values
      ]);
    });

    it('should pass correct options to repository', async () => {
      mediaRepository.findHeroCandidatesForStatsRefresh.mockResolvedValue([]);

      await service.syncHeroCandidatesStats({
        staleThresholdHours: 48,
        limit: 50,
      });

      expect(mediaRepository.findHeroCandidatesForStatsRefresh).toHaveBeenCalledWith({
        staleThresholdHours: 48,
        limit: 50,
        minQualityScore: undefined,
      });
    });

    it('should pass minQualityScore to repository for homepage coverage', async () => {
      mediaRepository.findHeroCandidatesForStatsRefresh.mockResolvedValue([]);

      await service.syncHeroCandidatesStats({
        staleThresholdHours: 24,
        limit: 30,
        minQualityScore: 50, // covers both hero (60) and watching-now (50)
      });

      expect(mediaRepository.findHeroCandidatesForStatsRefresh).toHaveBeenCalledWith({
        staleThresholdHours: 24,
        limit: 30,
        minQualityScore: 50,
      });
    });
  });
});
