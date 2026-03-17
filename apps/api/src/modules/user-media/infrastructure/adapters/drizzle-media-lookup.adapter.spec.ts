import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';

import { DrizzleMediaLookupAdapter } from './drizzle-media-lookup.adapter';

describe('DrizzleMediaLookupAdapter', () => {
  let adapter: DrizzleMediaLookupAdapter;
  let mockDb: any;

  beforeEach(async () => {
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };

    mockDb = {
      select: jest.fn().mockReturnValue(chain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DrizzleMediaLookupAdapter, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    adapter = module.get<DrizzleMediaLookupAdapter>(DrizzleMediaLookupAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findManyByImdbIds', () => {
    it('returns matched items from DB', async () => {
      const dbRows = [
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000002', type: 'show' },
      ];
      const chain = mockDb.select();
      chain.where.mockResolvedValueOnce(dbRows);

      const result = await adapter.findManyByImdbIds(['tt0000001', 'tt0000002']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'media-1', imdbId: 'tt0000001', type: 'movie' });
      expect(result[1]).toEqual({ id: 'media-2', imdbId: 'tt0000002', type: 'show' });
    });

    it('returns empty array without querying DB when input is empty', async () => {
      const result = await adapter.findManyByImdbIds([]);

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('detects and logs a warning for duplicate IMDB IDs in DB result', async () => {
      const dbRows = [
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000001', type: 'movie' }, // duplicate
      ];
      const chain = mockDb.select();
      chain.where.mockResolvedValueOnce(dbRows);

      const warnSpy = jest.spyOn((adapter as any).logger, 'warn').mockImplementation(() => {});

      const result = await adapter.findManyByImdbIds(['tt0000001']);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('tt0000001'));
      // Both rows are still returned in the raw result (caller decides which to use)
      expect(result).toHaveLength(2);

      warnSpy.mockRestore();
    });

    it('does not warn when each IMDB ID appears exactly once', async () => {
      const dbRows = [
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000002', type: 'show' },
      ];
      const chain = mockDb.select();
      chain.where.mockResolvedValueOnce(dbRows);

      const warnSpy = jest.spyOn((adapter as any).logger, 'warn').mockImplementation(() => {});

      await adapter.findManyByImdbIds(['tt0000001', 'tt0000002']);

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('findManyByTmdbIds', () => {
    it('returns matched items from DB', async () => {
      const dbRows = [
        { id: 'media-1', tmdbId: 550, type: 'movie' },
        { id: 'media-2', tmdbId: 27205, type: 'movie' },
      ];
      const chain = mockDb.select();
      chain.where.mockResolvedValueOnce(dbRows);

      const result = await adapter.findManyByTmdbIds([550, 27205]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'media-1', tmdbId: 550, type: 'movie' });
      expect(result[1]).toEqual({ id: 'media-2', tmdbId: 27205, type: 'movie' });
    });

    it('returns empty array without querying DB when input is empty', async () => {
      const result = await adapter.findManyByTmdbIds([]);

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should chunk queries when TMDB IDs exceed 500', async () => {
      const tmdbIds = Array.from({ length: 501 }, (_, i) => i + 1);

      mockDb.select.mockImplementation(() => {
        const chain: any = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        return chain;
      });

      const result = await adapter.findManyByTmdbIds(tmdbIds);

      // Should have made 2 DB queries (500 + 1)
      expect(mockDb.select).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });

  describe('findManyByImdbIds chunking', () => {
    it('should chunk queries when IMDB IDs exceed 500', async () => {
      const imdbIds = Array.from({ length: 501 }, (_, i) => `tt${String(i).padStart(7, '0')}`);

      mockDb.select.mockImplementation(() => {
        const chain: any = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        return chain;
      });

      const result = await adapter.findManyByImdbIds(imdbIds);

      // Should have made 2 DB queries (500 + 1)
      expect(mockDb.select).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });
});
