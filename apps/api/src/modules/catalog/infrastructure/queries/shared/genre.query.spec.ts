import { Test, TestingModule } from '@nestjs/testing';
import { GenreQuery } from './genre.query';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import { DatabaseException } from '../../../../../common/exceptions/database.exception';
import { createDrizzleThenable } from '../../__test__/drizzle-mock.utils';

describe('GenreQuery', () => {
  let query: GenreQuery;
  let db: any;
  let selectChain: any;

  const setup = (options: { resolveWith?: any[]; rejectWith?: Error } = {}) => {
    selectChain = createDrizzleThenable(options.resolveWith ?? [], options.rejectWith);
    db = {
      select: jest.fn().mockReturnValue(selectChain),
    };

    return Test.createTestingModule({
      providers: [GenreQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  describe('fetchForMediaItem', () => {
    it('should return mapped genres for a media item', async () => {
      const mockRows = [
        { id: 'g1', name: 'Action', slug: 'action' },
        { id: 'g2', name: 'Comedy', slug: 'comedy' },
      ];
      const module: TestingModule = await setup({ resolveWith: mockRows });
      query = module.get(GenreQuery);

      const result = await query.fetchForMediaItem('media-1');

      expect(result).toEqual([
        { id: 'g1', name: 'Action', slug: 'action' },
        { id: 'g2', name: 'Comedy', slug: 'comedy' },
      ]);
      expect(db.select).toHaveBeenCalled();
      expect(selectChain.from).toHaveBeenCalled();
      expect(selectChain.innerJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should return empty array when no genres found', async () => {
      const module: TestingModule = await setup({ resolveWith: [] });
      query = module.get(GenreQuery);

      const result = await query.fetchForMediaItem('media-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ rejectWith: new Error('DB Error') });
      query = module.get(GenreQuery);

      await expect(query.fetchForMediaItem('media-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('fetchForMediaItems', () => {
    it('should return empty map for empty input', async () => {
      const module: TestingModule = await setup();
      query = module.get(GenreQuery);

      const result = await query.fetchForMediaItems([]);

      expect(result).toEqual(new Map());
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return grouped genres map for multiple media items', async () => {
      const mockRows = [
        { mediaItemId: 'media-1', id: 'g1', name: 'Action', slug: 'action' },
        { mediaItemId: 'media-1', id: 'g2', name: 'Comedy', slug: 'comedy' },
        { mediaItemId: 'media-2', id: 'g1', name: 'Action', slug: 'action' },
      ];
      const module: TestingModule = await setup({ resolveWith: mockRows });
      query = module.get(GenreQuery);

      const result = await query.fetchForMediaItems(['media-1', 'media-2']);

      expect(result.get('media-1')).toEqual([
        { id: 'g1', name: 'Action', slug: 'action' },
        { id: 'g2', name: 'Comedy', slug: 'comedy' },
      ]);
      expect(result.get('media-2')).toEqual([{ id: 'g1', name: 'Action', slug: 'action' }]);
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ rejectWith: new Error('DB Error') });
      query = module.get(GenreQuery);

      await expect(query.fetchForMediaItems(['media-1'])).rejects.toThrow(DatabaseException);
    });

    it('should return empty map when no genres found for given media items', async () => {
      const module: TestingModule = await setup({ resolveWith: [] });
      query = module.get(GenreQuery);

      const result = await query.fetchForMediaItems(['media-1', 'media-2']);

      expect(result).toEqual(new Map());
    });
  });
});
