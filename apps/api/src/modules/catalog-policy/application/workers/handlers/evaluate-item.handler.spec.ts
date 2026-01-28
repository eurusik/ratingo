import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EvaluationContext, RunStatus } from '../../../domain/constants/evaluation.constants';
import { CATALOG_EVALUATION_RUN_REPOSITORY } from '../../../domain/repositories';
import { CatalogEvaluationService } from '../../services/catalog-evaluation.service';
import type { EvaluateCatalogItemPayload } from '../types/job-payloads';

import { EvaluateItemHandler } from './evaluate-item.handler';

describe('EvaluateItemHandler', () => {
  let handler: EvaluateItemHandler;
  let mockRunRepository: {
    findById: jest.Mock;
    recordError: jest.Mock;
  };
  let mockEvaluationService: {
    evaluateOne: jest.Mock;
  };

  beforeEach(async () => {
    mockRunRepository = {
      findById: jest.fn(),
      recordError: jest.fn(),
    };

    mockEvaluationService = {
      evaluateOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluateItemHandler,
        {
          provide: CATALOG_EVALUATION_RUN_REPOSITORY,
          useValue: mockRunRepository,
        },
        {
          provide: CatalogEvaluationService,
          useValue: mockEvaluationService,
        },
      ],
    }).compile();

    handler = module.get<EvaluateItemHandler>(EvaluateItemHandler);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handle', () => {
    const validPayload: EvaluateCatalogItemPayload = {
      runId: 'run-123',
      policyVersion: 1,
      mediaItemId: 'item-456',
      context: EvaluationContext.CATALOG,
    };

    const mockRun = {
      id: 'run-123',
      status: RunStatus.RUNNING,
    };

    describe('successful evaluation', () => {
      it('should evaluate item when run is valid', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);
        mockEvaluationService.evaluateOne.mockResolvedValue({});

        await handler.handle(validPayload);

        expect(mockEvaluationService.evaluateOne).toHaveBeenCalledWith({
          mediaItemId: 'item-456',
          policyVersion: 1,
          runId: 'run-123',
          context: EvaluationContext.CATALOG,
        });
      });

      it('should pass context from payload to evaluation service', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);
        mockEvaluationService.evaluateOne.mockResolvedValue({});

        const trendingPayload = { ...validPayload, context: EvaluationContext.TRENDING };
        await handler.handle(trendingPayload);

        expect(mockEvaluationService.evaluateOne).toHaveBeenCalledWith(
          expect.objectContaining({ context: EvaluationContext.TRENDING }),
        );
      });
    });

    describe('when context is missing', () => {
      it('should skip processing without evaluating', async () => {
        const payloadWithoutContext = {
          runId: 'run-123',
          policyVersion: 1,
          mediaItemId: 'item-456',
        } as EvaluateCatalogItemPayload;

        await handler.handle(payloadWithoutContext);

        expect(mockRunRepository.findById).not.toHaveBeenCalled();
        expect(mockEvaluationService.evaluateOne).not.toHaveBeenCalled();
      });
    });

    describe('when run is not found', () => {
      it('should skip processing without evaluating', async () => {
        mockRunRepository.findById.mockResolvedValue(null);

        await handler.handle(validPayload);

        expect(mockEvaluationService.evaluateOne).not.toHaveBeenCalled();
      });

      it('should log warning', async () => {
        mockRunRepository.findById.mockResolvedValue(null);
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');

        await handler.handle(validPayload);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Run run-123 not found'));
      });
    });

    describe('when run is cancelled', () => {
      it('should skip processing without evaluating', async () => {
        mockRunRepository.findById.mockResolvedValue({
          ...mockRun,
          status: RunStatus.CANCELLED,
        });

        await handler.handle(validPayload);

        expect(mockEvaluationService.evaluateOne).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should record error when evaluation fails', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);
        mockEvaluationService.evaluateOne.mockRejectedValue(new Error('Evaluation failed'));

        await handler.handle(validPayload);

        expect(mockRunRepository.recordError).toHaveBeenCalledWith(
          'run-123',
          expect.objectContaining({
            mediaItemId: 'item-456',
            error: 'Evaluation failed',
            timestamp: expect.any(String),
          }),
        );
      });

      it('should truncate stack trace to 500 characters', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);
        const longStack = 'a'.repeat(1000);
        const error = new Error('Test error');
        error.stack = longStack;
        mockEvaluationService.evaluateOne.mockRejectedValue(error);

        await handler.handle(validPayload);

        expect(mockRunRepository.recordError).toHaveBeenCalledWith(
          'run-123',
          expect.objectContaining({
            stack: expect.any(String),
          }),
        );

        const recordedError = mockRunRepository.recordError.mock.calls[0][1];
        expect(recordedError.stack.length).toBeLessThanOrEqual(500);
      });

      it('should handle non-Error objects', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);
        mockEvaluationService.evaluateOne.mockRejectedValue('String error');

        await handler.handle(validPayload);

        expect(mockRunRepository.recordError).toHaveBeenCalledWith(
          'run-123',
          expect.objectContaining({
            error: 'String error',
          }),
        );
      });

      it('should not throw when evaluation fails', async () => {
        mockRunRepository.findById.mockResolvedValue(mockRun);
        mockEvaluationService.evaluateOne.mockRejectedValue(new Error('Evaluation failed'));

        await expect(handler.handle(validPayload)).resolves.not.toThrow();
      });
    });
  });
});
