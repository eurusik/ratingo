import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { type Job } from 'bullmq';

import { CATALOG_POLICY_JOBS } from '../../catalog-policy.constants';
import { EvaluationContext } from '../../domain/constants/evaluation.constants';

import { CatalogPolicyWorker } from './catalog-policy.worker';
import { ReEvaluateAllHandler, EvaluateItemHandler, WatchdogHandler } from './handlers';

describe('CatalogPolicyWorker', () => {
  let worker: CatalogPolicyWorker;
  let mockReEvaluateAllHandler: { handle: jest.Mock };
  let mockEvaluateItemHandler: { handle: jest.Mock };
  let mockWatchdogHandler: { handle: jest.Mock };

  beforeEach(async () => {
    mockReEvaluateAllHandler = { handle: jest.fn() };
    mockEvaluateItemHandler = { handle: jest.fn() };
    mockWatchdogHandler = { handle: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogPolicyWorker,
        {
          provide: ReEvaluateAllHandler,
          useValue: mockReEvaluateAllHandler,
        },
        {
          provide: EvaluateItemHandler,
          useValue: mockEvaluateItemHandler,
        },
        {
          provide: WatchdogHandler,
          useValue: mockWatchdogHandler,
        },
      ],
    }).compile();

    worker = module.get<CatalogPolicyWorker>(CatalogPolicyWorker);

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('process', () => {
    describe('RE_EVALUATE_ALL job', () => {
      it('should delegate to ReEvaluateAllHandler', async () => {
        const payload = {
          runId: 'run-123',
          policyVersion: 1,
          context: EvaluationContext.CATALOG,
        };
        const job = {
          id: 'job-1',
          name: CATALOG_POLICY_JOBS.RE_EVALUATE_ALL,
          data: payload,
        } as Job;

        await worker.process(job);

        expect(mockReEvaluateAllHandler.handle).toHaveBeenCalledWith(payload);
        expect(mockEvaluateItemHandler.handle).not.toHaveBeenCalled();
        expect(mockWatchdogHandler.handle).not.toHaveBeenCalled();
      });

      it('should propagate errors from handler', async () => {
        const job = {
          id: 'job-1',
          name: CATALOG_POLICY_JOBS.RE_EVALUATE_ALL,
          data: {},
        } as Job;

        mockReEvaluateAllHandler.handle.mockRejectedValue(new Error('Handler error'));

        await expect(worker.process(job)).rejects.toThrow('Handler error');
      });
    });

    describe('EVALUATE_CATALOG_ITEM job', () => {
      it('should delegate to EvaluateItemHandler', async () => {
        const payload = {
          runId: 'run-123',
          policyVersion: 1,
          mediaItemId: 'item-456',
          context: EvaluationContext.TRENDING,
        };
        const job = {
          id: 'job-2',
          name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
          data: payload,
        } as Job;

        await worker.process(job);

        expect(mockEvaluateItemHandler.handle).toHaveBeenCalledWith(payload);
        expect(mockReEvaluateAllHandler.handle).not.toHaveBeenCalled();
        expect(mockWatchdogHandler.handle).not.toHaveBeenCalled();
      });

      it('should propagate errors from handler', async () => {
        const job = {
          id: 'job-2',
          name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
          data: {},
        } as Job;

        mockEvaluateItemHandler.handle.mockRejectedValue(new Error('Evaluation failed'));

        await expect(worker.process(job)).rejects.toThrow('Evaluation failed');
      });
    });

    describe('WATCHDOG job', () => {
      it('should delegate to WatchdogHandler', async () => {
        const job = {
          id: 'job-3',
          name: CATALOG_POLICY_JOBS.WATCHDOG,
          data: {},
        } as Job;

        await worker.process(job);

        expect(mockWatchdogHandler.handle).toHaveBeenCalled();
        expect(mockReEvaluateAllHandler.handle).not.toHaveBeenCalled();
        expect(mockEvaluateItemHandler.handle).not.toHaveBeenCalled();
      });

      it('should propagate errors from handler', async () => {
        const job = {
          id: 'job-3',
          name: CATALOG_POLICY_JOBS.WATCHDOG,
          data: {},
        } as Job;

        mockWatchdogHandler.handle.mockRejectedValue(new Error('Watchdog error'));

        await expect(worker.process(job)).rejects.toThrow('Watchdog error');
      });
    });

    describe('unknown job type', () => {
      it('should log warning and not call any handler', async () => {
        const job = {
          id: 'job-4',
          name: 'unknown-job-type',
          data: {},
        } as Job;
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');

        await worker.process(job);

        expect(warnSpy).toHaveBeenCalledWith('Unknown job type: unknown-job-type');
        expect(mockReEvaluateAllHandler.handle).not.toHaveBeenCalled();
        expect(mockEvaluateItemHandler.handle).not.toHaveBeenCalled();
        expect(mockWatchdogHandler.handle).not.toHaveBeenCalled();
      });
    });

    describe('error logging', () => {
      it('should log error with job ID when handler fails', async () => {
        const job = {
          id: 'job-error',
          name: CATALOG_POLICY_JOBS.WATCHDOG,
          data: {},
        } as Job;
        const error = new Error('Test error');
        error.stack = 'Error stack trace';
        mockWatchdogHandler.handle.mockRejectedValue(error);

        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        await expect(worker.process(job)).rejects.toThrow();

        expect(errorSpy).toHaveBeenCalledWith(
          'Job job-error failed: Test error',
          'Error stack trace',
        );
      });
    });

    describe('job routing isolation', () => {
      it('should only call one handler per job', async () => {
        const jobs = [
          {
            id: 'job-1',
            name: CATALOG_POLICY_JOBS.RE_EVALUATE_ALL,
            data: { runId: 'r1', policyVersion: 1, context: EvaluationContext.CATALOG },
          },
          {
            id: 'job-2',
            name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
            data: {
              runId: 'r1',
              policyVersion: 1,
              mediaItemId: 'i1',
              context: EvaluationContext.CATALOG,
            },
          },
          {
            id: 'job-3',
            name: CATALOG_POLICY_JOBS.WATCHDOG,
            data: {},
          },
        ] as Job[];

        for (const job of jobs) {
          jest.clearAllMocks();
          await worker.process(job);

          const handlerCalls = [
            mockReEvaluateAllHandler.handle.mock.calls.length,
            mockEvaluateItemHandler.handle.mock.calls.length,
            mockWatchdogHandler.handle.mock.calls.length,
          ];

          // Exactly one handler should be called
          expect(handlerCalls.filter((c) => c === 1).length).toBe(1);
          expect(handlerCalls.filter((c) => c === 0).length).toBe(2);
        }
      });
    });
  });
});
