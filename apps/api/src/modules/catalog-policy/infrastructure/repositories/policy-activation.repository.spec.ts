/**
 * Policy Activation Repository Tests
 *
 * Unit tests for transactional operations:
 * - createRunWithSnapshot (atomic snapshot + run creation)
 * - promoteRun (atomic policy activation + run promotion)
 * - countReadyMediaItems (media item counting)
 */

import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { RunStatus } from '../../domain/constants/evaluation.constants';
import { InvalidRunStateTransitionError } from '../../domain/errors';

import { PolicyActivationRepository } from './policy-activation.repository';

describe('PolicyActivationRepository', () => {
  let repository: PolicyActivationRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      transaction: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ count: 500 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyActivationRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<PolicyActivationRepository>(PolicyActivationRepository);
  });

  describe('createRunWithSnapshot', () => {
    it('should create run with snapshot data in a transaction', async () => {
      let queryCall = 0;
      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx: any = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation(() => {
            queryCall++;
            if (queryCall === 1) {
              // First query: active policy lookup, returns chainable with limit
              return { limit: jest.fn().mockResolvedValue([{ version: 1 }]) };
            }
            // Second query: count ready media items, returns thenable
            return Promise.resolve([{ count: 1000 }]);
          }),
          returning: jest.fn().mockResolvedValue([{ id: 'run-123' }]),
        };
        return callback(tx);
      });

      const result = await repository.createRunWithSnapshot({
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
      });

      expect(result.runId).toBe('run-123');
      expect(result.baselinePolicyVersion).toBe(1);
      expect(result.totalReadySnapshot).toBe(1000);
      expect(result.snapshotCutoff).toBeInstanceOf(Date);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle no active policy (baselinePolicyVersion = null)', async () => {
      let queryCall = 0;
      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx: any = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation(() => {
            queryCall++;
            if (queryCall === 1) {
              return { limit: jest.fn().mockResolvedValue([]) };
            }
            return Promise.resolve([{ count: 500 }]);
          }),
          returning: jest.fn().mockResolvedValue([{ id: 'run-456' }]),
        };
        return callback(tx);
      });

      const result = await repository.createRunWithSnapshot({
        targetPolicyId: 'policy-2',
        targetPolicyVersion: 1,
      });

      expect(result.runId).toBe('run-456');
      expect(result.baselinePolicyVersion).toBeNull();
      expect(result.totalReadySnapshot).toBe(500);
    });

    it('should handle zero ready media items', async () => {
      let queryCall = 0;
      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx: any = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation(() => {
            queryCall++;
            if (queryCall === 1) {
              return { limit: jest.fn().mockResolvedValue([{ version: 1 }]) };
            }
            return Promise.resolve([{ count: 0 }]);
          }),
          returning: jest.fn().mockResolvedValue([{ id: 'run-789' }]),
        };
        return callback(tx);
      });

      const result = await repository.createRunWithSnapshot({
        targetPolicyId: 'policy-3',
        targetPolicyVersion: 3,
      });

      expect(result.totalReadySnapshot).toBe(0);
    });

    it('should throw DatabaseException on transaction failure', async () => {
      mockDb.transaction.mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(
        repository.createRunWithSnapshot({
          targetPolicyId: 'policy-1',
          targetPolicyVersion: 2,
        }),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('promoteRun', () => {
    it('should promote run atomically in a transaction', async () => {
      let updateCall = 0;
      const mockUpdate = jest.fn().mockReturnThis();
      const mockSet = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockImplementation(() => {
        updateCall++;
        if (updateCall === 3) {
          // Third update: run status with optimistic lock, needs returning()
          return {
            returning: jest.fn().mockResolvedValue([{ id: 'run-123' }]),
          };
        }
        return Promise.resolve(undefined);
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: mockUpdate,
          set: mockSet,
          where: mockWhere,
        };
        return callback(tx);
      });

      await repository.promoteRun({
        runId: 'run-123',
        targetPolicyId: 'policy-1',
        newStatus: RunStatus.PROMOTED,
        promotedBy: 'admin',
      });

      expect(mockDb.transaction).toHaveBeenCalled();
      // Verify update was called 3 times: deactivate old, activate new, update run
      expect(mockUpdate).toHaveBeenCalledTimes(3);
    });

    it('should throw InvalidRunStateTransitionError when run is not in PREPARED state', async () => {
      let updateCall = 0;
      const mockUpdate = jest.fn().mockReturnThis();
      const mockSet = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockImplementation(() => {
        updateCall++;
        if (updateCall === 3) {
          // Third update: run status - return empty array (optimistic lock failed)
          return {
            returning: jest.fn().mockResolvedValue([]),
          };
        }
        return Promise.resolve(undefined);
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: mockUpdate,
          set: mockSet,
          where: mockWhere,
        };
        return callback(tx);
      });

      await expect(
        repository.promoteRun({
          runId: 'run-123',
          targetPolicyId: 'policy-1',
          newStatus: RunStatus.PROMOTED,
          promotedBy: 'admin',
        }),
      ).rejects.toThrow(InvalidRunStateTransitionError);
    });

    it('should throw DatabaseException on transaction failure', async () => {
      mockDb.transaction.mockRejectedValueOnce(new Error('Promotion failed'));

      await expect(
        repository.promoteRun({
          runId: 'run-123',
          targetPolicyId: 'policy-1',
          newStatus: RunStatus.PROMOTED,
          promotedBy: 'admin',
        }),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('countReadyMediaItems', () => {
    it('should return count of ready media items', async () => {
      mockDb.where.mockResolvedValueOnce([{ count: 1500 }]);

      const count = await repository.countReadyMediaItems(new Date());

      expect(count).toBe(1500);
    });

    it('should return 0 when no ready media items', async () => {
      mockDb.where.mockResolvedValueOnce([{ count: 0 }]);

      const count = await repository.countReadyMediaItems(new Date());

      expect(count).toBe(0);
    });

    it('should return 0 when count is null/undefined', async () => {
      mockDb.where.mockResolvedValueOnce([{}]);

      const count = await repository.countReadyMediaItems(new Date());

      expect(count).toBe(0);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.where.mockRejectedValueOnce(new Error('Query failed'));

      await expect(repository.countReadyMediaItems(new Date())).rejects.toThrow(DatabaseException);
    });
  });
});
