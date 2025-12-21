import { Test, TestingModule } from '@nestjs/testing';
import { IngestionSchedulerService } from './ingestion-scheduler.service';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE } from '../../ingestion.constants';
import schedulerConfig from '../../../../config/scheduler.config';

describe('IngestionSchedulerService', () => {
  let service: IngestionSchedulerService;
  let ingestionQueue: any;
  let config: any;

  beforeEach(async () => {
    ingestionQueue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
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
          enabled: false, // Disabled
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

  describe('onModuleInit', () => {
    it('should setup repeatable jobs on init', async () => {
      await service.onModuleInit();

      // Should add 2 enabled jobs (trackedShows, trending)
      expect(ingestionQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should add jobs with correct config', async () => {
      await service.onModuleInit();

      expect(ingestionQueue.add).toHaveBeenCalledWith(
        'sync-tracked-shows',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 8,20 * * *', tz: 'UTC' },
          jobId: 'scheduled-tracked-shows',
        }),
      );

      expect(ingestionQueue.add).toHaveBeenCalledWith(
        'sync-trending-dispatcher',
        { pages: 5, syncStats: true },
        expect.objectContaining({
          repeat: { pattern: '0 */6 * * *', tz: 'UTC' },
          jobId: 'scheduled-trending',
        }),
      );
    });

    it('should skip disabled jobs', async () => {
      await service.onModuleInit();

      // snapshots is disabled, should not be added
      const calls = ingestionQueue.add.mock.calls;
      const snapshotsCalls = calls.filter((call: any[]) => call[0] === 'sync-snapshots');
      expect(snapshotsCalls).toHaveLength(0);
    });
  });

  describe('cleanupExistingRepeatableJobs', () => {
    it('should remove existing jobs with matching jobIds', async () => {
      ingestionQueue.getRepeatableJobs.mockResolvedValue([
        {
          key: 'sync-tracked-shows:::scheduled-tracked-shows:::0 8,20 * * *',
          pattern: '0 8,20 * * *',
        },
        { key: 'sync-trending:::scheduled-trending:::0 */6 * * *', pattern: '0 */6 * * *' },
      ]);

      await service.onModuleInit();

      expect(ingestionQueue.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    });

    it('should not remove jobs not in config', async () => {
      ingestionQueue.getRepeatableJobs.mockResolvedValue([
        { key: 'some-other-job:::other-id:::0 * * * *', pattern: '0 * * * *' },
      ]);

      await service.onModuleInit();

      expect(ingestionQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });

    it('should log pattern changes', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      ingestionQueue.getRepeatableJobs.mockResolvedValue([
        {
          key: 'sync-tracked-shows:::scheduled-tracked-shows:::0 6 * * *',
          pattern: '0 6 * * *', // Old pattern
        },
      ]);

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Pattern changed'));
    });
  });

  describe('getRepeatableJobs', () => {
    it('should return list of repeatable jobs', async () => {
      const mockJobs = [
        { key: 'job1', pattern: '0 * * * *' },
        { key: 'job2', pattern: '0 */2 * * *' },
      ];
      ingestionQueue.getRepeatableJobs.mockResolvedValue(mockJobs);

      const result = await service.getRepeatableJobs();

      expect(result).toEqual(mockJobs);
    });
  });

  describe('removeAllRepeatableJobs', () => {
    it('should remove all repeatable jobs', async () => {
      ingestionQueue.getRepeatableJobs.mockResolvedValue([
        { key: 'job1' },
        { key: 'job2' },
        { key: 'job3' },
      ]);

      await service.removeAllRepeatableJobs();

      expect(ingestionQueue.removeRepeatableByKey).toHaveBeenCalledTimes(3);
      expect(ingestionQueue.removeRepeatableByKey).toHaveBeenCalledWith('job1');
      expect(ingestionQueue.removeRepeatableByKey).toHaveBeenCalledWith('job2');
      expect(ingestionQueue.removeRepeatableByKey).toHaveBeenCalledWith('job3');
    });
  });
});
