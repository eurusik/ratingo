import { Test, TestingModule } from '@nestjs/testing';

import { ErrorCode } from '../../../../common/enums/error-code.enum';
import { NotFoundException } from '../../../../common/exceptions';
import { PROVIDER_REGISTRY_REPOSITORY } from '../../domain/repositories/provider-registry.repository.interface';
import { type Provider } from '../../domain/types/provider.types';
import { ProviderRegistryService } from './provider-registry.service';

/**
 * ProviderRegistryService Tests
 *
 * Tests for the provider registry service CRUD operations.
 */
describe('ProviderRegistryService', () => {
  let service: ProviderRegistryService;
  let mockRepository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByBrandGroup: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    deactivate: jest.Mock;
  };

  const createMockProvider = (overrides?: Partial<Provider>): Provider => ({
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
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByBrandGroup: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRegistryService,
        { provide: PROVIDER_REGISTRY_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ProviderRegistryService>(ProviderRegistryService);
  });

  describe('findAll', () => {
    it('should return only active providers by default', async () => {
      // Arrange
      const activeProviders = [
        createMockProvider({ id: 'netflix' }),
        createMockProvider({ id: 'prime_video' }),
      ];
      mockRepository.findAll.mockResolvedValue(activeProviders);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(activeProviders);
      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should include inactive providers when option is set', async () => {
      // Arrange
      const allProviders = [
        createMockProvider({ id: 'netflix', isActive: true }),
        createMockProvider({ id: 'old_provider', isActive: false }),
      ];
      mockRepository.findAll.mockResolvedValue(allProviders);

      // Act
      const result = await service.findAll({ includeInactive: true });

      // Assert
      expect(result).toEqual(allProviders);
      expect(mockRepository.findAll).toHaveBeenCalledWith({ includeInactive: true });
    });
  });

  describe('findById', () => {
    it('should return provider when found', async () => {
      // Arrange
      const provider = createMockProvider({ id: 'netflix' });
      mockRepository.findById.mockResolvedValue(provider);

      // Act
      const result = await service.findById('netflix');

      // Assert
      expect(result).toEqual(provider);
      expect(mockRepository.findById).toHaveBeenCalledWith('netflix');
    });

    it('should throw NotFoundException when provider not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('unknown')).rejects.toThrow(NotFoundException);
      await expect(service.findById('unknown')).rejects.toMatchObject({
        code: ErrorCode.RESOURCE_NOT_FOUND,
      });
    });
  });

  describe('findByIdOrNull', () => {
    it('should return provider when found', async () => {
      // Arrange
      const provider = createMockProvider({ id: 'netflix' });
      mockRepository.findById.mockResolvedValue(provider);

      // Act
      const result = await service.findByIdOrNull('netflix');

      // Assert
      expect(result).toEqual(provider);
    });

    it('should return null when provider not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.findByIdOrNull('unknown');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByBrandGroup', () => {
    it('should return providers for brand group', async () => {
      // Arrange
      const amazonProviders = [
        createMockProvider({ id: 'prime_video', brandGroup: 'amazon' }),
        createMockProvider({ id: 'freevee', brandGroup: 'amazon' }),
      ];
      mockRepository.findByBrandGroup.mockResolvedValue(amazonProviders);

      // Act
      const result = await service.findByBrandGroup('amazon');

      // Assert
      expect(result).toEqual(amazonProviders);
      expect(mockRepository.findByBrandGroup).toHaveBeenCalledWith('amazon');
    });

    it('should return empty array when no providers in brand group', async () => {
      // Arrange
      mockRepository.findByBrandGroup.mockResolvedValue([]);

      // Act
      const result = await service.findByBrandGroup('unknown_group');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create provider with all fields', async () => {
      // Arrange
      const createDto = {
        id: 'new_provider',
        displayName: 'New Provider',
        brandGroup: 'test_group',
        logoPath: '/new.jpg',
        priority: 50,
      };
      const createdProvider = createMockProvider(createDto);
      mockRepository.create.mockResolvedValue(createdProvider);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toEqual(createdProvider);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should create provider with minimal fields', async () => {
      // Arrange
      const createDto = {
        id: 'minimal_provider',
        displayName: 'Minimal Provider',
      };
      const createdProvider = createMockProvider({
        ...createDto,
        brandGroup: null,
        logoPath: null,
        priority: 100,
      });
      mockRepository.create.mockResolvedValue(createdProvider);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toEqual(createdProvider);
    });
  });

  describe('update', () => {
    it('should update provider when found', async () => {
      // Arrange
      const existingProvider = createMockProvider({ id: 'netflix' });
      const updateDto = { displayName: 'Netflix Updated', priority: 5 };
      const updatedProvider = createMockProvider({
        ...existingProvider,
        ...updateDto,
      });

      mockRepository.findById.mockResolvedValue(existingProvider);
      mockRepository.update.mockResolvedValue(updatedProvider);

      // Act
      const result = await service.update('netflix', updateDto);

      // Assert
      expect(result).toEqual(updatedProvider);
      expect(mockRepository.findById).toHaveBeenCalledWith('netflix');
      expect(mockRepository.update).toHaveBeenCalledWith('netflix', updateDto);
    });

    it('should throw NotFoundException when provider not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('unknown', { displayName: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should deactivate provider when found', async () => {
      // Arrange
      const existingProvider = createMockProvider({ id: 'netflix' });
      mockRepository.findById.mockResolvedValue(existingProvider);
      mockRepository.deactivate.mockResolvedValue(undefined);

      // Act
      await service.deactivate('netflix');

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith('netflix');
      expect(mockRepository.deactivate).toHaveBeenCalledWith('netflix');
    });

    it('should throw NotFoundException when provider not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deactivate('unknown')).rejects.toThrow(NotFoundException);
      expect(mockRepository.deactivate).not.toHaveBeenCalled();
    });
  });
});
