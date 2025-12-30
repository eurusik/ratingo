import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleProvidersRepository } from './providers.repository';
import { ProvidersQuery } from '../queries/providers.query';
import { DatabaseException } from '../../../../common/exceptions';

describe('DrizzleProvidersRepository', () => {
  let repository: DrizzleProvidersRepository;
  let mockProvidersQuery: { execute: jest.Mock };

  const setup = (options: { resolveWith?: any[]; rejectWith?: Error } = {}) => {
    mockProvidersQuery = {
      execute: jest.fn().mockImplementation(() => {
        if (options.rejectWith) {
          return Promise.reject(options.rejectWith);
        }
        return Promise.resolve(options.resolveWith ?? []);
      }),
    };

    return Test.createTestingModule({
      providers: [
        DrizzleProvidersRepository,
        { provide: ProvidersQuery, useValue: mockProvidersQuery },
      ],
    }).compile();
  };

  describe('findAllProviders', () => {
    it('should return providers from query', async () => {
      const mockResults = [
        { id: 'netflix', name: 'Netflix', count: 150 },
        { id: 'amazon prime video', name: 'Amazon Prime Video', count: 120 },
        { id: 'disney plus', name: 'Disney Plus', count: 80 },
      ];

      const module: TestingModule = await setup({ resolveWith: mockResults });
      repository = module.get(DrizzleProvidersRepository);

      const result = await repository.findAllProviders();

      expect(mockProvidersQuery.execute).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 'netflix', name: 'Netflix', count: 150 });
    });

    it('should return empty array when no providers found', async () => {
      const module: TestingModule = await setup({ resolveWith: [] });
      repository = module.get(DrizzleProvidersRepository);

      const result = await repository.findAllProviders();

      expect(mockProvidersQuery.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on query failure', async () => {
      const module: TestingModule = await setup({ rejectWith: new Error('Connection failed') });
      repository = module.get(DrizzleProvidersRepository);

      await expect(repository.findAllProviders()).rejects.toThrow(DatabaseException);
      expect(mockProvidersQuery.execute).toHaveBeenCalledTimes(1);
    });
  });
});
