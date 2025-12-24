/**
 * Catalog Evaluation Run Repository Tests
 *
 * Unit tests for repository methods including:
 * - normalizeStatus (legacy status mapping: completed/success → prepared, pending → running)
 * - incrementCounters (atomic SQL operations)
 * - recordError (atomic error recording)
 *
 * Feature: policy-activation-flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  CatalogEvaluationRunRepository,
  CatalogEvaluationRun,
} from './catalog-evaluation-run.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

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
    totalReadySnapshot: 1000,
    snapshotCutoff: new Date('2024-01-01'),
    processed: 0,
    eligible: 0,
    ineligible: 0,
    pending: 0,
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

  describe('normalizeStatus', () => {
    /**
     * Tests for legacy status mapping.
     * - 'completed' (legacy) → 'prepared' (current)
     * - 'success' (legacy) → 'prepared' (current)
     * - 'pending' (legacy) → 'running' (current)
     */

    it('should map "completed" to "prepared"', async () => {
      const mockRow = createMockRow({ status: 'completed' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('prepared');
    });

    it('should map "success" to "prepared"', async () => {
      const mockRow = createMockRow({ status: 'success' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('prepared');
    });

    it('should map "pending" to "running"', async () => {
      const mockRow = createMockRow({ status: 'pending' });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.status).toBe('running');
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
        pending: null,
        errors: null,
        totalReadySnapshot: null,
      });
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById('run-123');

      expect(result?.processed).toBe(0);
      expect(result?.eligible).toBe(0);
      expect(result?.ineligible).toBe(0);
      expect(result?.pending).toBe(0);
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
        totalReadySnapshot: 1000,
        snapshotCutoff: new Date(),
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: 0,
          eligible: 0,
          ineligible: 0,
          pending: 0,
          errors: 0,
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
});
