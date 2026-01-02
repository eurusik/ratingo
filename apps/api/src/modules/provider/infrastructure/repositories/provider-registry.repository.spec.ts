import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { type Provider } from '../../domain/types/provider.types';
import { ProviderRegistryRepository } from './provider-registry.repository';

/**
 * ProviderRegistryRepository Tests
 *
 * Tests for the Drizzle implementation of provider registry repository.
 */
describe('ProviderRegistryRepository', () => {
  let repository: ProviderRegistryRepository;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    values: jest.Mock;
    set: jest.Mock;
    returning: jest.Mock;
  };

  const createMockDbRow = (overrides?: Partial<Provider>) => ({
    id: 'netflix',
    displayName: 'Netflix',
    brandGroup: null,
    logoPath: '/netflix.jpg',
    priority: 10,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderRegistryRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<ProviderRegistryRepository>(ProviderRegistryRepository);
  });

  describe('findAll', () => {
    it('should return only active providers by default', async () => {
      // Arrange
      const dbRows = [createMockDbRow({ id: 'netflix' }), createMockDbRow({ id: 'prime_video' })];
      mockDb.orderBy.mockResolvedValue(dbRows);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('netflix');
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return all providers when includeInactive is true', async () => {
      // Arrange
      const dbRows = [
        createMockDbRow({ id: 'netflix', isActive: true }),
        createMockDbRow({ id: 'old_provider', isActive: false }),
      ];
      mockDb.orderBy.mockResolvedValue(dbRows);

      // Act
      const result = await repository.findAll({ includeInactive: true });

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should throw DatabaseException on error', async () => {
      // Arrange
      mockDb.orderBy.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findAll()).rejects.toThrow(DatabaseException);
    });
  });

  describe('findById', () => {
    it('should return provider when found', async () => {
      // Arrange
      const dbRow = createMockDbRow({ id: 'netflix' });
      mockDb.limit.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.findById('netflix');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('netflix');
      expect(result?.displayName).toBe('Netflix');
    });

    it('should return null when provider not found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.findById('unknown');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      // Arrange
      mockDb.limit.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findById('netflix')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findByBrandGroup', () => {
    it('should return providers for brand group', async () => {
      // Arrange
      const dbRows = [
        createMockDbRow({ id: 'prime_video', brandGroup: 'amazon' }),
        createMockDbRow({ id: 'freevee', brandGroup: 'amazon' }),
      ];
      mockDb.orderBy.mockResolvedValue(dbRows);

      // Act
      const result = await repository.findByBrandGroup('amazon');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].brandGroup).toBe('amazon');
    });

    it('should return empty array when no providers in brand group', async () => {
      // Arrange
      mockDb.orderBy.mockResolvedValue([]);

      // Act
      const result = await repository.findByBrandGroup('unknown_group');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      // Arrange
      mockDb.orderBy.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findByBrandGroup('amazon')).rejects.toThrow(DatabaseException);
    });
  });

  describe('create', () => {
    it('should create provider and return it', async () => {
      // Arrange
      const createDto = {
        id: 'new_provider',
        displayName: 'New Provider',
        brandGroup: 'test_group',
        logoPath: '/new.jpg',
        priority: 50,
      };
      const dbRow = createMockDbRow(createDto);
      mockDb.returning.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.create(createDto);

      // Assert
      expect(result.id).toBe('new_provider');
      expect(result.displayName).toBe('New Provider');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new_provider',
          displayName: 'New Provider',
          isActive: true,
        }),
      );
    });

    it('should use default values for optional fields', async () => {
      // Arrange
      const createDto = {
        id: 'minimal_provider',
        displayName: 'Minimal Provider',
      };
      const dbRow = createMockDbRow({
        ...createDto,
        brandGroup: null,
        logoPath: null,
        priority: 100,
      });
      mockDb.returning.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.create(createDto);

      // Assert
      expect(result.priority).toBe(100);
      expect(result.brandGroup).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      // Arrange
      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.create({ id: 'test', displayName: 'Test' })).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('update', () => {
    it('should update provider and return it', async () => {
      // Arrange
      const updateDto = { displayName: 'Netflix Updated', priority: 5 };
      const dbRow = createMockDbRow({ id: 'netflix', ...updateDto });
      mockDb.returning.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.update('netflix', updateDto);

      // Assert
      expect(result.displayName).toBe('Netflix Updated');
      expect(result.priority).toBe(5);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Netflix Updated',
          priority: 5,
        }),
      );
    });

    it('should throw DatabaseException when provider not found', async () => {
      // Arrange
      mockDb.returning.mockResolvedValue([]);

      // Act & Assert
      await expect(repository.update('unknown', { displayName: 'Test' })).rejects.toThrow(
        DatabaseException,
      );
    });

    it('should throw DatabaseException on error', async () => {
      // Arrange
      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.update('netflix', { displayName: 'Test' })).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate provider', async () => {
      // Arrange
      const dbRow = createMockDbRow({ id: 'netflix', isActive: false });
      mockDb.returning.mockResolvedValue([dbRow]);

      // Act
      await repository.deactivate('netflix');

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('should throw DatabaseException when provider not found', async () => {
      // Arrange
      mockDb.returning.mockResolvedValue([]);

      // Act & Assert
      await expect(repository.deactivate('unknown')).rejects.toThrow(DatabaseException);
    });

    it('should throw DatabaseException on error', async () => {
      // Arrange
      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.deactivate('netflix')).rejects.toThrow(DatabaseException);
    });
  });

  describe('mapToEntity', () => {
    it('should map database row to Provider entity', async () => {
      // Arrange
      const dbRow = createMockDbRow({
        id: 'netflix',
        displayName: 'Netflix',
        brandGroup: 'streaming',
        logoPath: '/netflix.jpg',
        priority: 10,
        isActive: true,
      });
      mockDb.limit.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.findById('netflix');

      // Assert
      expect(result).toEqual({
        id: 'netflix',
        displayName: 'Netflix',
        brandGroup: 'streaming',
        logoPath: '/netflix.jpg',
        priority: 10,
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should handle null priority with default value', async () => {
      // Arrange
      const dbRow = createMockDbRow({ priority: null });
      mockDb.limit.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.findById('netflix');

      // Assert
      expect(result?.priority).toBe(100);
    });

    it('should handle null isActive with default value', async () => {
      // Arrange
      const dbRow = createMockDbRow({ isActive: null });
      mockDb.limit.mockResolvedValue([dbRow]);

      // Act
      const result = await repository.findById('netflix');

      // Assert
      expect(result?.isActive).toBe(true);
    });
  });
});
