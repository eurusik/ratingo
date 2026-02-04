import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersQuery } from './providers.query';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('ProvidersQuery', () => {
  let query: ProvidersQuery;
  let db: any;

  const setup = (options: { resolveWith?: any[]; rejectWith?: Error } = {}) => {
    db = {
      execute: jest.fn().mockImplementation(() => {
        if (options.rejectWith) {
          return Promise.reject(options.rejectWith);
        }
        return Promise.resolve(options.resolveWith ?? []);
      }),
    };

    return Test.createTestingModule({
      providers: [ProvidersQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  describe('execute', () => {
    it('should return mapped providers sorted by count', async () => {
      const mockResults = [
        { id: 'netflix', name: 'Netflix', count: 150 },
        { id: 'amazon prime video', name: 'Amazon Prime Video', count: 120 },
        { id: 'disney plus', name: 'Disney Plus', count: 80 },
      ];

      const module: TestingModule = await setup({ resolveWith: mockResults });
      query = module.get(ProvidersQuery);

      const result = await query.execute();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 'netflix', name: 'Netflix', count: 150 });
      expect(result[1]).toEqual({
        id: 'amazon prime video',
        name: 'Amazon Prime Video',
        count: 120,
      });
      expect(result[2]).toEqual({ id: 'disney plus', name: 'Disney Plus', count: 80 });
    });

    it('should return empty array when no providers found', async () => {
      const module: TestingModule = await setup({ resolveWith: [] });
      query = module.get(ProvidersQuery);

      const result = await query.execute();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should handle providers with zero count', async () => {
      const mockResults = [
        { id: 'netflix', name: 'Netflix', count: 100 },
        { id: 'hulu', name: 'Hulu', count: 0 },
      ];

      const module: TestingModule = await setup({ resolveWith: mockResults });
      query = module.get(ProvidersQuery);

      const result = await query.execute();

      expect(result).toHaveLength(2);
      expect(result[1].count).toBe(0);
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ rejectWith: new Error('Connection failed') });
      query = module.get(ProvidersQuery);

      await expect(query.execute()).rejects.toThrow(DatabaseException);
      await expect(query.execute()).rejects.toThrow('Failed to fetch providers');
    });

    it('should map all fields correctly from raw result', async () => {
      const mockResults = [{ id: 'apple tv', name: 'Apple TV', count: 45 }];

      const module: TestingModule = await setup({ resolveWith: mockResults });
      query = module.get(ProvidersQuery);

      const result = await query.execute();

      expect(result[0]).toHaveProperty('id', 'apple tv');
      expect(result[0]).toHaveProperty('name', 'Apple TV');
      expect(result[0]).toHaveProperty('count', 45);
    });
  });
});
