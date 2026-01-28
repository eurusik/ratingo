/**
 * Catalog Evaluation Run Repository Tests
 *
 * Unit tests for repository methods including:
 * - validateStatus (fail-fast validation: throws InvalidRunStatusError for legacy/unknown values)
 * - incrementCounters (atomic SQL operations)
 * - recordError (atomic error recording)
 *
 * Feature: policy-activation-flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import { type CatalogEvaluationRun } from '../../domain/repositories';
import { CatalogEvaluationRunRepository } from './catalog-evaluation-run.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { InvalidRunStatusError } from '../../domain/errors/policy.errors';
import { DatabaseException } from '../../../../common/exceptions';

describe('CatalogEvaluationRunRepository', () => {
  let repository: CatalogEvaluationRunRepository;
  let mockDb: any;

  // Helper to create mock row with DB schema shape
  const createMockRow = (overrides: Partial<any> = {}) => ({
    id: 'run-123',
    policyVersion: 2,
    status: 'running',
    startedAt: new Date('2024-01-01'),
    finishedAt: null,
    cursor: null,
    counters: { processed: 0, eligible: 0, ineligible: 0, review: 0, reasonBreakdown: {} },
    targetPolicyId: 'policy-1',
    targetPolicyVersion: 2,
    baselinePolicyVersion: 1,
    totalReadySnapshot: 1000,
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

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogEvaluationRunRepository,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    repository = module.get<CatalogEvaluationRunRepository>(CatalogEvaluationRunRepository);
  });

  describe('validateStatus (fail-fast)', () => {
    /**
     * Tests for fail-fast status validation.
     * Legacy values ('completed', 'success', 'pending') should throw InvalidRunStatusError.
     * Valid values: 'running', 'prepared', 'failed', 'cancelled', 'promoted'.
     *
     * Note: InvalidRunStatusError is wrapped in DatabaseException by the repository's
     * error handling. We verify the cause contains the original error.
     */

    it('should throw DatabaseException with InvalidRunStatusError cause for "completed" (legacy)', async () => {
      const mockRow = createMockRow({ status: 'completed' });
      mockDb.limit.mockResolvedValue([mockRow]);

      await expect(repository.findById('run-123')).rejects.toThrow(DatabaseException);

      try {
        await repository.findById('run-123');
      } catch (error) {
        expect(error.cause).toBeInstanceOf(InvalidRunStatusError);
        expect(error.cause.message).toContain('completed');
      }
    });

    it('should throw DatabaseException with InvalidRunStatusError cause for "success" (legacy)', async () => {
      const mockRow = createMockRow({ status: 'success' });
      mockDb.limit.mockResolvedValue([mockRow]);

      await expect(repository.findById('run-123')).rejects.toThrow(DatabaseException);

      try {
        await repository.findById('run-123');
      } catch (error) {
        expect(error.cause).toBeInstanceOf(InvalidRunStatusError);
        expect(error.cause.message).toContain('success');
      }
    });

    it('should throw DatabaseException with InvalidRunStatusError cause for "pending" (legacy)', async () => {
      const mockRow = createMockRow({ status: 'pending' });
      mockDb.limit.mockResolvedValue([mockRow]);

      await expect(repository.findById('run-123')).rejects.toThrow(DatabaseException);

      try {
        await repository.findById('run-123');
      } catch (error) {
        expect(error.cause).toBeInstanceOf(InvalidRunStatusError);
        expect(error.cause.message).toContain('pending');
      }
    });

    it('should throw DatabaseException with InvalidRunStatusError cause for unknown status', async () => {
      const mockRow = createMockRow({ status: 'unknown_status' });
      mockDb.limit.mockResolvedValue([mockRow]);

      await expect(repository.findById('run-123')).rejects.toThrow(DatabaseException);

      try {
        await repository.findById('run-123');
      } catch (error) {
        expect(error.cause).toBeInstanceOf(InvalidRunStatusError);
        expect(error.cause.message).toContain('unknown_status');
      }
    });

    it('should keep "running" as "running"', async () => {
      const mockRow = createMockRow({ status: 'running' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('running');
    });

    it('should keep "prepared" as "prepared"', async () => {
      const mockRow = createMockRow({ status: 'prepared' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('prepared');
    });

    it('should keep "cancelled" as "cancelled"', async () => {
      const mockRow = createMockRow({ status: 'cancelled' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('cancelled');
    });

    it('should keep "promoted" as "promoted"', async () => {
      const mockRow = createMockRow({ status: 'promoted' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('promoted');
    });

    it('should keep "failed" as "failed"', async () => {
      const mockRow = createMockRow({ status: 'failed' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('failed');
    });
  });

  describe('mapToEntity', () => {
    /**
     * Tests that entity mapping uses columns, not JSON counters.
     */

    it('should use processed column, not counters.processed', async () => {
      const mockRow = createMockRow({
        processed: 500,
        counters: { processed: 100 }, // Different value in JSON
      });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.processed).toBe(500); // Should use column
    });

    it('should use eligible column, not counters.eligible', async () => {
      const mockRow = createMockRow({
        eligible: 400,
        counters: { eligible: 50 },
      });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.eligible).toBe(400);
    });

    it('should default to 0 when columns are null', async () => {
      const mockRow = createMockRow({
        processed: null,
        eligible: null,
        ineligible: null,
        errors: null,
        totalReadySnapshot: null,
      });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.processed).toBe(0);
      expect(result?.eligible).toBe(0);
      expect(result?.ineligible).toBe(0);
      expect(result?.errors).toBe(0);
      expect(result?.totalReadySnapshot).toBe(0);
    });

    it('should default errorSample to empty array when null', async () => {
      const mockRow = createMockRow({ errorSample: null });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.errorSample).toEqual([]);
    });
  });

  describe('create', () => {
    it('should initialize all counters to 0', async () => {
      const mockRow = createMockRow();
      mockDb.returning.mockResolvedValue([mockRow]);

      await repository.create({
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
        totalReadySnapshot: 1000,
        snapshotCutoff: new Date(),
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: 0,
          eligible: 0,
          ineligible: 0,
          errors: 0,
          baselinePolicyVersion: 1,
        }),
      );
    });
  });

  describe('incrementCounters', () => {
    /**
     * Tests for atomic counter increments.
     * Should use SQL COALESCE(column, 0) + value pattern.
     */

    it('should call update with SQL increment expressions', async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repository.incrementCounters('run-123', {
        processed: 1,
        eligible: 1,
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should only include specified counters in update', async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repository.incrementCounters('run-123', { processed: 1 });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: expect.anything(),
        }),
      );
    });
  });

  describe('recordError', () => {
    /**
     * Tests for atomic error recording.
     * Should increment errors AND append to errorSample in ONE UPDATE.
     */

    it('should call update once for both errors and errorSample', async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repository.recordError('run-123', {
        mediaItemId: 'item-1',
        error: 'Test error',
        timestamp: '2024-01-01T00:00:00Z',
      });

      // Should be exactly one update call
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockDb.set).toHaveBeenCalledTimes(1);
    });

    it('should include both errors increment and errorSample in set', async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repository.recordError('run-123', {
        mediaItemId: 'item-1',
        error: 'Test error',
        stack: 'Error stack trace',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.anything(),
          errorSample: expect.anything(),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return null when run not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should return mapped entity when found', async () => {
      const mockRow = createMockRow();
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('run-123');
    });
  });

  describe('aggregateCounters', () => {
    it('should aggregate counters from evaluations and errors column', async () => {
      // First call: select from mediaCatalogEvaluations (ends at where, no limit)
      // Second call: select errors from catalogEvaluationRuns (uses limit)
      mockDb.where
        .mockResolvedValueOnce([{ processed: 100, eligible: 80, ineligible: 15, review: 5 }])
        .mockReturnThis(); // For the second select's from().where()
      mockDb.limit.mockResolvedValueOnce([{ errors: 2 }]);

      const result = await repository.aggregateCounters('run-123');

      expect(result.processed).toBe(100);
      expect(result.eligible).toBe(80);
      expect(result.ineligible).toBe(15);
      expect(result.review).toBe(5);
      expect(result.errors).toBe(2);
    });

    it('should default to 0 when no evaluations exist', async () => {
      mockDb.where
        .mockResolvedValueOnce([]) // No evaluation results
        .mockReturnThis();
      mockDb.limit.mockResolvedValueOnce([{ errors: null }]);

      const result = await repository.aggregateCounters('run-123');

      expect(result.processed).toBe(0);
      expect(result.eligible).toBe(0);
      expect(result.ineligible).toBe(0);
      expect(result.review).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('syncRunCounters', () => {
    it('should atomically update counters with subqueries and return results', async () => {
      // Atomic UPDATE with .returning()
      mockDb.returning.mockResolvedValueOnce([
        {
          processed: 50,
          eligible: 40,
          ineligible: 8,
          errors: 1,
        },
      ]);

      const result = await repository.syncRunCounters('run-123');

      expect(result.processed).toBe(50);
      expect(result.eligible).toBe(40);
      expect(result.ineligible).toBe(8);
      expect(result.review).toBe(2); // 50 - 40 - 8 = 2
      expect(result.errors).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
      // Verify set was called with SQL subqueries (not plain values)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: expect.anything(),
          eligible: expect.anything(),
          ineligible: expect.anything(),
        }),
      );
    });
  });

  describe('findStaleRunning', () => {
    it('should return runs that are RUNNING and started before cutoff', async () => {
      mockDb.where.mockResolvedValue([{ id: 'run-1' }, { id: 'run-2' }]);

      const cutoff = new Date('2024-01-01');
      const result = await repository.findStaleRunning(cutoff);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('run-1');
      expect(result[1].id).toBe('run-2');
    });

    it('should return empty array when no stale runs exist', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repository.findStaleRunning(new Date());

      expect(result).toEqual([]);
    });
  });

  describe('recordAnomaly', () => {
    it('should append anomaly to errorSample using JSONB concat', async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repository.recordAnomaly('run-123', {
        type: 'ANOMALY_PROCESSED_GT_TOTAL',
        processed: 150,
        total: 100,
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          errorSample: expect.anything(),
        }),
      );
    });
  });

  describe('transitionToPrepared', () => {
    it('should return true when transition succeeds', async () => {
      mockDb.returning.mockResolvedValue([{ id: 'run-123' }]);

      const result = await repository.transitionToPrepared('run-123', {
        processed: 100,
        eligible: 80,
        ineligible: 15,
        review: 5,
        errors: 0,
      });

      expect(result).toBe(true);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'prepared',
          processed: 100,
          eligible: 80,
          ineligible: 15,
          errors: 0,
        }),
      );
    });

    it('should return false when run was already transitioned', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await repository.transitionToPrepared('run-123', {
        processed: 100,
        eligible: 80,
        ineligible: 15,
        review: 5,
        errors: 0,
      });

      expect(result).toBe(false);
    });
  });
});
