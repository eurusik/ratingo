import { Test, TestingModule } from '@nestjs/testing';
import { IngestionSchedulerService } from './ingestion-scheduler.service';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE } from '../../ingestion.constants';
import schedulerConfig from '../../../../config/scheduler.config';

describe('IngestionSchedulerService', () => {
  let service: IngestionSchedulerService;
  let ingestionQueue: any;
  let config: any;

  const ENV_PREFIX = 'test';

  beforeEach(async () => {
    process.env.NODE_ENV = ENV_PREFIX;

    ingestionQueue = {
      upsertJobScheduler: jest.fn().mockResolvedValue({}),
      getJobSchedulers: jest.fn().mockResolvedValue([]),
      removeJobScheduler: jest.fn().mockResolvedValue(true),
    };

    config = {
      enabled: true,
      timezone: 'UTC',
      jobs: [
        {
          name: 'trackedShows',
          jobType: 'sync-tracked-shows',
          enabled: true,
          pattern: '0 8,20 * * *',
          jobId: 'scheduled-tracked-shows',
          data: {},
        },
        {
          name: 'trending',
          jobType: 'sync-trending-dispatcher',
          enabled: true,
          pattern: '0 */6 * * *',
          jobId: 'scheduled-trending',
          data: { pages: 5, syncStats: true },
        },
        {
          name: 'snapshots',
          jobType: 'sync-snapshots',
          enabled: false,
          pattern: '0 3 * * *',
          jobId: 'scheduled-snapshots',
          data: {},
        },
      ],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionSchedulerService,
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
        { provide: schedulerConfig.KEY, useValue: config },
      ],
    }).compile();

    service = module.get<IngestionSchedulerService>(IngestionSchedulerService);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('onModuleInit', () => {
    it('should setup job schedulers on init (diff-based)', async () => {
      await service.onModuleInit();

      // Should upsert 2 enabled jobs (trackedShows, trending)
      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    });

    it('should upsert schedulers with namespaced id', async () => {
      await service.onModuleInit();

      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledWith(
        `${ENV_PREFIX}:scheduled-tracked-shows`,
        { pattern: '0 8,20 * * *', tz: 'UTC' },
        {
          name: 'sync-tracked-shows',
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 50 },
        },
      );

      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledWith(
        `${ENV_PREFIX}:scheduled-trending`,
        { pattern: '0 */6 * * *', tz: 'UTC' },
        {
          name: 'sync-trending-dispatcher',
          data: { pages: 5, syncStats: true },
          opts: { removeOnComplete: 100, removeOnFail: 50 },
        },
      );
    });

    it('should skip disabled jobs', async () => {
      await service.onModuleInit();

      const calls = ingestionQueue.upsertJobScheduler.mock.calls;
      const snapshotsCalls = calls.filter(
        (call: any[]) => call[0] === `${ENV_PREFIX}:scheduled-snapshots`,
      );
      expect(snapshotsCalls).toHaveLength(0);
    });

    it('should not upsert jobs that already exist with same pattern', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        {
          key: `${ENV_PREFIX}:scheduled-tracked-shows`,
          name: 'sync-tracked-shows',
          pattern: '0 8,20 * * *',
          tz: 'UTC',
        },
      ]);

      await service.onModuleInit();

      // Should only upsert trending (trackedShows already exists with same pattern)
      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledWith(
        `${ENV_PREFIX}:scheduled-trending`,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('diff-based sync with exact key matching', () => {
    it('should remove orphaned schedulers not in config (exact key match)', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        {
          key: `${ENV_PREFIX}:scheduled-old-job`,
          name: 'old-job',
          pattern: '0 * * * *',
          tz: 'UTC',
        },
      ]);

      await service.onModuleInit();

      expect(ingestionQueue.removeJobScheduler).toHaveBeenCalledWith(
        `${ENV_PREFIX}:scheduled-old-job`,
      );
    });

    it('should NOT remove schedulers from other environments (exact prefix check)', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        {
          key: 'prod:scheduled-tracked-shows', // Different env
          name: 'sync-tracked-shows',
          pattern: '0 8,20 * * *',
          tz: 'UTC',
        },
      ]);

      await service.onModuleInit();

      expect(ingestionQueue.removeJobScheduler).not.toHaveBeenCalledWith(
        'prod:scheduled-tracked-shows',
      );
    });

    it('should NOT match similar keys (no substring collision)', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        {
          key: `${ENV_PREFIX}:scheduled-trending-v2`, // Similar but different
          name: 'sync-trending-v2',
          pattern: '0 */6 * * *',
          tz: 'UTC',
        },
      ]);

      await service.onModuleInit();

      // Should remove v2 as orphan (not in our config) and upsert our jobs
      expect(ingestionQueue.removeJobScheduler).toHaveBeenCalledWith(
        `${ENV_PREFIX}:scheduled-trending-v2`,
      );
      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    });

    it('should upsert scheduler when pattern changes', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      ingestionQueue.getJobSchedulers.mockResolvedValue([
        {
          key: `${ENV_PREFIX}:scheduled-tracked-shows`,
          name: 'sync-tracked-shows',
          pattern: '0 6 * * *', // Old pattern (config has 0 8,20 * * *)
          tz: 'UTC',
        },
      ]);

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Pattern changed'));
      expect(ingestionQueue.upsertJobScheduler).toHaveBeenCalledWith(
        `${ENV_PREFIX}:scheduled-tracked-shows`,
        { pattern: '0 8,20 * * *', tz: 'UTC' },
        expect.anything(),
      );
    });
  });

  describe('scheduler disabled', () => {
    it('should NOT modify schedulers when scheduler is disabled (safe mode)', async () => {
      config.enabled = false;

      ingestionQueue.getJobSchedulers.mockResolvedValue([
        {
          key: `${ENV_PREFIX}:scheduled-tracked-shows`,
          name: 'sync-tracked-shows',
          pattern: '0 8,20 * * *',
          tz: 'UTC',
        },
      ]);

      await service.onModuleInit();

      expect(ingestionQueue.upsertJobScheduler).not.toHaveBeenCalled();
      expect(ingestionQueue.removeJobScheduler).not.toHaveBeenCalled();
    });
  });

  describe('getJobSchedulers', () => {
    it('should return only schedulers from current environment', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        { key: `${ENV_PREFIX}:id1`, name: 'job1', pattern: '0 * * * *', tz: 'UTC' },
        { key: 'prod:id2', name: 'job2', pattern: '0 */2 * * *', tz: 'UTC' },
        { key: `${ENV_PREFIX}:id3`, name: 'job3', pattern: '0 */3 * * *', tz: 'UTC' },
        { key: 'other-hash-key', name: 'job4', pattern: '0 */4 * * *', tz: 'UTC' },
      ]);

      const result = await service.getJobSchedulers();

      expect(result).toHaveLength(2);
      expect(result.map((j) => j.key)).toEqual([`${ENV_PREFIX}:id1`, `${ENV_PREFIX}:id3`]);
    });
  });

  describe('removeAllJobSchedulers', () => {
    it('should remove only schedulers from current environment', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        { key: `${ENV_PREFIX}:id1`, name: 'job1', pattern: '0 * * * *', tz: 'UTC' },
        { key: 'prod:id2', name: 'job2', pattern: '0 */2 * * *', tz: 'UTC' },
        { key: `${ENV_PREFIX}:id3`, name: 'job3', pattern: '0 */3 * * *', tz: 'UTC' },
      ]);

      await service.removeAllJobSchedulers();

      expect(ingestionQueue.removeJobScheduler).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.removeJobScheduler).toHaveBeenCalledWith(`${ENV_PREFIX}:id1`);
      expect(ingestionQueue.removeJobScheduler).toHaveBeenCalledWith(`${ENV_PREFIX}:id3`);
      expect(ingestionQueue.removeJobScheduler).not.toHaveBeenCalledWith('prod:id2');
    });
  });

  describe('legacy API', () => {
    it('getRepeatableJobs should delegate to getJobSchedulers', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        { key: `${ENV_PREFIX}:id1`, name: 'job1', pattern: '0 * * * *', tz: 'UTC' },
      ]);

      const result = await service.getRepeatableJobs();

      expect(result).toHaveLength(1);
    });

    it('removeAllRepeatableJobs should delegate to removeAllJobSchedulers', async () => {
      ingestionQueue.getJobSchedulers.mockResolvedValue([
        { key: `${ENV_PREFIX}:id1`, name: 'job1', pattern: '0 * * * *', tz: 'UTC' },
      ]);

      await service.removeAllRepeatableJobs();

      expect(ingestionQueue.removeJobScheduler).toHaveBeenCalledWith(`${ENV_PREFIX}:id1`);
    });
  });
});
