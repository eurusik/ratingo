import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { StatsBackfillService } from './stats-backfill.service';
import { STATS_REPOSITORY } from '../../domain/repositories/stats.repository.interface';
import { MEDIA_REPOSITORY } from '../../../catalog/public';
import { TRAKT_RATINGS_PORT } from '../../../trakt/public';
import { STATS_QUEUE, STATS_JOBS, BACKFILL_CONFIG } from '../../stats.constants';
import { MediaType } from '@/common/enums/media-type.enum';

describe('StatsBackfillService', () => {
  let service: StatsBackfillService;
  let traktRatingsPort: any;
  let statsRepository: any;
  let mediaRepository: any;
  let statsQueue: any;

  beforeEach(async () => {
    traktRatingsPort = {
      getMovieStatsByTmdbId: jest.fn(),
      getShowStatsByTmdbId: jest.fn(),
      getMovieWatchersByTmdbIds: jest.fn(),
      getShowWatchersByTmdbIds: jest.fn(),
    };

    statsRepository = {
      updateTotalWatchers: jest.fn().mockResolvedValue(undefined),
      updateWatchersCount: jest.fn().mockResolvedValue(undefined),
    };

    mediaRepository = {
      findItemsWithMissingWatchers: jest.fn().mockResolvedValue([]),
      findItemsWithCorruptedWatchersCount: jest.fn().mockResolvedValue([]),
    };

    statsQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsBackfillService,
        { provide: TRAKT_RATINGS_PORT, useValue: traktRatingsPort },
        { provide: STATS_REPOSITORY, useValue: statsRepository },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: getQueueToken(STATS_QUEUE), useValue: statsQueue },
      ],
    }).compile();

    service = module.get<StatsBackfillService>(StatsBackfillService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('backfillTotalWatchers', () => {
    it('should return zeros when no corrupted items found', async () => {
      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([]);

      const result = await service.backfillTotalWatchers({});

      expect(result).toEqual({ total: 0, success: 0, failed: 0 });
    });

    it('should backfill movie watchers successfully', async () => {
      jest.useFakeTimers();

      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
      ]);
      traktRatingsPort.getMovieStatsByTmdbId.mockResolvedValue({ watchers: 5000 });

      const resultPromise = service.backfillTotalWatchers({ limit: 10 });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ total: 1, success: 1, failed: 0 });
      expect(statsRepository.updateTotalWatchers).toHaveBeenCalledWith('movie-1', 5000);

      jest.useRealTimers();
    });

    it('should backfill show watchers successfully', async () => {
      jest.useFakeTimers();

      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([
        { id: 'show-1', tmdbId: 200, type: MediaType.SHOW },
      ]);
      traktRatingsPort.getShowStatsByTmdbId.mockResolvedValue({ watchers: 10000 });

      const resultPromise = service.backfillTotalWatchers({ limit: 10 });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ total: 1, success: 1, failed: 0 });
      expect(statsRepository.updateTotalWatchers).toHaveBeenCalledWith('show-1', 10000);

      jest.useRealTimers();
    });

    it('should count failed when no watchers data returned', async () => {
      jest.useFakeTimers();

      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
      ]);
      traktRatingsPort.getMovieStatsByTmdbId.mockResolvedValue(undefined);

      const resultPromise = service.backfillTotalWatchers({ limit: 10 });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ total: 1, success: 0, failed: 1 });
      expect(statsRepository.updateTotalWatchers).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should count failed when watchers is zero', async () => {
      jest.useFakeTimers();

      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
      ]);
      traktRatingsPort.getMovieStatsByTmdbId.mockResolvedValue({ watchers: 0 });

      const resultPromise = service.backfillTotalWatchers({ limit: 10 });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // watchers > 0 check fails, so it's not updated
      expect(result.success).toBe(0);
      expect(statsRepository.updateTotalWatchers).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should stop after consecutive failures', async () => {
      jest.useFakeTimers();

      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'movie-3', tmdbId: 102, type: MediaType.MOVIE },
        { id: 'movie-4', tmdbId: 103, type: MediaType.MOVIE },
        { id: 'movie-5', tmdbId: 104, type: MediaType.MOVIE },
        { id: 'movie-6', tmdbId: 105, type: MediaType.MOVIE },
      ]);
      // All return null (transient error)
      traktRatingsPort.getMovieStatsByTmdbId.mockResolvedValue(null);

      const resultPromise = service.backfillTotalWatchers({ limit: 10 });

      // Fast-forward through all timers
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      // Should stop after 5 consecutive failures
      expect(result.failed).toBe(5);
      expect(traktRatingsPort.getMovieStatsByTmdbId).toHaveBeenCalledTimes(5);

      jest.useRealTimers();
    });

    it('should reset consecutive failures on success', async () => {
      jest.useFakeTimers();

      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'movie-3', tmdbId: 102, type: MediaType.MOVIE },
      ]);
      traktRatingsPort.getMovieStatsByTmdbId
        .mockResolvedValueOnce(null) // fail
        .mockResolvedValueOnce({ watchers: 1000 }) // success - resets counter
        .mockResolvedValueOnce(null); // fail

      const resultPromise = service.backfillTotalWatchers({ limit: 10 });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ total: 3, success: 1, failed: 2 });

      jest.useRealTimers();
    });

    it('should use default values for options', async () => {
      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([]);

      await service.backfillTotalWatchers({});

      expect(mediaRepository.findItemsWithMissingWatchers).toHaveBeenCalledWith({
        type: undefined,
        limit: 100,
        minVotes: 100,
      });
    });

    it('should pass options correctly', async () => {
      mediaRepository.findItemsWithMissingWatchers.mockResolvedValue([]);

      await service.backfillTotalWatchers({
        type: MediaType.SHOW,
        limit: 50,
        minVotes: 200,
      });

      expect(mediaRepository.findItemsWithMissingWatchers).toHaveBeenCalledWith({
        type: MediaType.SHOW,
        limit: 50,
        minVotes: 200,
      });
    });
  });

  describe('queueWatchersCountBackfill', () => {
    it('should return zeros when no corrupted items found', async () => {
      mediaRepository.findItemsWithCorruptedWatchersCount.mockResolvedValue([]);

      const result = await service.queueWatchersCountBackfill({});

      expect(result).toEqual({ total: 0, chunksQueued: 0 });
      expect(statsQueue.add).not.toHaveBeenCalled();
    });

    it('should split items into chunks', async () => {
      const items = Array.from({ length: 45 }, (_, i) => ({
        id: `movie-${i}`,
        tmdbId: 100 + i,
        type: MediaType.MOVIE,
      }));
      mediaRepository.findItemsWithCorruptedWatchersCount.mockResolvedValue(items);

      const result = await service.queueWatchersCountBackfill({ limit: 100 });

      // 45 items / 20 chunk size = 3 chunks
      expect(result).toEqual({ total: 45, chunksQueued: 3 });
      expect(statsQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should queue chunks with correct job data', async () => {
      const items = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'movie-2', tmdbId: 101, type: MediaType.MOVIE },
      ];
      mediaRepository.findItemsWithCorruptedWatchersCount.mockResolvedValue(items);

      await service.queueWatchersCountBackfill({});

      expect(statsQueue.add).toHaveBeenCalledWith(
        STATS_JOBS.BACKFILL_WATCHERS_CHUNK,
        {
          items,
          chunkIndex: 0,
          totalChunks: 1,
        },
        expect.objectContaining({
          delay: 0,
          attempts: BACKFILL_CONFIG.MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: BACKFILL_CONFIG.BACKOFF_BASE_MS,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }),
      );
    });

    it('should stagger chunk delays', async () => {
      const items = Array.from({ length: 60 }, (_, i) => ({
        id: `movie-${i}`,
        tmdbId: 100 + i,
        type: MediaType.MOVIE,
      }));
      mediaRepository.findItemsWithCorruptedWatchersCount.mockResolvedValue(items);

      await service.queueWatchersCountBackfill({});

      // 3 chunks with staggered delays
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        1,
        STATS_JOBS.BACKFILL_WATCHERS_CHUNK,
        expect.anything(),
        expect.objectContaining({ delay: 0 }),
      );
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        2,
        STATS_JOBS.BACKFILL_WATCHERS_CHUNK,
        expect.anything(),
        expect.objectContaining({ delay: BACKFILL_CONFIG.CHUNK_DELAY_MS }),
      );
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        3,
        STATS_JOBS.BACKFILL_WATCHERS_CHUNK,
        expect.anything(),
        expect.objectContaining({ delay: 2 * BACKFILL_CONFIG.CHUNK_DELAY_MS }),
      );
    });

    it('should use default values for options', async () => {
      mediaRepository.findItemsWithCorruptedWatchersCount.mockResolvedValue([]);

      await service.queueWatchersCountBackfill({});

      expect(mediaRepository.findItemsWithCorruptedWatchersCount).toHaveBeenCalledWith({
        type: undefined,
        limit: 500,
        minTotalWatchers: 100,
      });
    });
  });

  describe('processWatchersChunk', () => {
    it('should process movies successfully', async () => {
      const items = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, 500]]));

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 1, failed: 0 });
      expect(statsRepository.updateWatchersCount).toHaveBeenCalledWith('movie-1', 500);
    });

    it('should process shows successfully', async () => {
      const items = [{ id: 'show-1', tmdbId: 200, type: MediaType.SHOW }];
      traktRatingsPort.getShowWatchersByTmdbIds.mockResolvedValue(new Map([[200, 1000]]));

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 1, failed: 0 });
      expect(statsRepository.updateWatchersCount).toHaveBeenCalledWith('show-1', 1000);
    });

    it('should process mixed movies and shows', async () => {
      const items = [
        { id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 'show-1', tmdbId: 200, type: MediaType.SHOW },
      ];
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, 500]]));
      traktRatingsPort.getShowWatchersByTmdbIds.mockResolvedValue(new Map([[200, 1000]]));

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 2, failed: 0 });
    });

    it('should count failed when watchers is null', async () => {
      const items = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, null]]));

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 0, failed: 1 });
      expect(statsRepository.updateWatchersCount).not.toHaveBeenCalled();
    });

    it('should count failed when watchers is undefined', async () => {
      const items = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, undefined]]));

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 0, failed: 1 });
    });

    it('should allow zero watchers', async () => {
      const items = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];
      traktRatingsPort.getMovieWatchersByTmdbIds.mockResolvedValue(new Map([[100, 0]]));

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 1, failed: 0 });
      expect(statsRepository.updateWatchersCount).toHaveBeenCalledWith('movie-1', 0);
    });

    it('should rethrow rate limit errors for movies', async () => {
      const items = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];
      const rateLimitError = { status: 429, message: 'Too Many Requests' };
      traktRatingsPort.getMovieWatchersByTmdbIds.mockRejectedValue(rateLimitError);

      await expect(service.processWatchersChunk(items)).rejects.toEqual(rateLimitError);
    });

    it('should rethrow rate limit errors for shows', async () => {
      const items = [{ id: 'show-1', tmdbId: 200, type: MediaType.SHOW }];
      const rateLimitError = { response: { status: 429 }, message: 'Too Many Requests' };
      traktRatingsPort.getShowWatchersByTmdbIds.mockRejectedValue(rateLimitError);

      await expect(service.processWatchersChunk(items)).rejects.toEqual(rateLimitError);
    });

    it('should handle non-rate-limit errors gracefully', async () => {
      const items = [{ id: 'movie-1', tmdbId: 100, type: MediaType.MOVIE }];
      const otherError = new Error('Network error');
      traktRatingsPort.getMovieWatchersByTmdbIds.mockRejectedValue(otherError);

      const result = await service.processWatchersChunk(items);

      expect(result).toEqual({ success: 0, failed: 1 });
    });
  });
});
