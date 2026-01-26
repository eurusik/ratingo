/**
 * Catalog Policy Repository Tests
 *
 * Unit tests for policy CRUD operations:
 * - findActive, findById, findByVersion
 * - create (with auto-versioning)
 * - activate (transactional)
 * - findAll
 */

import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

import { CatalogPolicyRepository } from './catalog-policy.repository';

describe('CatalogPolicyRepository', () => {
  let repository: CatalogPolicyRepository;
  let mockDb: any;

  const mockPolicyRow = {
    id: 'policy-123',
    version: 1,
    isActive: true,
    policy: { eligibility: {}, breakoutRules: [] },
    createdAt: new Date('2024-01-01'),
    activatedAt: new Date('2024-01-02'),
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogPolicyRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<CatalogPolicyRepository>(CatalogPolicyRepository);
  });

  describe('findActive', () => {
    it('should return active policy when found', async () => {
      mockDb.limit.mockResolvedValueOnce([mockPolicyRow]);

      const result = await repository.findActive();

      expect(result).toEqual({
        id: 'policy-123',
        version: 1,
        isActive: true,
        policy: { eligibility: {}, breakoutRules: [] },
        createdAt: mockPolicyRow.createdAt,
        activatedAt: mockPolicyRow.activatedAt,
      });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when no active policy', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.findActive();

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findActive()).rejects.toThrow(DatabaseException);
    });
  });

  describe('findById', () => {
    it('should return policy when found', async () => {
      mockDb.limit.mockResolvedValueOnce([mockPolicyRow]);

      const result = await repository.findById('policy-123');

      expect(result).toEqual({
        id: 'policy-123',
        version: 1,
        isActive: true,
        policy: { eligibility: {}, breakoutRules: [] },
        createdAt: mockPolicyRow.createdAt,
        activatedAt: mockPolicyRow.activatedAt,
      });
    });

    it('should return null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findById('policy-123')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findByVersion', () => {
    it('should return policy when found', async () => {
      mockDb.limit.mockResolvedValueOnce([mockPolicyRow]);

      const result = await repository.findByVersion(1);

      expect(result).toEqual({
        id: 'policy-123',
        version: 1,
        isActive: true,
        policy: { eligibility: {}, breakoutRules: [] },
        createdAt: mockPolicyRow.createdAt,
        activatedAt: mockPolicyRow.activatedAt,
      });
    });

    it('should return null when version not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.findByVersion(999);

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findByVersion(1)).rejects.toThrow(DatabaseException);
    });
  });

  describe('create', () => {
    const policyConfig = { eligibility: {}, breakoutRules: [] };

    it('should create policy with next version number', async () => {
      // Mock: get max version
      mockDb.limit.mockResolvedValueOnce([{ maxVersion: 5 }]);
      // Mock: insert returning
      mockDb.returning.mockResolvedValueOnce([
        { ...mockPolicyRow, version: 6, isActive: false, activatedAt: null },
      ]);

      const result = await repository.create(policyConfig as any);

      expect(result.version).toBe(6);
      expect(result.isActive).toBe(false);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create first policy with version 1', async () => {
      // Mock: no existing policies
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock: insert returning
      mockDb.returning.mockResolvedValueOnce([
        { ...mockPolicyRow, version: 1, isActive: false, activatedAt: null },
      ]);

      const result = await repository.create(policyConfig as any);

      expect(result.version).toBe(1);
    });

    it('should throw DatabaseException on insert failure', async () => {
      mockDb.limit.mockResolvedValueOnce([{ maxVersion: 1 }]);
      mockDb.returning.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(repository.create(policyConfig as any)).rejects.toThrow(DatabaseException);
    });
  });

  describe('activate', () => {
    it('should activate policy in transaction', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockSet = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([{ ...mockPolicyRow, isActive: true }]);

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: mockUpdate,
          set: mockSet,
          where: mockWhere,
          returning: mockReturning,
        };
        return callback(tx);
      });

      await repository.activate('policy-123');

      expect(mockDb.transaction).toHaveBeenCalled();
      // Called twice: deactivate all, then activate specific
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should throw PolicyNotFoundError when policy not found', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockSet = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([]);

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: mockUpdate,
          set: mockSet,
          where: mockWhere,
          returning: mockReturning,
        };
        return callback(tx);
      });

      await expect(repository.activate('non-existent')).rejects.toThrow(DatabaseException);
    });

    it('should throw DatabaseException on transaction failure', async () => {
      mockDb.transaction.mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(repository.activate('policy-123')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findAll', () => {
    it('should return all policies ordered by version desc', async () => {
      const policies = [
        { ...mockPolicyRow, version: 3 },
        { ...mockPolicyRow, id: 'policy-456', version: 2 },
        { ...mockPolicyRow, id: 'policy-789', version: 1 },
      ];
      mockDb.orderBy.mockResolvedValueOnce(policies);

      const result = await repository.findAll();

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[1].version).toBe(2);
      expect(result[2].version).toBe(1);
    });

    it('should return empty array when no policies', async () => {
      mockDb.orderBy.mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.orderBy.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findAll()).rejects.toThrow(DatabaseException);
    });
  });
});
