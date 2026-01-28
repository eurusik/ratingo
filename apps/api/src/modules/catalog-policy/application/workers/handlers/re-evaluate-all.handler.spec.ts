import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../../catalog-policy.constants';
import { EvaluationContext, RunStatus } from '../../../domain/constants/evaluation.constants';
import { RunNotFoundError } from '../../../domain/errors';
import { CATALOG_EVALUATION_RUN_REPOSITORY } from '../../../domain/repositories';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import { RunFinalizeService } from '../../services/run-finalize.service';
import type { ReEvaluateAllPayload } from '../types/job-payloads';

import { ReEvaluateAllHandler } from './re-evaluate-all.handler';

describe('ReEvaluateAllHandler', () => {
  let handler: ReEvaluateAllHandler;
  let mockDb: {
    select: jest.Mock;
  };
  let mockRunRepository: {
    findById: jest.Mock;
    update: jest.Mock;
  };
  let mockFinalizeService: {
    finalizeRun: jest.Mock;
  };
  let mockQueue: {
    addBulk: jest.Mock;
  };

  beforeEach(async () => {
    // Mock chainable Drizzle query builder
    const mockQueryBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    mockDb = {
      select: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRunRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockFinalizeService = {
      finalizeRun: jest.fn(),
    };

    mockQueue = {
      addBulk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReEvaluateAllHandler,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: CATALOG_EVALUATION_RUN_REPOSITORY,
          useValue: mockRunRepository,
        },
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

    handler = module.get<ReEvaluateAllHandler>(ReEvaluateAllHandler);

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handle', () => {
    const validPayload: ReEvaluateAllPayload = {
      runId: 'run-123',
      policyVersion: 1,
      context: EvaluationContext.CATALOG,
      batchSize: 100,
    };

    const mockRun = {
      id: 'run-123',
      status: RunStatus.RUNNING,
      snapshotCutoff: new Date('2024-01-01'),
    };

    describe('when context is missing', () => {
      it('should skip processing without fetching run', async () => {
        const payloadWithoutContext = {
          runId: 'run-123',
          policyVersion: 1,
        } as ReEvaluateAllPayload;

        await handler.handle(payloadWithoutContext);

        expect(mockRunRepository.findById).not.toHaveBeenCalled();
        expect(mockQueue.addBulk).not.toHaveBeenCalled();
      });
    });

    describe('when run is not found', () => {
      it('should throw RunNotFoundError', async () => {
        mockRunRepository.findById.mockResolvedValue(null);

        await expect(handler.handle(validPayload)).rejects.toThrow(RunNotFoundError);
      });
    });

    describe('when run is cancelled', () => {
      it('should stop processing immediately', async () => {
        mockRunRepository.findById.mockResolvedValue({
          ...mockRun,
          status: RunStatus.CANCELLED,
        });

        await handler.handle(validPayload);

        expect(mockQueue.addBulk).not.toHaveBeenCalled();
      });
    });

    describe('batch dispatching', () => {
      it('should dispatch evaluation jobs for each item in batch', async () => {
        const mockItems = [{ id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }];

        mockRunRepository.findById.mockResolvedValue(mockRun);

        // First call returns items, second call returns empty (end of items)
        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValueOnce(mockItems).mockResolvedValueOnce([]),
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        expect(mockQueue.addBulk).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
              data: expect.objectContaining({
                runId: 'run-123',
                policyVersion: 1,
                mediaItemId: 'item-1',
                context: EvaluationContext.CATALOG,
              }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ mediaItemId: 'item-2' }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ mediaItemId: 'item-3' }),
            }),
          ]),
        );
      });

      it('should include context in job ID for uniqueness', async () => {
        const mockItems = [{ id: 'item-1' }];

        mockRunRepository.findById.mockResolvedValue(mockRun);

        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValueOnce(mockItems).mockResolvedValueOnce([]),
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        expect(mockQueue.addBulk).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              opts: expect.objectContaining({
                jobId: 'eval_run-123_item-1_catalog',
              }),
            }),
          ]),
        );
      });

      it('should update cursor after each batch', async () => {
        const mockItems = [{ id: 'item-1' }, { id: 'item-2' }];

        mockRunRepository.findById.mockResolvedValue(mockRun);

        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValueOnce(mockItems).mockResolvedValueOnce([]),
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        expect(mockRunRepository.update).toHaveBeenCalledWith('run-123', {
          cursor: 'item-2', // Last item in batch
        });
      });
    });

    describe('finalization', () => {
      it('should attempt finalization when all items dispatched', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]), // No items
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        expect(mockFinalizeService.finalizeRun).toHaveBeenCalledWith('run-123');
      });

      it('should not throw when finalization fails', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        mockFinalizeService.finalizeRun.mockRejectedValue(new Error('Finalize failed'));

        await expect(handler.handle(validPayload)).resolves.not.toThrow();
      });

      it('should log warning when finalization fails', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        mockFinalizeService.finalizeRun.mockRejectedValue(new Error('Finalize failed'));
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');

        await handler.handle(validPayload);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('watchdog will retry'));
      });
    });

    describe('cancellation during processing', () => {
      it('should stop when run becomes cancelled mid-processing', async () => {
        const mockItems = [{ id: 'item-1' }];

        // First call: running, second call: cancelled
        mockRunRepository.findById
          .mockResolvedValueOnce(mockRun)
          .mockResolvedValueOnce({ ...mockRun, status: RunStatus.CANCELLED });

        const mockQueryBuilder = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(mockItems),
        };
        mockDb.select.mockReturnValue(mockQueryBuilder);

        await handler.handle(validPayload);

        // Should not dispatch any jobs because run was cancelled on second check
        expect(mockQueue.addBulk).not.toHaveBeenCalled();
      });
    });
  });
});
