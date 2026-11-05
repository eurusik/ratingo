import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import {
  CATALOG_POLICY_QUEUE,
  CATALOG_POLICY_JOBS,
  EVALUATE_ITEM_JOB_OPTIONS,
} from '../../../catalog-policy.constants';
import { EvaluationContext, RunStatus } from '../../../domain/constants/evaluation.constants';
import { RunNotFoundError } from '../../../domain/errors';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  POLICY_INPUT_REPOSITORY,
} from '../../../domain/repositories';
import { RunFinalizeService } from '../../services/run-finalize.service';
import type { ReEvaluateAllPayload } from '../types/job-payloads';

import { ReEvaluateAllHandler } from './re-evaluate-all.handler';

describe('ReEvaluateAllHandler', () => {
  let handler: ReEvaluateAllHandler;
  let mockPolicyInputRepository: {
    fetchBatchIds: jest.Mock;
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
    mockPolicyInputRepository = {
      fetchBatchIds: jest.fn().mockResolvedValue([]),
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
          provide: POLICY_INPUT_REPOSITORY,
          useValue: mockPolicyInputRepository,
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
        const mockItems = ['item-1', 'item-2', 'item-3'];

        mockRunRepository.findById.mockResolvedValue(mockRun);

        // First call returns items, second call returns empty (end of items)
        mockPolicyInputRepository.fetchBatchIds
          .mockResolvedValueOnce(mockItems)
          .mockResolvedValueOnce([]);

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
        const mockItems = ['item-1'];

        mockRunRepository.findById.mockResolvedValue(mockRun);

        mockPolicyInputRepository.fetchBatchIds
          .mockResolvedValueOnce(mockItems)
          .mockResolvedValueOnce([]);

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

      it('should configure retries with backoff on item jobs', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        mockPolicyInputRepository.fetchBatchIds
          .mockResolvedValueOnce(['item-1'])
          .mockResolvedValueOnce([]);
        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        const [jobs] = mockQueue.addBulk.mock.calls[0];
        expect(jobs[0].opts).toEqual(
          expect.objectContaining({
            attempts: EVALUATE_ITEM_JOB_OPTIONS.attempts,
            backoff: EVALUATE_ITEM_JOB_OPTIONS.backoff,
          }),
        );
        expect(jobs[0].opts.attempts).toBeGreaterThan(1);
      });

      it('should update cursor after each batch', async () => {
        const mockItems = ['item-1', 'item-2'];

        mockRunRepository.findById.mockResolvedValue(mockRun);

        mockPolicyInputRepository.fetchBatchIds
          .mockResolvedValueOnce(mockItems)
          .mockResolvedValueOnce([]);

        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        expect(mockRunRepository.update).toHaveBeenCalledWith('run-123', {
          cursor: 'item-2', // Last item in batch
        });
      });
    });

    describe('afterSnapshot mode (items synced after the snapshot cutoff)', () => {
      const postSnapshotPayload: ReEvaluateAllPayload = { ...validPayload, afterSnapshot: true };

      it('should dispatch distinct job IDs, skip cursor persistence and skip finalization', async () => {
        mockRunRepository.findById.mockResolvedValue({ ...mockRun, status: RunStatus.PROMOTED });

        mockPolicyInputRepository.fetchBatchIds
          .mockResolvedValueOnce(['item-9'])
          .mockResolvedValueOnce([]);

        await handler.handle(postSnapshotPayload);

        expect(mockQueue.addBulk).toHaveBeenCalledWith([
          expect.objectContaining({
            data: expect.objectContaining({ mediaItemId: 'item-9', policyVersion: 1 }),
            opts: expect.objectContaining({ jobId: 'eval_post_run-123_item-9_catalog' }),
          }),
        ]);
        expect(mockPolicyInputRepository.fetchBatchIds).toHaveBeenCalledWith({
          batchSize: 100,
          cursor: undefined,
          updatedAfter: mockRun.snapshotCutoff,
        });
        expect(mockRunRepository.update).not.toHaveBeenCalled();
        expect(mockFinalizeService.finalizeRun).not.toHaveBeenCalled();
      });
    });

    describe('finalization', () => {
      it('should attempt finalization when all items dispatched', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        mockPolicyInputRepository.fetchBatchIds.mockResolvedValue([]);
        mockFinalizeService.finalizeRun.mockResolvedValue({ finalized: true });

        await handler.handle(validPayload);

        expect(mockFinalizeService.finalizeRun).toHaveBeenCalledWith('run-123');
      });

      it('should not throw when finalization fails', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        mockPolicyInputRepository.fetchBatchIds.mockResolvedValue([]);

        mockFinalizeService.finalizeRun.mockRejectedValue(new Error('Finalize failed'));

        await expect(handler.handle(validPayload)).resolves.not.toThrow();
      });

      it('should log warning when finalization fails', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);

        mockPolicyInputRepository.fetchBatchIds.mockResolvedValue([]);

        mockFinalizeService.finalizeRun.mockRejectedValue(new Error('Finalize failed'));
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');

        await handler.handle(validPayload);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('watchdog will retry'));
      });
    });

    describe('cancellation during processing', () => {
      it('should stop when run becomes cancelled mid-processing', async () => {
        const mockItems = ['item-1'];

        // First call: running, second call: cancelled
        mockRunRepository.findById
          .mockResolvedValueOnce(mockRun)
          .mockResolvedValueOnce({ ...mockRun, status: RunStatus.CANCELLED });

        mockPolicyInputRepository.fetchBatchIds.mockResolvedValue(mockItems);

        await handler.handle(validPayload);

        // Should not dispatch any jobs because run was cancelled on second check
        expect(mockQueue.addBulk).not.toHaveBeenCalled();
      });
    });
  });
});
