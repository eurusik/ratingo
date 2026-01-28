import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../../catalog-policy.constants';
import { RunFinalizeService } from '../../services/run-finalize.service';

import { WatchdogHandler } from './watchdog.handler';

describe('WatchdogHandler', () => {
  let handler: WatchdogHandler;
  let mockFinalizeService: {
    finalizeStaleRuns: jest.Mock;
  };
  let mockQueue: {
    client: Promise<{
      set: jest.Mock;
    }>;
    getRepeatableJobs: jest.Mock;
    removeRepeatableByKey: jest.Mock;
    add: jest.Mock;
  };

  beforeEach(async () => {
    mockFinalizeService = {
      finalizeStaleRuns: jest.fn(),
    };

    mockQueue = {
      client: Promise.resolve({
        set: jest.fn(),
      }),
      getRepeatableJobs: jest.fn(),
      removeRepeatableByKey: jest.fn(),
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchdogHandler,
        {
          provide: RunFinalizeService,
          useValue: mockFinalizeService,
        },
        {
          provide: getQueueToken(CATALOG_POLICY_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    handler = module.get<WatchdogHandler>(WatchdogHandler);

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should acquire lock and schedule watchdog job', async () => {
      const mockClient = { set: jest.fn().mockResolvedValue('OK') };
      mockQueue.client = Promise.resolve(mockClient);
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await handler.onModuleInit();

      expect(mockClient.set).toHaveBeenCalledWith(
        'catalog-policy:watchdog:register-lock',
        expect.any(String),
        'PX',
        10000,
        'NX',
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        CATALOG_POLICY_JOBS.WATCHDOG,
        {},
        expect.objectContaining({
          repeat: { every: 60000 },
          jobId: 'catalog-policy-watchdog',
        }),
      );
    });

    it('should skip scheduling when lock not acquired', async () => {
      const mockClient = { set: jest.fn().mockResolvedValue(null) };
      mockQueue.client = Promise.resolve(mockClient);

      await handler.onModuleInit();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should remove existing watchdog jobs before scheduling', async () => {
      const mockClient = { set: jest.fn().mockResolvedValue('OK') };
      mockQueue.client = Promise.resolve(mockClient);
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { name: CATALOG_POLICY_JOBS.WATCHDOG, key: 'old-key-1' },
        { name: CATALOG_POLICY_JOBS.WATCHDOG, key: 'old-key-2' },
        { name: 'other-job', key: 'other-key' },
      ]);

      await handler.onModuleInit();

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('old-key-1');
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('old-key-2');
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalledWith('other-key');
    });

    it('should handle errors gracefully', async () => {
      mockQueue.client = Promise.reject(new Error('Redis connection failed'));

      await expect(handler.onModuleInit()).resolves.not.toThrow();
    });

    it('should log error when scheduling fails', async () => {
      mockQueue.client = Promise.reject(new Error('Redis connection failed'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await handler.onModuleInit();

      expect(errorSpy).toHaveBeenCalledWith('Failed to schedule watchdog job', expect.any(Error));
    });
  });

  describe('handle', () => {
    it('should call finalizeStaleRuns with correct max age', async () => {
      mockFinalizeService.finalizeStaleRuns.mockResolvedValue([]);

      await handler.handle();

      expect(mockFinalizeService.finalizeStaleRuns).toHaveBeenCalledWith(1); // STALE_RUN_MAX_AGE_MINUTES
    });

    it('should log when runs are finalized', async () => {
      mockFinalizeService.finalizeStaleRuns.mockResolvedValue([
        { finalized: true },
        { finalized: true },
      ]);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await handler.handle();

      expect(logSpy).toHaveBeenCalledWith('Watchdog finalized 2 runs');
    });

    it('should log debug when runs are still processing', async () => {
      mockFinalizeService.finalizeStaleRuns.mockResolvedValue([
        { finalized: false, reason: 'still processing' },
      ]);
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await handler.handle();

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('1 runs still processing'));
    });

    it('should handle empty results', async () => {
      mockFinalizeService.finalizeStaleRuns.mockResolvedValue([]);

      await expect(handler.handle()).resolves.not.toThrow();
    });

    it('should handle mixed results', async () => {
      mockFinalizeService.finalizeStaleRuns.mockResolvedValue([
        { finalized: true },
        { finalized: false, reason: 'still processing' },
        { finalized: true },
        { finalized: false, reason: 'waiting for jobs' },
      ]);
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await handler.handle();

      expect(logSpy).toHaveBeenCalledWith('Watchdog finalized 2 runs');
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('2 runs still processing'));
    });

    it('should not throw when finalization fails', async () => {
      mockFinalizeService.finalizeStaleRuns.mockRejectedValue(new Error('Database error'));

      await expect(handler.handle()).resolves.not.toThrow();
    });

    it('should log error when finalization fails', async () => {
      mockFinalizeService.finalizeStaleRuns.mockRejectedValue(new Error('Database error'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await handler.handle();

      expect(errorSpy).toHaveBeenCalledWith(
        'Watchdog error during stale run finalization',
        expect.objectContaining({
          errorMessage: 'Database error',
        }),
      );
    });
  });
});
