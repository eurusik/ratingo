import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { UNMAPPED_TRACKING_REPOSITORY } from '../../domain/repositories/unmapped-tracking.repository.interface';
import { UnmappedTrackingRepository } from './unmapped-tracking.repository';

describe('UnmappedTrackingRepository', () => {
  let repository: UnmappedTrackingRepository;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    offset: jest.Mock;
    values: jest.Mock;
    onConflictDoUpdate: jest.Mock;
  };

  const createMockDbRow = (overrides?: Partial<ReturnType<typeof createMockDbRow>>) => ({
    tmdbProviderId: 8,
    lastSeenName: 'Netflix',
    sampleNames: ['Netflix'],
    firstSeenAt: new Date('2024-01-01'),
    lastSeenAt: new Date('2024-01-15'),
    seenCount: 100,
    sampleRegions: ['US'],
    ...overrides,
  });

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: UNMAPPED_TRACKING_REPOSITORY,
          useClass: UnmappedTrackingRepository,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<UnmappedTrackingRepository>(UNMAPPED_TRACKING_REPOSITORY);
  });

  describe('recordUnmapped', () => {
    it('should insert new unmapped provider', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.recordUnmapped({
        tmdbProviderId: 8,
        providerName: 'Netflix',
        region: 'US',
      });

      // Assert
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbProviderId: 8,
          lastSeenName: 'Netflix',
          sampleNames: ['Netflix'],
          sampleRegions: ['US'],
          seenCount: 1,
        }),
      );
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should handle upsert on conflict', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.recordUnmapped({
        tmdbProviderId: 8,
        providerName: 'Netflix',
        region: 'GB',
      });

      // Assert
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.anything(),
          set: expect.objectContaining({
            lastSeenName: 'Netflix',
          }),
        }),
      );
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(
        repository.recordUnmapped({
          tmdbProviderId: 8,
          providerName: 'Netflix',
          region: 'US',
        }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('recordUnmappedBatch', () => {
    it('should do nothing for empty input', async () => {
      // Act
      await repository.recordUnmappedBatch([]);

      // Assert
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should aggregate inputs by tmdbProviderId', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.recordUnmappedBatch([
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'US' },
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'GB' },
        { tmdbProviderId: 9, providerName: 'Prime Video', region: 'US' },
      ]);

      // Assert - should have 2 inserts (one per unique tmdbProviderId)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should aggregate different names for same provider', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.recordUnmappedBatch([
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'US' },
        { tmdbProviderId: 8, providerName: 'Netflix Basic', region: 'US' },
      ]);

      // Assert
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbProviderId: 8,
          sampleNames: expect.arrayContaining(['Netflix', 'Netflix Basic']),
          seenCount: 2,
        }),
      );
    });

    it('should aggregate different regions for same provider', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.recordUnmappedBatch([
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'US' },
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'GB' },
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'DE' },
      ]);

      // Assert
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbProviderId: 8,
          sampleRegions: expect.arrayContaining(['US', 'GB', 'DE']),
          seenCount: 3,
        }),
      );
    });

    it('should use last seen name from batch', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.recordUnmappedBatch([
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'US' },
        { tmdbProviderId: 8, providerName: 'Netflix Premium', region: 'GB' },
      ]);

      // Assert
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSeenName: 'Netflix Premium',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all unmapped providers sorted by count', async () => {
      // Arrange
      const mockRows = [
        createMockDbRow({ tmdbProviderId: 8, seenCount: 100 }),
        createMockDbRow({ tmdbProviderId: 9, lastSeenName: 'Prime Video', seenCount: 50 }),
      ];
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findAll({ sortBy: 'seenCount', limit: 10 });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data[0].tmdbProviderId).toBe(8);
      expect(result.data[0].seenCount).toBe(100);
    });

    it('should return all unmapped providers sorted by lastSeenAt', async () => {
      // Arrange
      const mockRows = [createMockDbRow()];
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findAll({ sortBy: 'lastSeenAt', limit: 5 });

      // Assert
      expect(result.data).toHaveLength(1);
    });

    it('should use default sort by seenCount when no options', async () => {
      // Arrange
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.data).toEqual([]);
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.select.mockReturnThis();
      mockDb.from.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findAll()).rejects.toThrow('DB Error');
    });
  });

  describe('findByTmdbId', () => {
    it('should return unmapped provider when found', async () => {
      // Arrange
      const mockRow = createMockDbRow();
      mockDb.limit.mockResolvedValue([mockRow]);

      // Act
      const result = await repository.findByTmdbId(8);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.tmdbProviderId).toBe(8);
      expect(result?.lastSeenName).toBe('Netflix');
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.findByTmdbId(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.limit.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findByTmdbId(8)).rejects.toThrow('DB Error');
    });
  });

  describe('removeByTmdbId', () => {
    it('should delete unmapped provider', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.removeByTmdbId(8);

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should not throw when provider does not exist', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act & Assert
      await expect(repository.removeByTmdbId(999)).resolves.not.toThrow();
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.removeByTmdbId(8)).rejects.toThrow('DB Error');
    });
  });
});
