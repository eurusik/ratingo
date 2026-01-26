/**
 * Run Finalize Service Tests
 *
 * Unit tests for run finalization logic with mocked repository.
 */

import { Test, TestingModule } from '@nestjs/testing';

import { RunStatus } from '../../domain/constants/evaluation.constants';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
  type CatalogEvaluationRun,
} from '../../domain/repositories';
import { type AggregatedCounters } from '../../domain/types';

import { RunAggregationService } from './run-aggregation.service';
import { RunFinalizeService } from './run-finalize.service';

describe('RunFinalizeService', () => {
  let service: RunFinalizeService;
  let mockRunRepository: jest.Mocked<ICatalogEvaluationRunRepository>;
  let mockAggregationService: jest.Mocked<RunAggregationService>;

  const createMockRun = (overrides: Partial<CatalogEvaluationRun> = {}): CatalogEvaluationRun => ({
    id: 'run-123',
    policyVersion: 2,
    status: RunStatus.RUNNING,
    startedAt: new Date('2024-01-01'),
    finishedAt: null,
    cursor: null,
    targetPolicyId: 'policy-1',
    targetPolicyVersion: 2,
    baselinePolicyVersion: 1,
    totalReadySnapshot: 100,
    snapshotCutoff: new Date('2024-01-01'),
    processed: 0,
    eligible: 0,
    ineligible: 0,
    errors: 0,
    errorSample: [],
    promotedAt: null,
    promotedBy: null,
    ...overrides,
  });

  const createMockCounters = (overrides: Partial<AggregatedCounters> = {}): AggregatedCounters => ({
    processed: 100,
    eligible: 80,
    ineligible: 15,
    review: 5,
    errors: 0,
    ...overrides,
  });

  beforeEach(async () => {
    mockRunRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      incrementCounters: jest.fn(),
      recordError: jest.fn(),
      findByPolicyId: jest.fn(),
      findByStatus: jest.fn(),
      findAll: jest.fn(),
      aggregateCounters: jest.fn(),
      syncRunCounters: jest.fn(),
      findStaleRunning: jest.fn(),
      recordAnomaly: jest.fn(),
      transitionToPrepared: jest.fn(),
    };

    mockAggregationService = {
      aggregateCounters: jest.fn(),
      syncRunCounters: jest.fn(),
    } as unknown as jest.Mocked<RunAggregationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunFinalizeService,
        { provide: CATALOG_EVALUATION_RUN_REPOSITORY, useValue: mockRunRepository },
        { provide: RunAggregationService, useValue: mockAggregationService },
      ],
    }).compile();

    service = module.get<RunFinalizeService>(RunFinalizeService);
  });

  describe('finalizeRun', () => {
    it('should return not found when run does not exist', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      const result = await service.finalizeRun('run-123');

      expect(result.finalized).toBe(false);
      expect(result.reason).toBe('Run not found');
    });

    it('should return already terminal when run is not RUNNING', async () => {
      mockRunRepository.findById.mockResolvedValue(createMockRun({ status: RunStatus.PREPARED }));

      const result = await service.finalizeRun('run-123');

      expect(result.finalized).toBe(false);
      expect(result.reason).toContain('already in terminal state');
    });

    it('should return still processing when processed < total', async () => {
      mockRunRepository.findById.mockResolvedValue(createMockRun({ totalReadySnapshot: 100 }));
      mockAggregationService.aggregateCounters.mockResolvedValue(
        createMockCounters({ processed: 50 }),
      );
      mockAggregationService.syncRunCounters.mockResolvedValue(
        createMockCounters({ processed: 50 }),
      );

      const result = await service.finalizeRun('run-123');

      expect(result.finalized).toBe(false);
      expect(result.reason).toContain('Still processing');
      expect(mockAggregationService.syncRunCounters).toHaveBeenCalledWith('run-123');
    });

    it('should finalize successfully when processed >= total', async () => {
      mockRunRepository.findById.mockResolvedValue(createMockRun({ totalReadySnapshot: 100 }));
      mockAggregationService.aggregateCounters.mockResolvedValue(createMockCounters());
      mockRunRepository.transitionToPrepared.mockResolvedValue(true);

      const result = await service.finalizeRun('run-123');

      expect(result.finalized).toBe(true);
      expect(result.reason).toBe('Successfully finalized');
      expect(mockRunRepository.transitionToPrepared).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ processed: 100 }),
      );
    });

    it('should return already transitioned when race condition occurs', async () => {
      mockRunRepository.findById.mockResolvedValue(createMockRun({ totalReadySnapshot: 100 }));
      mockAggregationService.aggregateCounters.mockResolvedValue(createMockCounters());
      mockRunRepository.transitionToPrepared.mockResolvedValue(false);

      const result = await service.finalizeRun('run-123');

      expect(result.finalized).toBe(false);
      expect(result.reason).toContain('already transitioned');
    });

    it('should record anomaly when processed > total', async () => {
      mockRunRepository.findById.mockResolvedValue(createMockRun({ totalReadySnapshot: 100 }));
      mockAggregationService.aggregateCounters.mockResolvedValue(
        createMockCounters({ processed: 150 }),
      );
      mockRunRepository.transitionToPrepared.mockResolvedValue(true);

      await service.finalizeRun('run-123');

      expect(mockRunRepository.recordAnomaly).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({
          type: 'ANOMALY_PROCESSED_GT_TOTAL',
          processed: 150,
          total: 100,
        }),
      );
    });

    it('should continue finalization even if anomaly recording fails', async () => {
      mockRunRepository.findById.mockResolvedValue(createMockRun({ totalReadySnapshot: 100 }));
      mockAggregationService.aggregateCounters.mockResolvedValue(
        createMockCounters({ processed: 150 }),
      );
      mockRunRepository.recordAnomaly.mockRejectedValue(new Error('DB error'));
      mockRunRepository.transitionToPrepared.mockResolvedValue(true);

      const result = await service.finalizeRun('run-123');

      expect(result.finalized).toBe(true);
    });
  });

  describe('finalizeStaleRuns', () => {
    it('should return empty array when no stale runs exist', async () => {
      mockRunRepository.findStaleRunning.mockResolvedValue([]);

      const result = await service.finalizeStaleRuns();

      expect(result).toEqual([]);
    });

    it('should finalize each stale run', async () => {
      mockRunRepository.findStaleRunning.mockResolvedValue([{ id: 'run-1' }, { id: 'run-2' }]);
      mockRunRepository.findById.mockResolvedValue(createMockRun({ totalReadySnapshot: 100 }));
      mockAggregationService.aggregateCounters.mockResolvedValue(createMockCounters());
      mockRunRepository.transitionToPrepared.mockResolvedValue(true);

      const result = await service.finalizeStaleRuns();

      expect(result).toHaveLength(2);
      expect(mockRunRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('should use provided maxAgeMinutes for cutoff calculation', async () => {
      mockRunRepository.findStaleRunning.mockResolvedValue([]);

      await service.finalizeStaleRuns(10);

      expect(mockRunRepository.findStaleRunning).toHaveBeenCalledWith(expect.any(Date));
    });

    it('should use default maxAgeMinutes when not provided', async () => {
      mockRunRepository.findStaleRunning.mockResolvedValue([]);

      await service.finalizeStaleRuns();

      // Default is 5 minutes
      expect(mockRunRepository.findStaleRunning).toHaveBeenCalled();
    });
  });
});
