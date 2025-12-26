/**
 * Catalog Providers Controller Tests
 *
 * Unit tests for CatalogProvidersController:
 * - GET /catalog/providers
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CatalogProvidersController } from './catalog.providers.controller';
import { PROVIDERS_REPOSITORY } from '../../infrastructure/repositories/providers.repository';

describe('CatalogProvidersController', () => {
  let controller: CatalogProvidersController;
  let mockProvidersRepository: any;

  beforeEach(async () => {
    mockProvidersRepository = {
      findAllProviders: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogProvidersController],
      providers: [{ provide: PROVIDERS_REPOSITORY, useValue: mockProvidersRepository }],
    }).compile();

    controller = module.get<CatalogProvidersController>(CatalogProvidersController);
  });

  describe('getProviders', () => {
    it('should return list of providers sorted by count', async () => {
      const mockProviders = [
        { id: 'netflix', name: 'Netflix', count: 1500 },
        { id: 'amazon prime video', name: 'Amazon Prime Video', count: 1200 },
        { id: 'disney plus', name: 'Disney Plus', count: 800 },
      ];

      mockProvidersRepository.findAllProviders.mockResolvedValue(mockProviders);

      const result = await controller.getProviders();

      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toEqual({ id: 'netflix', name: 'Netflix', count: 1500 });
      expect(result.data[1].id).toBe('amazon prime video');
      expect(result.data[2].count).toBe(800);
      expect(mockProvidersRepository.findAllProviders).toHaveBeenCalledTimes(1);
    });

    it('should return empty list when no providers exist', async () => {
      mockProvidersRepository.findAllProviders.mockResolvedValue([]);

      const result = await controller.getProviders();

      expect(result.data).toEqual([]);
    });

    it('should handle providers with zero count', async () => {
      const mockProviders = [
        { id: 'netflix', name: 'Netflix', count: 100 },
        { id: 'new-provider', name: 'New Provider', count: 0 },
      ];

      mockProvidersRepository.findAllProviders.mockResolvedValue(mockProviders);

      const result = await controller.getProviders();

      expect(result.data).toHaveLength(2);
      expect(result.data[1].count).toBe(0);
    });

    it('should preserve provider name casing', async () => {
      const mockProviders = [
        { id: 'hbo max', name: 'HBO Max', count: 500 },
        { id: 'apple tv+', name: 'Apple TV+', count: 300 },
      ];

      mockProvidersRepository.findAllProviders.mockResolvedValue(mockProviders);

      const result = await controller.getProviders();

      expect(result.data[0].name).toBe('HBO Max');
      expect(result.data[1].name).toBe('Apple TV+');
    });
  });
});
